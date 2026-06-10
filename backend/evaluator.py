"""LLM-as-judge quality gate.

After a module is generated, an independent judge call scores it on
grounding, specificity, and coverage. Below-threshold modules are
regenerated once with the judge's feedback folded into the prompt.

Methodology rationale: generation and evaluation use separate contexts,
so the judge isn't anchored on the generator's reasoning — the same
principle as code review by a second engineer.
"""

import json
import os

from pydantic import BaseModel, Field

from backend.llm import generate_structured

QUALITY_THRESHOLD = 7.0


def enabled() -> bool:
    return os.environ.get("QUALITY_GATE", "on").lower() not in ("off", "0", "false")


class QualityReview(BaseModel):
    score: float = Field(ge=0, le=10, description="Overall quality 0-10")
    feedback: str = Field(description="Specific, actionable issues to fix")


CRITERIA = {
    "competitiveLandscape": (
        "1. Are all competitors REAL, existing games (no hallucinated titles)?\n"
        "2. Is each rationale specific to that game (not copy-paste generic)?\n"
        "3. Does the set cover multiple competition dimensions (genre, IP/theme, "
        "monetization, audience overlap) rather than one narrow slice?\n"
        "4. Is the count in the 10-15 range?"
    ),
    "audienceOverview": (
        "1. Is each segment defined by BEHAVIOR and MOTIVATION, not just demographics?\n"
        "2. Do segments have clear boundaries (not three names for the same people)?\n"
        "3. Are selectedExistingCompetitors plausible for each segment?\n"
        "4. Does the summary explain the segmentation logic?"
    ),
    "positioningMatrix": (
        "1. Do the axes reveal a strategic insight (not generic quality/popularity)?\n"
        "2. Are axis endpoint labels self-explanatory phrases?\n"
        "3. Are positions defensible from known game features?\n"
        "4. Does the game itself occupy a differentiated position (or is the gap honest)?"
    ),
    "swot": (
        "1. Does each item reference SPECIFIC competitors or segments (no generic filler "
        "like 'strong IP' without naming what it beats)?\n"
        "2. Are strengths/weaknesses internal and opportunities/threats external?\n"
        "3. Are items actionable for a go-to-market team?\n"
        "4. Is coverage balanced across the four quadrants?"
    ),
}


async def evaluate(module_name: str, data: dict) -> dict:
    """Score a generated module. Returns {score, feedback}."""
    criteria = CRITERIA.get(module_name, "Assess overall quality and specificity.")
    prompt = (
        f"You are reviewing a generated '{module_name}' module for a game "
        "go-to-market analysis. Score it 0-10 against these criteria:\n\n"
        f"{criteria}\n\n"
        f"Module content:\n{json.dumps(data, indent=2)[:12000]}\n\n"
        "Be a strict reviewer: 9-10 = exceptional, 7-8 = solid, 5-6 = has real "
        "gaps, <5 = needs rework. In feedback, name the specific items that are "
        "weak and what would fix them. Output ONLY JSON: "
        '{"score": <number>, "feedback": "<specific issues>"}'
    )
    return await generate_structured(
        system="You are a rigorous quality reviewer for market analysis documents. Output ONLY valid JSON.",
        messages=[{"role": "user", "content": prompt}],
        schema_class=QualityReview,
    )
