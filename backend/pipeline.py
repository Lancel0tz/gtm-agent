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
from backend import evaluator

OUTPUT_ROOT = Path(__file__).parent.parent / "output"

DEPENDENCY_GRAPH: dict[str, list[str]] = {
    "competitiveLandscape": [],
    "audienceOverview": ["competitiveLandscape"],
    "positioningMatrix": ["competitiveLandscape", "audienceOverview"],
    "swot": ["competitiveLandscape", "audienceOverview"],
}

# Which key identifies an item in each list field, for change tracking
LIST_LABEL_KEYS: dict[str, str] = {
    "existingCompetitors": "name",
    "segments": "segmentName",
    "positions": "gameName",
    "strengths": "text",
    "weaknesses": "text",
    "opportunities": "text",
    "threats": "text",
}


class Pipeline:
    """One Pipeline serves multiple input briefs. Each brief gets its own
    workspace directory under output/<input-stem>/ holding its module JSONs
    and an accumulated change log."""

    def __init__(self, on_status: Callable | None = None, workspace: str = "input"):
        self.on_status = on_status or (lambda module, status: None)
        OUTPUT_ROOT.mkdir(exist_ok=True)
        self._migrate_legacy_layout()
        self.switch_workspace(workspace)

    @staticmethod
    def _migrate_legacy_layout():
        """Move flat output/*.json (pre-workspace layout) into output/input/."""
        legacy = [OUTPUT_ROOT / f"{m}.json" for m in DEPENDENCY_GRAPH]
        if any(p.exists() for p in legacy):
            target = OUTPUT_ROOT / "input"
            target.mkdir(exist_ok=True)
            for p in legacy:
                if p.exists():
                    p.rename(target / p.name)

    def switch_workspace(self, workspace: str):
        """Point the pipeline at a different input brief's module set."""
        self.workspace = workspace
        self.output_dir = OUTPUT_ROOT / workspace
        self.output_dir.mkdir(exist_ok=True)
        self.state = PipelineState()
        # Accumulated change log per module: {"added": {field: [labels]},
        # "removed": {field: [items]}} — survives across chat rounds
        self.changes: dict[str, dict] = {m: {"added": {}, "removed": {}} for m in DEPENDENCY_GRAPH}
        # Prior generations per module: [{ts, data}], oldest first, capped
        self.versions: dict[str, list] = {m: [] for m in DEPENDENCY_GRAPH}
        # Latest LLM-judge review per module: {score, feedback}
        self.quality: dict[str, dict] = {}
        self._load_existing()

    def _load_existing(self):
        for module_name in DEPENDENCY_GRAPH:
            path = self.output_dir / f"{module_name}.json"
            if path.exists():
                setattr(self.state, module_name, json.loads(path.read_text()))
        changes_path = self.output_dir / "_changes.json"
        if changes_path.exists():
            self.changes.update(json.loads(changes_path.read_text()))
        versions_path = self.output_dir / "_versions.json"
        if versions_path.exists():
            self.versions.update(json.loads(versions_path.read_text()))
        quality_path = self.output_dir / "_quality.json"
        if quality_path.exists():
            self.quality.update(json.loads(quality_path.read_text()))

    def _save_module(self, module_name: str, data: dict, record_changes: bool = False):
        """Persist a module. Change history is recorded only for direct user
        edits — a regenerated module is re-derived from scratch, so item-level
        diffs against its old version are noise, and its log is reset."""
        import time as _time
        old = getattr(self.state, module_name, None)
        if old is not None and old != data:
            self.versions[module_name].append({"ts": _time.time(), "data": old})
            self.versions[module_name] = self.versions[module_name][-10:]
            (self.output_dir / "_versions.json").write_text(
                json.dumps(self.versions, indent=2, ensure_ascii=False)
            )
        if record_changes:
            self._record_changes(module_name, old, data)
        else:
            self.changes[module_name] = {"added": {}, "removed": {}}
        setattr(self.state, module_name, data)
        path = self.output_dir / f"{module_name}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        (self.output_dir / "_changes.json").write_text(
            json.dumps(self.changes, indent=2, ensure_ascii=False)
        )

    def _record_changes(self, module_name: str, old: dict | None, new: dict):
        """Track added labels and removed items per list field, accumulated
        across rounds. A wholesale regeneration (less than half the items
        surviving) resets the log for that field — diffs against content
        that no longer exists are noise, not history."""
        log = self.changes[module_name]
        if old is None:
            return

        for field, label_key in LIST_LABEL_KEYS.items():
            old_list = old.get(field)
            new_list = new.get(field)
            if not isinstance(old_list, list) or not isinstance(new_list, list):
                continue

            old_labels = {str(i[label_key]) for i in old_list if isinstance(i, dict)}
            new_labels = {str(i[label_key]) for i in new_list if isinstance(i, dict)}
            if old_labels == new_labels:
                continue

            surviving = len(old_labels & new_labels)
            if old_labels and surviving / len(old_labels) < 0.5:
                # Regeneration — reset history for this field
                log["added"].pop(field, None)
                log["removed"].pop(field, None)
                continue

            added_now = new_labels - old_labels
            removed_now = [i for i in old_list
                           if isinstance(i, dict) and str(i[label_key]) not in new_labels]

            added_log = set(log["added"].get(field, [])) | added_now
            # An item re-added later is no longer "removed"; one removed later
            # is no longer "new"
            added_log -= {str(i[label_key]) for i in removed_now}
            removed_log = [i for i in log["removed"].get(field, [])
                           if str(i[label_key]) not in new_labels]
            existing_removed = {str(i[label_key]) for i in removed_log}
            removed_log += [i for i in removed_now
                            if str(i[label_key]) not in existing_removed]

            log["added"][field] = sorted(added_log & new_labels)
            log["removed"][field] = removed_log[-5:]  # cap the strikethrough list

    def snapshot(self) -> dict:
        """Deep snapshot of all modules + change logs, for undo."""
        import copy
        return {
            "modules": {m: copy.deepcopy(getattr(self.state, m, None)) for m in DEPENDENCY_GRAPH},
            "changes": copy.deepcopy(self.changes),
        }

    def restore(self, snap: dict):
        """Restore a snapshot taken by snapshot() — modules, files, and logs."""
        for name, data in snap["modules"].items():
            setattr(self.state, name, data)
            path = self.output_dir / f"{name}.json"
            if data is None:
                path.unlink(missing_ok=True)
            else:
                path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        self.changes = snap["changes"]
        (self.output_dir / "_changes.json").write_text(
            json.dumps(self.changes, indent=2, ensure_ascii=False)
        )

    async def _gated(self, module_name: str, generate_fn) -> dict:
        """Run generation through the LLM-judge quality gate.

        generate_fn(feedback) -> module dict. Below-threshold output is
        regenerated ONCE with the judge's feedback, then re-scored.
        """
        result = await generate_fn(None)
        if not evaluator.enabled():
            return result

        self.on_status(module_name, "reviewing")
        review = await evaluator.evaluate(module_name, result)

        if review["score"] < evaluator.QUALITY_THRESHOLD:
            self.on_status(module_name, "generating")
            result = await generate_fn(review["feedback"])
            self.on_status(module_name, "reviewing")
            review = await evaluator.evaluate(module_name, result)

        self.quality[module_name] = review
        (self.output_dir / "_quality.json").write_text(
            json.dumps(self.quality, indent=2, ensure_ascii=False)
        )
        return result

    def get_quality(self, module_name: str) -> dict | None:
        """Latest LLM-judge review for a module, if the gate has run."""
        return self.quality.get(module_name)

    def get_versions(self, module_name: str) -> list:
        """Prior generations of a module, oldest first."""
        return self.versions.get(module_name, [])

    def get_changes(self, module_name: str) -> dict:
        """Accumulated additions/removals for a module across chat rounds."""
        return self.changes.get(module_name, {"added": {}, "removed": {}})

    async def generate_all(self, input_md: str) -> PipelineState:
        """Run the full pipeline: L1 → L2 → L3 (parallel)."""

        # Layer 1: CompetitiveLandscape
        self.on_status("competitiveLandscape", "generating")
        cl = await self._gated("competitiveLandscape",
                               lambda fb: competitive.generate(input_md, feedback=fb))
        self._save_module("competitiveLandscape", cl)
        self.on_status("competitiveLandscape", "done")

        # Layer 2: AudienceOverview
        self.on_status("audienceOverview", "generating")
        ao = await self._gated("audienceOverview",
                               lambda fb: audience.generate(input_md, cl, feedback=fb))
        self._save_module("audienceOverview", ao)
        self.on_status("audienceOverview", "done")

        # Layer 3: PositioningMatrix + SWOT (parallel)
        self.on_status("positioningMatrix", "generating")
        self.on_status("swot", "generating")

        pm_task = self._gated("positioningMatrix",
                              lambda fb: positioning.generate(input_md, cl, ao, feedback=fb))
        swot_task = self._gated("swot",
                                lambda fb: swot.generate(input_md, cl, ao, feedback=fb))
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
        """Regenerate a single module (quality-gated) using current state."""
        cl = self.state.competitiveLandscape
        ao = self.state.audienceOverview

        if module_name == "competitiveLandscape":
            return await self._gated(module_name,
                                     lambda fb: competitive.generate(input_md, feedback=fb))
        elif module_name == "audienceOverview":
            return await self._gated(module_name,
                                     lambda fb: audience.generate(input_md, cl, feedback=fb))
        elif module_name == "positioningMatrix":
            prev = self.state.positioningMatrix
            # Competitors just added to the landscape must make it onto the map
            just_added = list(
                self.changes.get("competitiveLandscape", {})
                    .get("added", {}).get("existingCompetitors", [])
            )
            return await self._gated(module_name,
                                     lambda fb: positioning.generate(
                                         input_md, cl, ao, previous=prev,
                                         feedback=fb, must_include=just_added))
        elif module_name == "swot":
            return await self._gated(module_name,
                                     lambda fb: swot.generate(input_md, cl, ao, feedback=fb))
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
        """Directly update a module (for user edits) — records change history."""
        self._save_module(module_name, data, record_changes=True)
