"""Orchestration tests — pipeline ordering, Layer-3 parallelism, quality gate,
and cascade semantics, with generators mocked (no LLM calls, CI-safe).

Run with: PYTHONPATH=. pytest tests/ -v
"""

import asyncio
import shutil

import pytest

from backend import evaluator
from backend import pipeline as pipeline_mod
from backend.pipeline import Pipeline, OUTPUT_ROOT
from backend.agent import _diff_modules
from backend.modules.competitive import _norm


@pytest.fixture
def scratch(monkeypatch):
    ws = "_pytest_orch"
    target = OUTPUT_ROOT / ws
    if target.exists():
        shutil.rmtree(target)
    p = Pipeline(workspace=ws)
    yield p, monkeypatch
    shutil.rmtree(target, ignore_errors=True)


def _fake_modules(monkeypatch, log: list, overlap: dict | None = None):
    """Patch all four generators with order-recording fakes."""

    async def fake_cl(input_md, feedback=None):
        log.append("cl:start")
        await asyncio.sleep(0.01)
        log.append("cl:end")
        return {"summary": "s", "existingCompetitors": [
            {"id": "1", "name": "A", "rationale": "r"}]}

    async def fake_ao(input_md, cl, feedback=None):
        log.append("ao:start")
        await asyncio.sleep(0.01)
        log.append("ao:end")
        return {"summary": "s", "segments": [
            {"id": "s1", "segmentName": "Seg", "description": "d",
             "selectedExistingCompetitors": ["A"]}]}

    async def fake_pm(input_md, cl, ao, previous=None, feedback=None):
        log.append("pm:start")
        if overlap is not None:
            overlap["pm_started"].set()
            # Genuine parallelism check: wait for swot to have started too
            await asyncio.wait_for(overlap["swot_started"].wait(), timeout=2)
        await asyncio.sleep(0.01)
        log.append("pm:end")
        return {"xAxis": {"axisName": "x", "lowLabel": "l", "highLabel": "h"},
                "yAxis": {"axisName": "y", "lowLabel": "l", "highLabel": "h"},
                "positions": [{"id": "p1", "gameName": "G", "xPosition": 5, "yPosition": 5}]}

    async def fake_swot(input_md, cl, ao, feedback=None):
        log.append("swot:start")
        if overlap is not None:
            overlap["swot_started"].set()
            await asyncio.wait_for(overlap["pm_started"].wait(), timeout=2)
        await asyncio.sleep(0.01)
        log.append("swot:end")
        return {"strengths": [{"id": "1", "text": "t"}], "weaknesses": [],
                "opportunities": [], "threats": []}

    monkeypatch.setattr(pipeline_mod.competitive, "generate", fake_cl)
    monkeypatch.setattr(pipeline_mod.audience, "generate", fake_ao)
    monkeypatch.setattr(pipeline_mod.positioning, "generate", fake_pm)
    monkeypatch.setattr(pipeline_mod.swot, "generate", fake_swot)


def test_full_pipeline_order_and_parallelism(scratch):
    """L1 before L2 before L3; PM and SWOT genuinely overlap in time."""
    p, monkeypatch = scratch
    monkeypatch.setenv("QUALITY_GATE", "off")
    log: list = []
    overlap = {"pm_started": asyncio.Event(), "swot_started": asyncio.Event()}
    _fake_modules(monkeypatch, log, overlap)

    asyncio.run(p.generate_all("brief"))

    # Dependency order
    assert log.index("cl:end") < log.index("ao:start")
    assert log.index("ao:end") < log.index("pm:start")
    assert log.index("ao:end") < log.index("swot:start")
    # Parallelism: both L3 modules started before either finished
    # (enforced by the cross-wait in the fakes — sequential execution
    # would deadlock and time out)
    assert log.index("pm:start") < log.index("swot:end")
    assert log.index("swot:start") < log.index("pm:end")


def test_cascade_from_layer1_regenerates_all_downstream(scratch):
    p, monkeypatch = scratch
    monkeypatch.setenv("QUALITY_GATE", "off")
    log: list = []
    _fake_modules(monkeypatch, log)
    asyncio.run(p.generate_all("brief"))
    log.clear()

    regenerated = asyncio.run(p.cascade_update("competitiveLandscape", "brief"))

    assert set(regenerated) == {"audienceOverview", "positioningMatrix", "swot"}
    assert "cl:start" not in log  # the changed module itself is NOT regenerated
    assert log.index("ao:end") < log.index("pm:start")  # topological order


