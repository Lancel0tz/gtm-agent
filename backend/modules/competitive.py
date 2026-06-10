"""CompetitiveLandscape module generation (Layer 1).

Methodology: Two-step generation with self-critique.
1. Analyze the game brief to extract competitive dimensions
2. Generate competitors with rationale, then self-critique for coverage gaps
"""

from backend.llm import generate_structured, generate_with_reasoning
from backend.schemas import CompetitiveLandscape

SYSTEM = (
    "You are a senior game industry analyst specializing in competitive intelligence. "
    "You have deep knowledge of the gaming market across all platforms and genres."
)


async def generate(input_md: str) -> dict:
    """Generate CompetitiveLandscape from input.md using multi-step reasoning."""

    # Step 1: Analyze competitive dimensions
    reasoning_prompt = (
        "Analyze this game brief and identify the competitive landscape.\n\n"
        f"{input_md}\n\n"
        "Think through these dimensions:\n"
        "1. Direct genre competitors (same core genre and mechanics as the brief)\n"
        "2. IP/theme competitors (same setting, franchise, or fantasy)\n"
        "3. Monetization model competitors (same price point and revenue model)\n"
        "4. Platform competitors (titles competing on the same storefronts)\n"
        "5. Audience overlap competitors (games that share the target audience)\n\n"
        "For each potential competitor, explain WHY it competes — what specific "
        "feature, audience, or market position overlaps with this game.\n"
        "Identify 10-15 real, existing games. Be specific and accurate."
    )

    structuring_prompt = (
        "Convert your competitive analysis into a structured CompetitiveLandscape. "
        "Include 10-15 competitors. Each must have a clear, specific rationale explaining "
        "why it's in the competitive set. The summary should capture the overall competitive "
        "positioning and key insight about where this game sits in the market."
    )

    result = await generate_with_reasoning(
        system=SYSTEM,
        reasoning_prompt=reasoning_prompt,
        structuring_prompt=structuring_prompt,
        schema_class=CompetitiveLandscape,
    )

    # Step 3: Self-critique for coverage gaps
    critique_result = await _self_critique(input_md, result)
    return critique_result


async def _self_critique(input_md: str, landscape: dict) -> dict:
    """Review the generated landscape for gaps and biases."""
    import json

    competitor_names = [c["name"] for c in landscape["existingCompetitors"]]
    critique_prompt = (
        f"Review this competitive landscape for a game described as:\n{input_md[:500]}\n\n"
        f"Current competitors: {', '.join(competitor_names)}\n\n"
        "Check for:\n"
        "1. Missing major competitors that should be included\n"
        "2. Irrelevant entries that should be removed\n"
        "3. Whether the rationales are specific enough\n"
        "4. Genre/category coverage balance\n\n"
        "If the list is solid, respond with 'APPROVED'. "
        "If changes are needed, explain what to add/remove and why."
    )

    critique = await generate_structured(
        system=SYSTEM,
        messages=[{"role": "user", "content": critique_prompt}],
    )

    if "APPROVED" in critique.upper():
        return landscape

    # If critique suggests changes, regenerate with the feedback
    refinement_prompt = (
        f"Original game brief (excerpt):\n{input_md[:800]}\n\n"
        f"Current competitive landscape:\n{json.dumps(landscape, indent=2)}\n\n"
        f"Critique feedback:\n{critique}\n\n"
        "Produce a revised CompetitiveLandscape incorporating the feedback. "
        "Keep entries that were good, fix issues raised in the critique. "
        "Target 10-15 competitors total.\n\n"
        f"Output ONLY valid JSON matching this schema:\n"
        f"{json.dumps(CompetitiveLandscape.model_json_schema(), indent=2)}"
    )

    result = await generate_structured(
        system=SYSTEM + " Output ONLY valid JSON, no markdown fences.",
        messages=[{"role": "user", "content": refinement_prompt}],
        schema_class=CompetitiveLandscape,
    )
    return result
