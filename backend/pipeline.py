"""GTM Pipeline Orchestrator.

Manages module generation with dependency ordering and parallel execution.
Also handles cascade updates when upstream modules change.
"""

import asyncio
import json
from pathlib import Path
from typing import Callable

from backend.schemas import PipelineState
from backend.modules import competitive, audience, positioning, swot

OUTPUT_DIR = Path(__file__).parent.parent / "output"

DEPENDENCY_GRAPH: dict[str, list[str]] = {
    "competitiveLandscape": [],
    "audienceOverview": ["competitiveLandscape"],
    "positioningMatrix": ["competitiveLandscape", "audienceOverview"],
    "swot": ["competitiveLandscape", "audienceOverview"],
}


class Pipeline:
    def __init__(self, on_status: Callable | None = None):
        self.state = PipelineState()
        self.on_status = on_status or (lambda module, status: None)
        OUTPUT_DIR.mkdir(exist_ok=True)
        self._load_existing()

    def _load_existing(self):
        """Load any previously generated modules from output/."""
        for module_name in DEPENDENCY_GRAPH:
            path = OUTPUT_DIR / f"{module_name}.json"
            if path.exists():
                data = json.loads(path.read_text())
                setattr(self.state, module_name, data)

    def _save_module(self, module_name: str, data: dict):
        """Persist a module to disk."""
        setattr(self.state, module_name, data)
        path = OUTPUT_DIR / f"{module_name}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    async def generate_all(self, input_md: str) -> PipelineState:
        """Run the full pipeline: L1 → L2 → L3 (parallel)."""

        # Layer 1: CompetitiveLandscape
        self.on_status("competitiveLandscape", "generating")
        cl = await competitive.generate(input_md)
        self._save_module("competitiveLandscape", cl)
        self.on_status("competitiveLandscape", "done")

        # Layer 2: AudienceOverview
        self.on_status("audienceOverview", "generating")
        ao = await audience.generate(input_md, cl)
        self._save_module("audienceOverview", ao)
        self.on_status("audienceOverview", "done")

        # Layer 3: PositioningMatrix + SWOT (parallel)
        self.on_status("positioningMatrix", "generating")
        self.on_status("swot", "generating")

        pm_task = positioning.generate(input_md, cl, ao)
        swot_task = swot.generate(input_md, cl, ao)
        pm_result, swot_result = await asyncio.gather(pm_task, swot_task)

        self._save_module("positioningMatrix", pm_result)
        self.on_status("positioningMatrix", "done")
        self._save_module("swot", swot_result)
        self.on_status("swot", "done")

        return self.state

    async def cascade_update(self, changed_module: str, input_md: str) -> list[str]:
        """Regenerate downstream modules affected by a change.

        Returns the list of modules that were regenerated.
        """
        affected = self._get_affected_downstream(changed_module)
        if not affected:
            return []

        # Sort by layer to respect dependency order
        layer_order = {
            "competitiveLandscape": 0,
            "audienceOverview": 1,
            "positioningMatrix": 2,
            "swot": 2,
        }
        affected.sort(key=lambda m: layer_order.get(m, 99))

        regenerated = []
        i = 0
        while i < len(affected):
            # Collect all modules at the same layer for parallel execution
            current_layer = layer_order[affected[i]]
            parallel_batch = []
            while i < len(affected) and layer_order[affected[i]] == current_layer:
                parallel_batch.append(affected[i])
                i += 1

            # Generate the batch in parallel
            tasks = []
            for module_name in parallel_batch:
                self.on_status(module_name, "generating")
                tasks.append(self._regenerate_module(module_name, input_md))

            results = await asyncio.gather(*tasks)

            for module_name, result in zip(parallel_batch, results):
                self._save_module(module_name, result)
                self.on_status(module_name, "done")
                regenerated.append(module_name)

        return regenerated

    async def _regenerate_module(self, module_name: str, input_md: str) -> dict:
        """Regenerate a single module using current state for its dependencies."""
        cl = self.state.competitiveLandscape
        ao = self.state.audienceOverview

        if module_name == "competitiveLandscape":
            return await competitive.generate(input_md)
        elif module_name == "audienceOverview":
            return await audience.generate(input_md, cl)
        elif module_name == "positioningMatrix":
            return await positioning.generate(input_md, cl, ao)
        elif module_name == "swot":
            return await swot.generate(input_md, cl, ao)
        else:
            raise ValueError(f"Unknown module: {module_name}")

    def _get_affected_downstream(self, changed_module: str) -> list[str]:
        """BFS to find all modules that transitively depend on changed_module."""
        reverse_deps: dict[str, list[str]] = {m: [] for m in DEPENDENCY_GRAPH}
        for module, deps in DEPENDENCY_GRAPH.items():
            for dep in deps:
                reverse_deps[dep].append(module)

        affected = []
        queue = list(reverse_deps.get(changed_module, []))
        visited = set()

        while queue:
            module = queue.pop(0)
            if module in visited:
                continue
            visited.add(module)
            affected.append(module)
            queue.extend(reverse_deps.get(module, []))

        return affected

    def get_module(self, module_name: str) -> dict | None:
        """Read a specific module's current state."""
        return getattr(self.state, module_name, None)

    def update_module(self, module_name: str, data: dict):
        """Directly update a module (for user edits)."""
        self._save_module(module_name, data)
