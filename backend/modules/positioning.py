"""PositioningMatrix module generation (Layer 3).

Methodology: Axis selection through competitive gap analysis.
1. Analyze competitive spread to find meaningful differentiating axes
2. Plot positions with justification for each placement
"""

import json
from backend.llm import generate_with_reasoning
from backend.schemas import PositioningMatrix


SYSTEM = (
    "You are a strategic positioning expert for the gaming industry. "
    "You specialize in identifying meaningful axes of differentiation "
    "that reveal market gaps and competitive advantages."
)


async def generate(
    input_md: str,
    competitive_landscape: dict,
    audience_overview: dict,
) -> dict:
    """Generate PositioningMatrix using competitive and audience data."""

    reasoning_prompt = (
        f"Game brief:\n{input_md}\n\n"
        f"Competitive landscape:\n{json.dumps(competitive_landscape, indent=2)}\n\n"
        f"Audience segments:\n{json.dumps(audience_overview, indent=2)}\n\n"
        "Design a 2D positioning matrix for this game:\n\n"
        "1. AXIS SELECTION: Choose two axes that reveal a meaningful gap or "
        "opportunity for the game. Avoid generic axes like 'quality' or "
        "'popularity'. Good axes differentiate between competitors in ways that "
        "matter to the target audience segments. Axis endpoint labels (lowLabel/"
        "highLabel) must be self-explanatory 2-4 word phrases that make sense "
        "standing alone on a chart corner — e.g. 'Solo Survival' / 'Massive "
        "Multiplayer', NEVER bare words like 'Low', 'High', 'Rich', 'Minimal'.\n\n"
        "2. POSITIONING: Plot Dune: Awakening and 6-10 of the most relevant "
        "competitors. For each, justify the x,y placement (0-10 scale) based on "
        "concrete game features, not subjective quality judgments.\n\n"
        "3. GAP ANALYSIS: Identify where Dune: Awakening sits relative to "
        "competitors and what strategic opportunity the positioning reveals."
    )

    structuring_prompt = (
        "Convert your positioning analysis into a PositioningMatrix. "
        "Include Dune: Awakening and 6-10 competitors. Positions should be "
        "numbers from 0 to 10. Make sure the chosen axes meaningfully "
        "differentiate the games and reveal a strategic insight."
    )

    return await generate_with_reasoning(
        system=SYSTEM,
        reasoning_prompt=reasoning_prompt,
        structuring_prompt=structuring_prompt,
        schema_class=PositioningMatrix,
    )
