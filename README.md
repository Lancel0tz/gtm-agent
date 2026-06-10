# GTM Agent — Go-To-Market Analysis System

A multi-tier GTM analysis system for indie game publishers. Given a game brief, it produces structured analysis modules (CompetitiveLandscape, AudienceOverview, PositioningMatrix, SWOT) and supports interactive refinement through a conversational agent.

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
