# GTM Agent — Go-To-Market Analysis System

![tests](https://img.shields.io/badge/tests-52%20passed-brightgreen)
![python](https://img.shields.io/badge/backend-FastAPI%20%2B%20Python%203.11-blue)
![react](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript%20%2B%20Tailwind-61dafb)
![providers](https://img.shields.io/badge/LLM-OpenAI%20·%20Anthropic%20·%20DeepSeek%20·%20Gemini-8A2BE2)

**GTM Agent is an AI analyst for game publishers.** Drop in a short brief describing a game — its genre, platform, price — and it researches the competitive market and writes a complete go-to-market analysis: who you're competing with, who your players are, where you sit on the strategic map, and your strengths, weaknesses, opportunities, and threats.

The analysis isn't a static report. It's a **living document you talk to**: tell the chat agent *"add Nightingale as a competitor"* and it updates the competitive landscape, then automatically rewrites every downstream section that depends on it — while you watch each card regenerate in real time. Disagree with a change? One click undoes it, modules and all.

> 🎬 **Full demo (4 min, with narration)** — generating the analysis, chat-driven cascade updates with live parallel regeneration, quality reviews and Steam verification, cross-module exploration, quoting, undo, and export:

https://github.com/user-attachments/assets/ab85ec69-2070-409f-a655-0ab848491838

### What makes it more than a wrapper around an LLM

- **It checks its own work.** Every section is scored by an independent AI judge against a per-section rubric; weak output is regenerated with the judge's feedback. Scores are shown on each card.
- **It doesn't hallucinate games.** Every competitor is verified against the real Steam store — verified titles get a ✓ badge, misses get flagged (not deleted: console exclusives are real competitors too).
- **It understands dependencies.** The four sections form a dependency graph. Edits cascade to exactly the affected sections, in the right order, never more.
- **Every change is accountable.** Removed items stay visible as strikethrough, new items get badges, every section keeps its last 10 versions with diffs, and any chat turn can be undone, regenerated, or edited — state and conversation revert together.
- **The chat feels like ChatGPT.** Streaming replies, multiple named conversations, quote anything on the page (select text or click a section), stop generation mid-flight — with partial changes safely rolled back.
- **Bring your own model.** Eleven models across OpenAI, Anthropic, DeepSeek, and Gemini, switchable at runtime; paste API keys in the UI (stored locally, never echoed back).
- **It's hardened and proven.** Prompt-injection defenses, schema validation on every write, path-traversal and key-leak protections — each one verified by a named test in the 52-test suite, including one that *deadlocks if parallel execution were faked*.

Below: how to run it, then the technical deep-dive.

---

## Table of Contents

| | |
|---|---|
| **Get oriented** | [System Overview](#system-overview) · [Assignment Coverage](#assignment-coverage) |
| **Run it** | [Quick Start](#quick-start) · [Running Each Tier](#running-each-tier) |
| **How it works** | [Architecture](#architecture) · [Generation Methodology](#generation-methodology) · [Cascade Engine](#cascade-engine) · [How the Agent Decides What to Do](#how-the-agent-decides-what-to-do) · [Chat Primitives](#the-chat-systems-three-primitives) · [Multi-Provider Design](#multi-provider-design) |
| **Verified** | [Security Model](#security-model) · [Testing](#testing) |
| **Reflections** | [Design Details Worth Noticing](#design-details-worth-noticing) · [Extending It](#extending-it) · [Trade-offs](#trade-offs) |

---

## System Overview

Given a game brief (`inputs/*.md`), the system generates four structured GTM modules with a **fixed dependency DAG**, then lets you refine them through a chat agent that understands the graph — change an upstream module and every affected downstream module regenerates, in topological order, with Layer 3 in parallel.

```mermaid
flowchart LR
    subgraph Browser["React Frontend"]
        I[Input Panel<br/>brief switcher] 
        C[Canvas<br/>4 live module cards]
        CH[Chat<br/>streaming agent]
    end
    subgraph Server["FastAPI Backend"]
        A[ReAct Agent<br/>tool-calling loop]
        P[Pipeline Orchestrator<br/>DAG + quality gate]
        T[Thread Store<br/>snapshots · undo]
    end
    subgraph LLM["LLM Providers"]
        O[OpenAI] 
        AN[Anthropic]
        D[DeepSeek]
        G[Gemini]
    end
    S[(Steam Store API<br/>grounding)]
    CH -->|POST /api/chat| A
    A --> P
    A --> T
    P -->|verify competitors| S
    P --> LLM
    A --> LLM
    P -.->|SSE: status / tokens / updates| C
    I -->|switch brief| Server
```

## Assignment Coverage

| Tier | Requirement | Where | Beyond the requirement |
|------|-------------|-------|------------------------|
| **1** | Pipeline as a Claude Code skill, L1→L2→L3 order, L3 parallel | [`.claude/skills/gtm-analyze/`](.claude/skills/gtm-analyze/SKILL.md), [`backend/pipeline.py`](backend/pipeline.py) | Parallelism is **proven by a test that deadlocks if execution were sequential** |
| **2** | Cascade updates, topological order, affected-only | [`backend/pipeline.py`](backend/pipeline.py) `cascade_update` | Field-level diff reporting; accumulated change history rendered as strikethrough/new badges |
| **3** | Conversational agent from raw LLM API | [`backend/agent.py`](backend/agent.py) | Custom ReAct loop, streamed. All four required scenarios: *generate full analysis* / *update field → cascade* / *read a module* ("what does the positioning say?") / ambiguous & out-of-scope requests answered gracefully |
| **4** | Three-column real-time frontend | [`frontend/src/`](frontend/src) | Multi-thread chat with undo/regenerate/edit/quote/stop; dark mode; version history with diffs |

---

## Quick Start

```bash
git clone https://github.com/Lancel0tz/gtm-agent.git && cd gtm-agent

# Python 3.11+ required (tested on 3.12) — conda recommended:
conda create -n gtm-agent python=3.12 -y && conda activate gtm-agent
pip install openai anthropic httpx pydantic python-dotenv fastapi uvicorn pytest

# Frontend (Node 18+) — if zsh says "command not found: npm" and you use nvm,
# load it first: source ~/.nvm/nvm.sh
cd frontend && npm install && cd ..

export OPENAI_API_KEY="sk-..."   # or paste keys later in the in-app settings (⚙)

# Terminal 1 — backend
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
# Terminal 2 — frontend
cd frontend && npm run dev       # → http://localhost:5173
```

> No conda? Any Python 3.11+ works: `python3 -m venv .venv && source .venv/bin/activate`, then the same `pip install`.

Try, in order: **"Generate the full GTM analysis"** → watch the four cards stream through generating/reviewing → **"Add Nightingale as a competitor"** → watch the cascade → click a competitor for its cross-module card → select any text → **Quote in chat** → hit **undo** under the agent's reply.

## Running Each Tier

| Tier | Command |
|---|---|
| 1 — Pipeline / skill | `PYTHONPATH=. python -m backend.run_pipeline` (or `/gtm-analyze` in Claude Code; skill at [`.claude/skills/gtm-analyze/`](.claude/skills/gtm-analyze/SKILL.md)) |
| 2 — Cascade CLI | `PYTHONPATH=. python -m backend.run_cascade competitiveLandscape` |
| 3 — Agent API | backend running, then: `curl -X POST localhost:8000/api/chat -H 'Content-Type: application/json' -d '{"message": "What does the positioning say?"}'` |
| 4 — Frontend | backend + `cd frontend && npm run dev` |

Sample outputs for two briefs (Dune: Awakening and a contrasting cozy farming sim, Moonhaven) are committed under [`output/`](output) so the result quality is inspectable without running anything.

---

## Architecture

### The dependency DAG

```mermaid
flowchart TD
    IN[/"inputs/input.md<br/>(untrusted document)"/]
    CL["CompetitiveLandscape<br/><i>Layer 1 — 10-15 real games</i>"]
    AO["AudienceOverview<br/><i>Layer 2 — 3-5 behavioral segments</i>"]
    PM["PositioningMatrix<br/><i>Layer 3 — primary + 2 alternative lenses</i>"]
    SW["SWOT<br/><i>Layer 3 — grounded in upstream data</i>"]
    IN --> CL
    IN --> AO
    CL --> AO
    CL --> PM
    AO --> PM
    CL --> SW
    AO --> SW
    PM ~~~ SW
    style PM fill:#dbeafe,stroke:#3b82f6
    style SW fill:#dbeafe,stroke:#3b82f6
```

Layer 3 (blue) runs under `asyncio.gather` — genuinely concurrent, not just "two calls in a row". The dependency edges are *structural*, not stylistic: `AudienceOverview.segments[].selectedExistingCompetitors` must reference names that exist in `CompetitiveLandscape`, and the backend **validates and prunes invalid references** on every write path (generation *and* agent edits).

### Per-brief workspaces

Every brief in `inputs/` gets an isolated workspace under `output/<brief-stem>/` holding its module JSONs, change log, version history, and quality reviews. Switching briefs in the UI swaps the entire canvas, chat thread, and agent context — two games never bleed into each other (covered by `test_workspace_isolation`).

---

## Generation Methodology

The evaluation brief asks: *"a single dump prompt or something more considered?"* Each module goes through up to **five distinct stages**:

```mermaid
flowchart LR
    R["1 · Reason<br/><i>free-text analysis,<br/>unconstrained by schema</i>"]
    S["2 · Structure<br/><i>separate call converts<br/>reasoning → JSON schema</i>"]
    SC["3 · Self-critique<br/><i>coverage gaps, balance<br/>(Layer 1 only)</i>"]
    J{"4 · LLM Judge<br/><i>independent context,<br/>module-specific rubric</i>"}
    G["5 · Ground<br/><i>verify vs Steam store<br/>(Layer 1 only)</i>"]
    OK[("persist")]
    R --> S --> SC --> J
    J -->|"score ≥ 7"| G --> OK
    J -->|"score < 7"| FB["regenerate once<br/>with judge feedback"] --> J
```

The prompts themselves live in [`backend/modules/`](backend/modules) (one file per module) and are written to be read. Why each stage exists:

1. **Reason-then-structure** — models think better in prose than inside a JSON straitjacket. Splitting the calls measurably improves rationale specificity.
2. **Schema validation with retry** — every structured output is validated against Pydantic models; on failure the *validation error itself* is fed back for up to 2 corrective retries.
3. **Self-critique** — the landscape reviews itself for coverage gaps across competition dimensions (genre, IP, monetization, audience overlap).
4. **LLM-as-judge** — a *separate context* scores 0–10 against per-module rubrics (real games only, behavioral not demographic segmentation, axes that reveal strategy, SWOT items that name names). Below 7.0 → one feedback-guided regeneration. Same principle as code review by a second engineer: the judge isn't anchored on the generator's reasoning. Scores render as chips on each card. Toggle with `QUALITY_GATE=off`.
5. **Steam grounding** — anti-hallucination. Every competitor is checked against the Steam store search API (concurrent, fuzzy name match, fail-open). Verified titles get a `✓ Steam` badge + appId; misses are flagged but **not removed** — Animal Crossing is a real competitor even though it's a Switch exclusive. The flag is information, not a filter.

Two more methodology details:

- **Axis stability** — when a cascade regenerates the PositioningMatrix, the previous axes are passed in with an instruction to keep them unless upstream changes invalidate them. Users compare positions across updates; silently changing axes breaks that.
- **Self-explanatory axis labels** — endpoint labels must be standalone phrases ("Solo Survival", never "Low"); the UI additionally falls back to combining bare words with the axis name.

---

## Cascade Engine

The assignment's sample test — *"Add Nightingale to the competitive landscape"* — end to end:

```mermaid
sequenceDiagram
    participant U as User (chat)
    participant A as Agent
    participant P as Pipeline
    participant UI as Canvas (SSE)
    U->>A: "Add Nightingale as a competitor"
    A->>A: read_module → apply edit → validate vs schema
    A->>P: update_module(competitiveLandscape)
    P-->>UI: module_update + change log (Nightingale = new)
    A->>P: cascade_update("competitiveLandscape")
    Note over P: BFS on reverse dependency graph<br/>→ affected = [AO, PM, SWOT]
    P->>P: regenerate AudienceOverview (L2)
    P-->>UI: generating → reviewing → done
    par Layer 3 in parallel
        P->>P: regenerate PositioningMatrix
    and
        P->>P: regenerate SWOT
    end
    P-->>UI: both cards stream status live
    A-->>U: "Updated. Changes: added Nightingale.<br/>Cascaded: AO, PM, SWOT."
```

Design decisions that took iteration to get right:

- **Affected-only, never blind.** BFS over the reverse dependency graph. Editing SWOT cascades to nothing; editing the landscape cascades to exactly three modules, layer by layer.
- **Change history records *intent*, not churn.** Direct user edits accumulate an add/remove log (rendered as strikethrough + `new` badges, surviving across chat rounds). Cascade regenerations *reset* that module's log — a re-derived module has no item-level lineage to its old version, and pretending otherwise produced noise (e.g. the matrix "removing" games that were merely re-selected).
- **The agent reports what changed**, not just what ran: a field-level diff ("added to existingCompetitors: Nightingale") is computed backend-side and folded into the reply.

---

## How the Agent Decides What to Do

The agent is a hand-rolled ReAct loop over raw function calling — no LangChain, no framework ([`backend/agent.py`](backend/agent.py), ~250 lines, fully readable):

1. The user message joins the thread's history; the LLM receives it with a system prompt and **three tool schemas**: `generate_pipeline`, `read_module`, `update_module_field`.
2. The response **streams**. Text deltas go straight to the chat as tokens; tool-call deltas are reassembled into complete calls.
3. Each tool call is executed — with **schema validation and cross-reference checks before anything touches disk** — and its result is appended to the history as a tool message.
4. Loop back to step 2 until the model responds with plain text (capped at 8 rounds to prevent runaway loops).

The system prompt encodes the judgment calls: read before answering content questions (never answer from stale context), apply compound requests ("remove X and add Y") in a single update and verify both landed, ask one clarifying question when the request is ambiguous, decline out-of-scope requests without calling tools, and treat instructions embedded in module content as data, not commands.

**The agent narrates itself.** After every update it reports the field-level diff ("added to existingCompetitors: Nightingale") and which modules cascaded — and the UI mirrors that with a live per-module progress list. There is no action the agent takes that the user can't see and attribute.

---

## The Chat System's Three Primitives

Every ChatGPT-style feature here — **stop, undo, regenerate, edit-and-resend, multi-thread history** — is a composition of three primitives rather than five separate mechanisms:

```mermaid
flowchart TD
    SNAP["Per-turn snapshots<br/><i>modules + change logs,<br/>captured before every turn</i>"]
    HIST["Dual truncatable history<br/><i>display messages ∥ raw LLM history<br/>(incl. tool calls)</i>"]
    SSE["SSE event stream<br/><i>tokens · status · module updates</i>"]
    STOP["Stop"] --> SNAP & HIST
    UNDO["Undo"] --> SNAP & HIST
    REGEN["Regenerate"] --> SNAP & HIST
    EDIT["Edit & resend"] --> SNAP & HIST
    LIVE["Live canvas + streaming"] --> SSE
```

- **Stop** cancels the in-flight asyncio task, rolls partial module writes back to the pre-turn snapshot, and truncates dangling tool calls from the LLM history (a half-finished tool call would corrupt the next API request).
- **Undo** restores the snapshot *and* removes the exchange — modules, change logs, and conversation revert together.
- **Regenerate** restores the snapshot *before* re-running, so a turn that performed edits doesn't double-apply them.
- **Edit-and-resend** truncates both histories at the edited message and restores the matching snapshot from the stack (capped at 5/thread).
- Threads persist server-side (`output/_threads.json`), are bound to their brief (selecting an old thread switches the workspace back), and support rename/delete.

Everything renders live: agent tokens stream into a draft bubble, the chat shows a per-module progress list (spinner → purple *reviewing* → green check), and cards dim with a shimmer bar while regenerating. Token events go to SSE only — they're filtered out of the HTTP payload and the persisted thread.

---

## Multi-Provider Design

```mermaid
flowchart LR
    subgraph Registry["Provider registry (llm.py)"]
        direction TB
        R1["openai · base_url: default<br/>gpt-4o · 4o-mini · 4.1 · 4.1-mini"]
        R2["deepseek · api.deepseek.com<br/>deepseek-chat · reasoner"]
        R3["gemini · generativelanguage…/openai<br/>2.5-pro · 2.5-flash"]
        R4["anthropic · native SDK<br/>opus-4-8 · sonnet-4-6 · haiku-4-5"]
    end
    OC["One OpenAI-compatible<br/>client path"]
    NA["AsyncAnthropic"]
    R1 & R2 & R3 --> OC
    R4 --> NA
```

The insight: DeepSeek and Gemini expose **OpenAI-compatible endpoints**, so three providers share one client path differing only in `base_url`. Adding a provider is a 5-line registry entry. The agent's tool-calling loop also follows the active provider when it speaks OpenAI-compatible function calling (with `deepseek-reasoner` auto-mapped to `deepseek-chat`, which supports tools); only Anthropic — a different tool protocol — falls back to OpenAI for the agent.

**Key handling:** users paste keys in the settings modal → stored in the backend's gitignored `.env` + applied live. The API exposes *availability booleans only* — key material never appears in any response (asserted by a test that whitelists the exact response fields). Model strings are whitelisted per provider, so arbitrary strings can't be forwarded to upstream APIs.

---

## Security Model

| Threat | Defense | Verified by |
|---|---|---|
| Prompt injection hidden in a game brief | Brief wrapped in `<game_brief>` delimiters with a data-not-instructions notice placed *after* the payload (recency wins); agent system prompt instructs flagging, not following | `test_injection_phrases_survive_wrapping` |
| Malformed agent tool output corrupting modules | Full Pydantic schema validation before any write; audience cross-references checked and pruned | `test_tool_update_rejects_malformed_schema` |
| API key exfiltration | Keys live in gitignored `.env`; settings responses field-whitelisted; export checked for leaks; `.env` unreachable over HTTP | `test_api_key_never_echoed`, `test_dotenv_not_served`, `test_export_does_not_leak_secrets` |
| Attribute probing (`/api/modules/__class__`) | Module names whitelisted against the dependency graph — no `getattr` on user input | `test_module_endpoints_reject_internals` |
| Path traversal via brief selection | Filenames matched against an enumerated allowlist, never joined into paths | `test_input_selection_path_traversal` (5-variant corpus) |
| Token-bomb / oversized inputs | Length bounds on messages (8k), titles, keys, thread ids | `test_chat_message_bounds` |
| CSRF-adjacent cross-origin calls | CORS restricted to the dev frontend origin | `test_cors_rejects_foreign_origin` |
| Inconsistent state from a cancelled generation | Stop rolls back to the pre-turn snapshot and repairs LLM history | exercised live; logic shared with undo (`test_snapshot_restore_roundtrip`) |

Secrets hygiene for this repo itself: full git history scanned for key patterns before publishing; `.env` was never committed.

---

## Testing

```bash
PYTHONPATH=. pytest tests/ -v        # 52 tests, ~0.7s, zero LLM calls
```

| Suite | Focus | The interesting bit |
|---|---|---|
| `test_system.py` (23) | Cascade graph, change-log semantics, version capping, snapshot round-trips, JSON-parsing edge cases, API misuse | Dependency graph proven acyclic via Kahn's algorithm |
| `test_orchestration.py` (10) | Full pipeline with mocked generators | **Parallelism is proven, not observed**: the L3 fakes cross-wait on each other's start events — sequential execution deadlocks and fails the test |
| `test_security.py` (19) | The entire table above | Key-handling test asserts the *exact* response field set, so a future field addition that leaks data fails CI |

All suites mock the LLM layer — the full matrix runs in CI with no API keys and no cost.

---

## Design Details Worth Noticing

Small decisions that don't fit a diagram:

- **Real-time means real-time.** Status events are emitted from *inside* the pipeline the moment they happen — an early version buffered events until the agent's turn completed, which technically "updated the canvas" but defeated the point. The fix (an `on_event` callback threaded through the pipeline) is why you see `generating → reviewing → done` progress live during a 2-minute cascade.
- **Module-level quoting.** Charts and SWOT grids resist text selection, so every card has a quote button that serializes the whole module into a readable quote chip — alongside free text-selection quoting with a floating button.
- **Esc closes the top layer only.** Modal Esc handling is centralized with explicit layer priority (entity popover → module detail), instead of N competing listeners closing random layers.
- **Entity popovers are cross-module joins.** Click any competitor: its rationale (L1), which segments play it (L2), its position highlighted on a mini-matrix (L3), and the SWOT items naming it (L3) — one card showing the DAG's connective tissue.
- **Alternative positioning lenses.** The matrix ships with two extra axis pairs (e.g. monetization × content cadence) as an *optional* schema field — the spec'd schema is untouched, and the chosen lens persists between the card and detail view.
- **Suggestion prompts adapt.** The Dune brief offers the spec's official Nightingale test case as a one-click suggestion; other briefs get suggestions built from their own competitors.
- **Generic brief parsing.** Key facts (title/genre/platform/price) are regex-extracted from any brief structure — nothing about the Dune brief is hardcoded (an early bug: SWOT prompts said "Dune: Awakening" literally; now everything derives from the brief).
- **Export carries the evidence.** The one-click Markdown report includes Steam verification flags, all three positioning lenses, and the judge's scores — the methodology travels with the output.

## Extending It

The architecture is registry- and schema-driven, so the common growth paths are local, mechanical changes:

| To add… | You touch | Why it's cheap |
|---|---|---|
| **A new LLM provider** | one ~5-line entry in the provider registry ([`backend/llm.py`](backend/llm.py)) | DeepSeek and Gemini already ride the OpenAI-compatible client path; only the `base_url` and model list differ |
| **A new analysis module** | a Pydantic schema, a generator file, one edge in `DEPENDENCY_GRAPH` | Cascade order, parallel batching, quality gate, versioning, change tracking, and the SSE pipeline all derive from the graph — none of them are per-module code |
| **A new game brief** | drop a `.md` into [`inputs/`](inputs) | Workspaces, threads, and the brief switcher pick it up automatically; fact parsing is structure-based, not Dune-specific |
| **A new grounding source** (IGDB, console storefronts) | the verification step in [`backend/modules/competitive.py`](backend/modules/competitive.py) | `verified` is deliberately tri-state (`true/false/null`), so additional sources slot in without schema or UI changes |
| **A real database** | the `Pipeline` class ([`backend/pipeline.py`](backend/pipeline.py)) | It is the single owner of all persisted state — modules, versions, change logs, quality reviews — so swapping JSON files for SQLite touches one file |
| **A new judge rubric** | one entry in [`backend/evaluator.py`](backend/evaluator.py) | Rubrics are data, not code |

## Trade-offs

- **Agent on OpenAI-compatible protocols only** — Anthropic's tool-use format differs; bridging it was lower value than the judge/grounding work. Module generation runs on all four providers.
- **SSE over WebSocket** — one-directional push is all the canvas needs; chat requests are plain POSTs. Less infrastructure, same UX.
- **Snapshots capped at 5/thread** — unbounded undo history would bloat the thread store for marginal value; edits older than the window still truncate conversation correctly, just without module rollback.
- **Steam as the single grounding source** — free, keyless, and covers the PC market this brief targets. The `verified` field is deliberately tri-state (`true/false/null`) so additional sources (console storefronts, IGDB) can slot in without schema changes.
- **File-based persistence** — JSON files per workspace beat a database for a reviewable take-home: every artifact is diffable in git. The `Pipeline` class is the single owner of all state, so swapping in SQLite later touches one file.
