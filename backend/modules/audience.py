"""AudienceOverview module generation (Layer 2).

Methodology: Grounded segmentation with reference validation.
1. Analyze competitive landscape to identify player behavior patterns
2. Generate segments grounded in competitor data
3. Validate that all selectedExistingCompetitors references are valid
"""

import json
from backend.llm import wrap_brief, generate_with_reasoning, generate_structured
from backend.schemas import AudienceOverview


SYSTEM = (
    "You are a senior audience strategist for the gaming industry. "
    "You specialize in player segmentation and behavioral analysis, "
    "grounding your insights in competitive market data."
)


async def generate(input_md: str, competitive_landscape: dict, feedback: str | None = None) -> dict:
    """Generate AudienceOverview grounded in CompetitiveLandscape."""

    competitor_names = [c["name"] for c in competitive_landscape["existingCompetitors"]]

    reasoning_prompt = (
        f"Game brief:\n{wrap_brief(input_md)}\n\n"
        f"Competitive landscape:\n{json.dumps(competitive_landscape, indent=2)}\n\n"
        "Identify 3-5 distinct audience segments for this game. For each segment:\n"
        "1. Define the segment by behaviors and motivations (not just demographics)\n"
        "2. Explain what draws them to THIS game specifically\n"
        "3. Identify which competitors from the landscape they currently play\n"
        "4. Describe the boundaries — what makes this segment distinct from others\n\n"
        "Think about overlap: players can exist in multiple segments, but each "
        "segment should have a clear primary motivation.\n\n"
        f"Available competitor names to reference: {', '.join(competitor_names)}"
    )

    structuring_prompt = (
        "Convert your audience analysis into a structured AudienceOverview. "
        "CRITICAL: selectedExistingCompetitors must ONLY contain names from this list: "
        f"{', '.join(competitor_names)}. "
        "Use exact name matches. The summary should explain the segmentation logic "
        "and how it connects to the competitive landscape."
    )

    if feedback:
        reasoning_prompt += (
            "\n\nA quality reviewer flagged these issues with a prior attempt — "
            f"address them explicitly:\n{feedback}"
        )

    result = await generate_with_reasoning(
        system=SYSTEM,
        reasoning_prompt=reasoning_prompt,
        structuring_prompt=structuring_prompt,
        schema_class=AudienceOverview,
    )

    # Validate references
    result = _validate_references(result, competitor_names)
    return result


def _validate_references(audience: dict, valid_names: list[str]) -> dict:
    """Ensure all selectedExistingCompetitors are valid references."""
    valid_set = set(valid_names)
    for segment in audience["segments"]:
        segment["selectedExistingCompetitors"] = [
            name for name in segment["selectedExistingCompetitors"]
            if name in valid_set
        ]
    return audience
