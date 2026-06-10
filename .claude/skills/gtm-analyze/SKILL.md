---
name: gtm-analyze
description: Generate a complete Go-To-Market analysis (CompetitiveLandscape, AudienceOverview, PositioningMatrix, SWOT) for the game described in inputs/input.md. Use when the user asks to run the GTM pipeline, generate the GTM analysis, or analyze the game brief.
---

# GTM Analyze

Generate a complete Go-To-Market analysis for a game based on `inputs/input.md`.

## What This Skill Does

Reads `inputs/input.md` (a game brief) and produces four structured GTM analysis modules:

1. **CompetitiveLandscape** (Layer 1) — Identifies 10-15 real competing games with rationale
2. **AudienceOverview** (Layer 2) — Defines 3-5 audience segments grounded in the competitive landscape
3. **PositioningMatrix** (Layer 3) — Plots the game on two strategic axes against competitors
4. **SWOT** (Layer 3) — Strengths, weaknesses, opportunities, and threats grounded in competitive/audience data

## Inputs

- `inputs/input.md` — the game brief to analyze (additional briefs can sit alongside it in `inputs/`)
- `OPENAI_API_KEY` — read from environment or from `.env` in the project root

## Outputs

JSON files written to `output/input/` (one workspace folder per brief):
- `output/input/competitiveLandscape.json`
- `output/input/audienceOverview.json`
- `output/input/positioningMatrix.json`
- `output/input/swot.json`

## How to Run

From the project root (the directory containing `inputs/` and `backend/`):

```bash
PYTHONPATH=. python3 -m backend.run_pipeline
```

If dependencies are missing, install them first:

```bash
pip install openai pydantic python-dotenv fastapi uvicorn
```

After the run completes, report the module counts printed by the script and offer to show any module's content from `output/`.

## Execution Order (enforced by the pipeline)

- Layer 1 (CompetitiveLandscape) runs first
- Layer 2 (AudienceOverview) runs after Layer 1
- Layer 3 (PositioningMatrix + SWOT) run **in parallel** via `asyncio.gather` after Layer 2

## Cascade Updates

After editing any module JSON in `output/`, regenerate only the affected downstream modules:

```bash
PYTHONPATH=. python3 -m backend.run_cascade competitiveLandscape
```

The cascade engine walks the reverse dependency graph (BFS), regenerates affected modules in topological order, and runs Layer 3 modules in parallel.

## Methodology

Each module uses a **two-step generation** approach: a reasoning call analyzes the input and upstream modules in free text, then a structuring call converts that analysis into the target JSON schema. CompetitiveLandscape adds a **self-critique** pass that reviews coverage gaps and refines if needed. AudienceOverview programmatically validates that all competitor references exist in CompetitiveLandscape.
