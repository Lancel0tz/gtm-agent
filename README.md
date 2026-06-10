# GTM Agent — Go-To-Market Analysis System

A multi-tier GTM analysis system for indie game publishers. Given a game brief (in `inputs/`), it produces structured analysis modules (CompetitiveLandscape, AudienceOverview, PositioningMatrix, SWOT) and supports interactive refinement through a conversational agent.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key

### Setup

```bash
# Clone and enter the project
git clone <repo-url> && cd take-home-project

# Set your API key
export OPENAI_API_KEY="your-key-here"

# Install Python dependencies
pip install openai pydantic fastapi uvicorn

# Install frontend dependencies
cd frontend && npm install && cd ..
```

## Running Each Tier

### Tier 1 — Pipeline (Claude Code Skill)

The skill is located at `.claude/skills/gtm-analyze/SKILL.md`. To run the pipeline directly:

```bash
PYTHONPATH=. python -m backend.run_pipeline
```

This generates all 4 modules in dependency order (Layer 1 → Layer 2 → Layer 3 parallel) and saves them to `output/`.

### Tier 2 — Cascade Updates

After modifying a module JSON file in `output/`, trigger cascade:

```bash
PYTHONPATH=. python -m backend.run_cascade competitiveLandscape
```

Only downstream modules are regenerated, in topological order. Layer 3 modules run in parallel during cascade.

### Tier 3 — Conversational Agent (API)

```bash
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

The agent handles:
- `"Generate the full GTM analysis"` → runs full pipeline
- `"What does the positioning say?"` → reads a module
- `"Add Nightingale as a competitor"` → updates + cascades

### Tier 4 — Three-Column Frontend

```bash
# Terminal 1: Backend
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open http://localhost:5173. The three-column layout shows Input (left), Canvas (middle), Chat (right). Module cards update in real-time via SSE as the agent generates or cascades.

## Architecture

```
input.md → Pipeline Orchestrator → output/*.json
                ↓
    L1: CompetitiveLandscape
    L2: AudienceOverview (depends on L1)
    L3: PositioningMatrix ┐ parallel (depends on L1 + L2)
        SWOT              ┘
```

### Design Decisions

**Two-step generation methodology**: Each module uses a "reason then structure" approach — the LLM first analyzes the problem in free text, then a second call formats the reasoning into the target JSON schema. This separation produces higher-quality outputs than a single prompt because the model can think freely before being constrained by structure.

**Self-critique for CompetitiveLandscape**: Layer 1 includes a third step where the model reviews its own output for coverage gaps and biases, refining if needed. This catches blind spots that a single generation pass would miss.

**Reference validation**: AudienceOverview programmatically validates that `selectedExistingCompetitors` references only names that exist in CompetitiveLandscape, ensuring structural integrity across the dependency graph.

**Custom ReAct agent**: Built from raw OpenAI function calling rather than a framework (LangChain, etc.), making the reasoning loop fully transparent and explainable. The agent classifies intent, selects tools, observes results, and responds — each step is visible in the code.

**Selective cascade with diff reporting**: The cascade engine uses BFS on the reverse dependency graph to identify only affected modules, then regenerates them layer by layer (Layer 3 in parallel). After an update, the agent reports both which modules were affected and a field-level diff of what changed (e.g. "added to existingCompetitors: Nightingale").

**True real-time canvas**: Module status events (`generating` / `done`) are pushed over SSE the moment they happen inside the pipeline — not after the agent's turn completes. The canvas shows each card's progress live during generation and cascades.

**Validation retry loop**: Structured outputs are validated against Pydantic schemas; on malformed JSON or schema mismatch, the error is fed back to the model for up to 2 corrective retries, keeping the pipeline robust off the happy path.

### Quality & Grounding

- **LLM-as-judge quality gate**: after each module generates, an independent judge call scores it 0-10 against module-specific rubrics (real games only, behavioral segmentation, insightful axes, specific SWOT items). Below 7.0, the module regenerates once with the judge's feedback folded into the prompt. Scores appear as chips on module cards; disable with `QUALITY_GATE=off`.
- **Steam grounding**: every competitor is checked against the Steam store search API after generation — verified titles get a badge + appId, misses are flagged (not removed; console exclusives are real games too). Fail-open on network errors.
- **Provider switch**: module generation runs on OpenAI (GPT-4o) or Anthropic (Claude Opus 4.8), switchable at runtime from the header. The agent's tool-calling loop stays on OpenAI function calling.
- **Streaming**: agent replies stream token-by-token over SSE into the chat; module status, judge reviews, and cascades all render live.
- **Versioning + diff**: each module keeps its last 10 generations; the detail view can browse them with an added/removed diff against the current version.
- **Export**: one-click Markdown report (competitors with Steam verification, segments, both positioning lenses, SWOT, judge scores) via the header download button.

### Security Hardening

- **Prompt injection defense**: brief content is wrapped in `<game_brief>` delimiters with an explicit data-not-instructions notice in every module prompt; the agent's system prompt instructs it to flag (not follow) instructions embedded in briefs or module content
- **Tool output validation**: every module update from the agent is validated against its Pydantic schema before touching disk; audience updates additionally have cross-references checked against the landscape (invalid refs dropped and reported)
- **API surface**: module names whitelisted (no attribute probing via `getattr`), message length capped, CORS restricted to the local frontend origin, input-file selection matched against an allowlist (no path traversal)
- **Stop safety**: cancelling a generation rolls partial module writes back to the pre-turn snapshot and truncates dangling tool calls from the LLM history

### Testing

```bash
PYTHONPATH=. pytest tests/ -v
```

23 boundary tests covering: cascade graph correctness (affected sets, acyclicity), change-log accumulation and reset semantics, version-history capping, snapshot/restore round-trips, LLM output parsing (fenced/garbage/schema-mismatch), cross-module reference integrity, injection wrapping, and API edge behavior (unknown modules/threads, oversized messages, attribute probes, path traversal, stop/undo no-ops).

### Trade-offs

- **OpenAI over Anthropic**: Chose OpenAI for API availability. The LLM abstraction layer (`llm.py`) makes it easy to swap providers.
- **SSE over WebSocket**: Simpler for unidirectional server→client updates. WebSocket would be needed for streaming agent responses, which isn't implemented yet.
- **No external data sources**: Competitive analysis relies on the LLM's training data rather than live market data. A production system would integrate Steam API, SteamSpy, etc.

## Project Structure

```
.claude/skills/gtm-analyze/   # Tier 1: Claude Code Skill
backend/
  schemas.py                   # Pydantic models for all modules
  llm.py                       # LLM client abstraction
  pipeline.py                  # Orchestrator + cascade engine
  agent.py                     # ReAct conversational agent
  main.py                      # FastAPI server
  modules/                     # Per-module generation logic
    competitive.py             # Layer 1 with self-critique
    audience.py                # Layer 2 with reference validation
    positioning.py             # Layer 3
    swot.py                    # Layer 3
frontend/                      # React + TypeScript + Tailwind
  src/
    components/
      InputPanel.tsx           # Left column
      Canvas.tsx               # Middle column
      ModuleCard.tsx           # Individual module display
      ChatPanel.tsx            # Right column chat interface
```
