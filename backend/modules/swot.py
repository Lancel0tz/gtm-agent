"""SWOT module generation (Layer 3).

Methodology: Grounded SWOT with competitive evidence.
1. Derive each SWOT category from upstream module data, not generic reasoning
2. Each item must cite specific competitive or audience evidence
"""

import json
from backend.llm import wrap_brief, generate_with_reasoning
from backend.schemas import SWOT


SYSTEM = (
    "You are a senior game industry strategist specializing in SWOT analysis. "
    "Your analyses are grounded in competitive data and audience insights, "
    "not generic observations."
)


async def generate(
    input_md: str,
    competitive_landscape: dict,
    audience_overview: dict,
) -> dict:
    """Generate SWOT grounded in competitive and audience context."""

    reasoning_prompt = (
        f"Game brief:\n{wrap_brief(input_md)}\n\n"
        f"Competitive landscape:\n{json.dumps(competitive_landscape, indent=2)}\n\n"
        f"Audience segments:\n{json.dumps(audience_overview, indent=2)}\n\n"
        "Perform a SWOT analysis for the go-to-market strategy of the game in the brief.\n\n"
        "Rules:\n"
        "- Each point MUST reference specific competitors or audience segments from "
        "the upstream data — no generic statements\n"
        "- Consider the FULL competitor list, including niche or recently added "
        "titles — a newly added competitor often signals a market shift worth "
        "calling out in opportunities or threats\n"
        "- Strengths: what concrete advantages does this game have vs named competitors?\n"
        "- Weaknesses: what specific disadvantages exist compared to named competitors?\n"
        "- Opportunities: what market gaps or audience needs are underserved by "
        "current competitors?\n"
        "- Threats: what specific competitive or market risks could undermine launch?\n\n"
        "Aim for 4-6 items per category. Each should be specific and actionable."
    )

    structuring_prompt = (
        "Convert your SWOT analysis into structured JSON. "
        "Each item should have a stable id (sw-001, wk-001, op-001, th-001 pattern) "
        "and a clear, specific text statement. Keep each statement concise but "
        "grounded — it should reference specific competitors or segments."
    )

    return await generate_with_reasoning(
        system=SYSTEM,
        reasoning_prompt=reasoning_prompt,
        structuring_prompt=structuring_prompt,
        schema_class=SWOT,
    )
