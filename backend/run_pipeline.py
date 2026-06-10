"""CLI entry point — run the full GTM pipeline."""

import asyncio
import sys
from pathlib import Path

from backend.pipeline import Pipeline


def status_callback(module: str, status: str):
    print(f"  [{status.upper():>10}] {module}")


async def main():
    input_path = Path(__file__).parent.parent / "input.md"
    if not input_path.exists():
        print("Error: input.md not found")
        sys.exit(1)

    input_md = input_path.read_text()
    pipeline = Pipeline(on_status=status_callback)

    print("Starting GTM pipeline...\n")
    state = await pipeline.generate_all(input_md)

    print("\nPipeline complete. Modules saved to output/")
    print(f"  - CompetitiveLandscape: {len(state.competitiveLandscape['existingCompetitors'])} competitors")
    print(f"  - AudienceOverview: {len(state.audienceOverview['segments'])} segments")
    print(f"  - PositioningMatrix: {len(state.positioningMatrix['positions'])} positions")
    sw = state.swot
    total_swot = len(sw["strengths"]) + len(sw["weaknesses"]) + len(sw["opportunities"]) + len(sw["threats"])
    print(f"  - SWOT: {total_swot} items")


if __name__ == "__main__":
    asyncio.run(main())