def test_cascade_from_layer2_skips_layer1(scratch):
    p, monkeypatch = scratch
    monkeypatch.setenv("QUALITY_GATE", "off")
    log: list = []
    _fake_modules(monkeypatch, log)
    asyncio.run(p.generate_all("brief"))
    log.clear()

    regenerated = asyncio.run(p.cascade_update("audienceOverview", "brief"))

    assert set(regenerated) == {"positioningMatrix", "swot"}
    assert "cl:start" not in log and "ao:start" not in log


def test_cascade_from_layer3_is_noop(scratch):
    p, monkeypatch = scratch
    monkeypatch.setenv("QUALITY_GATE", "off")
    log: list = []
    _fake_modules(monkeypatch, log)
    asyncio.run(p.generate_all("brief"))
    log.clear()

    assert asyncio.run(p.cascade_update("swot", "brief")) == []
    assert log == []


def test_quality_gate_regenerates_below_threshold(scratch):
    """Low judge score triggers one feedback-guided regeneration."""
    p, monkeypatch = scratch
    monkeypatch.setenv("QUALITY_GATE", "on")

    feedback_seen: list = []
    scores = iter([4.0, 9.0])

    async def fake_evaluate(module_name, data):
        return {"score": next(scores), "feedback": "be more specific"}

    async def fake_gen(feedback):
        feedback_seen.append(feedback)
        return {"summary": "s", "existingCompetitors": []}

    monkeypatch.setattr(evaluator, "evaluate", fake_evaluate)
    result = asyncio.run(p._gated("competitiveLandscape", fake_gen))

    assert feedback_seen == [None, "be more specific"]  # regen got the feedback
    assert p.get_quality("competitiveLandscape")["score"] == 9.0
    assert result["summary"] == "s"


def test_quality_gate_passes_first_try(scratch):
    p, monkeypatch = scratch
    monkeypatch.setenv("QUALITY_GATE", "on")
    calls: list = []

    async def fake_evaluate(module_name, data):
        return {"score": 8.5, "feedback": "solid"}

    async def fake_gen(feedback):
        calls.append(feedback)
        return {"ok": True}

    monkeypatch.setattr(evaluator, "evaluate", fake_evaluate)
    asyncio.run(p._gated("swot", fake_gen))

    assert calls == [None]  # no regeneration
    assert p.get_quality("swot")["score"] == 8.5


def test_workspace_isolation():
    """Two briefs never share module state."""
    a = Pipeline(workspace="_pytest_ws_a")
    b = Pipeline(workspace="_pytest_ws_b")
    try:
        a.update_module("competitiveLandscape", {"summary": "A", "existingCompetitors": []})
        assert b.get_module("competitiveLandscape") is None
        b.update_module("competitiveLandscape", {"summary": "B", "existingCompetitors": []})
        assert a.get_module("competitiveLandscape")["summary"] == "A"
    finally:
        shutil.rmtree(OUTPUT_ROOT / "_pytest_ws_a", ignore_errors=True)
        shutil.rmtree(OUTPUT_ROOT / "_pytest_ws_b", ignore_errors=True)


# ---------- Agent diff reporting ----------

def test_diff_modules_add_and_remove():
    old = {"existingCompetitors": [{"id": "1", "name": "Rust"}, {"id": "2", "name": "Valheim"}]}
    new = {"existingCompetitors": [{"id": "1", "name": "Rust"}, {"id": "3", "name": "Nightingale"}]}
    summary = _diff_modules("competitiveLandscape", old, new)
    assert "Nightingale" in summary and "Valheim" in summary
    assert "added" in summary and "removed" in summary


def test_diff_modules_created():
    assert _diff_modules("swot", None, {"strengths": []}) == "module created"


# ---------- Steam name normalization ----------

def test_steam_name_matching():
    assert _norm("ARK: Survival Evolved") == _norm("Ark - Survival Evolved")
    assert _norm("Stardew Valley") in _norm("Stardew Valley (PC)")
    assert _norm("Rust") != _norm("Trust")
