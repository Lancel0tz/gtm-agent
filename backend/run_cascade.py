"""CLI entry point — cascade update after a module change."""

import asyncio
import sys
from pathlib import Path

from backend.pipeline import Pipeline


def status_callback(module: str, status: str):
    print(f"  [{status.upper():>10}] {module}")


async def main():
    if len(sys.argv) < 2:
        print("Usage: python -m backend.run_cascade <module_name>")
        print("Modules: competitiveLandscape, audienceOverview, positioningMatrix, swot")
        sys.exit(1)

    changed_module = sys.argv[1]
    input_path = Path(__file__).parent.parent / "inputs" / "input.md"
    input_md = input_path.read_text()

    pipeline = Pipeline(on_status=status_callback)

    if pipeline.get_module(changed_module) is None:
        print(f"Error: {changed_module} has not been generated yet. Run the full pipeline first.")
        sys.exit(1)

    print(f"Cascading from {changed_module}...\n")
    regenerated = await pipeline.cascade_update(changed_module, input_md)

    if not regenerated:
        print("No downstream modules affected.")
    else:
        print(f"\nRegenerated: {', '.join(regenerated)}")


if __name__ == "__main__":
    asyncio.run(main())
