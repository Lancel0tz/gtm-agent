# GTM Agent — Take-Home Project

**Deadline: 48 hours**  
LLM provider: your choice (OpenAI, Anthropic, Gemini, etc.) — bring your own API key.

---

## Overview

You are building a Go-To-Market (GTM) analysis system for indie game publishers. Given a game brief, the system produces a structured set of GTM modules — CompetitiveLandscape, AudienceOverview, PositioningMatrix, and SWOT — and lets a user interact with and refine them through a chat interface.

This project has four delivery tiers. **Complete as many as you can.** We evaluate depth over breadth — a Tier 2 that works correctly is worth more than a broken Tier 4.

---

## Modules

The system contains **4 module types** with a fixed dependency structure. Each module is a structured JSON document your agent generates and updates.

`input.md` is the seed for the entire pipeline — all agents may read it directly. It is not a module and is not LLM-generated.

### Dependency Graph

```
Layer 1   CompetitiveLandscape                        reads: input.md
Layer 2   AudienceOverview                            reads: input.md + CompetitiveLandscape
Layer 3   PositioningMatrix  ┐ parallel               reads: input.md + CompetitiveLandscape + AudienceOverview
          SWOT               ┘                        reads: input.md + CompetitiveLandscape + AudienceOverview
```

Layer 3 modules are **independent of each other** and must be generated in parallel, not sequentially.

Agents are expected to **generate and infer** content beyond what is explicitly stated in `input.md`. `CompetitiveLandscape` should identify real competing games by applying the LLM's knowledge of the gaming market — this is analysis, not extraction.

**Methodology is part of the evaluation.** For each module, we are interested in *how* you get to the output — not just that you make an LLM call. A single prompt that asks the model to fill in a JSON template is the minimum bar. More thoughtful approaches might include: breaking the task into reasoning steps before producing structured output, using multiple targeted calls that build on each other, validating or self-critiquing intermediate outputs, or designing prompts that explicitly ground the model in upstream module content. No external APIs are provided; you are free to add your own. Simple or complex — that is your call, but be prepared to explain your choices.

---

### Module Schemas

#### CompetitiveLandscape — Layer 1
> Reads `input.md` to identify the competitive space. No external API calls required — use the LLM's knowledge of the gaming market. Target **10–15 competitors**.

```json
{
  "summary": "string",
  "existingCompetitors": [
    {
      "id": "string (e.g. ec-001)",
      "name": "string",
      "rationale": "string — why this title is in the competitive set"
    }
  ]
}
```

#### AudienceOverview — Layer 2
> `segments[].selectedExistingCompetitors` must reference names that appear in `CompetitiveLandscape.existingCompetitors` — this is what makes the dependency structural, not incidental. Target **3–5 segments**.

```json
{
  "summary": "string — segmentation logic grounded in the competitive landscape",
  "segments": [
    {
      "id": "string (e.g. seg-1)",
      "segmentName": "string",
      "description": "string — behaviors, motivations, and boundaries of this segment",
      "selectedExistingCompetitors": ["string — names from CompetitiveLandscape.existingCompetitors"]
    }
  ]
}
```

#### PositioningMatrix — Layer 3
> Defines two axes relevant to the competitive space and plots the game itself plus the most relevant competitors from `CompetitiveLandscape`. The agent chooses the axes — they should surface a meaningful gap or opportunity. Include the game itself and a representative selection of competitors (not necessarily all 10–15).

```json
{
  "xAxis": {
    "axisName": "string",
    "lowLabel": "string",
    "highLabel": "string"
  },
  "yAxis": {
    "axisName": "string",
    "lowLabel": "string",
    "highLabel": "string"
  },
  "positions": [
    {
      "id": "string (e.g. pm-001)",
      "gameName": "string",
      "xPosition": "number (0–10)",
      "yPosition": "number (0–10)"
    }
  ]
}
```

**Example** — for a survival MMO competing against solo-focused survival games:

```json
{
  "xAxis": { "axisName": "Social Scale", "lowLabel": "Solo", "highLabel": "Massively Multiplayer" },
  "yAxis": { "axisName": "Narrative Depth", "lowLabel": "Sandbox / Emergent", "highLabel": "Story-Driven" },
  "positions": [
    { "id": "pm-001", "gameName": "Dune: Awakening", "xPosition": 9, "yPosition": 4 },
    { "id": "pm-002", "gameName": "Valheim",          "xPosition": 4, "yPosition": 3 },
    { "id": "pm-003", "gameName": "Rust",             "xPosition": 7, "yPosition": 1 },
    { "id": "pm-004", "gameName": "Subnautica",       "xPosition": 2, "yPosition": 6 }
  ]
}
```

#### SWOT — Layer 3
> Each entry is a list item with a stable id and a text statement. SWOT analysis should be grounded in the competitive and audience context from upstream modules.

```json
{
  "strengths": [{ "id": "string (e.g. sw-001)", "text": "string" }],
  "weaknesses": [{ "id": "string", "text": "string" }],
  "opportunities": [{ "id": "string", "text": "string" }],
  "threats": [{ "id": "string", "text": "string" }]
}
```

---

## Delivery Tiers

### Tier 1 — Pipeline as a Claude Code Skill

Package your GTM pipeline as a **Claude Code skill**, following the [Agent Skills](https://agentskills.io) open standard. A skill is a directory under `.claude/skills/[skill-name]/` containing a `SKILL.md` file with instructions, plus any supporting scripts or assets. It can be invoked directly in Claude Code with `/skill-name`.

Requirements:
- Implement the skill so that invoking it (e.g. `/gtm-analyze`) reads `input.md` and produces all four modules (CompetitiveLandscape, AudienceOverview, PositioningMatrix, SWOT)
- `SKILL.md` must describe clearly what the skill does, what inputs it expects, and what it outputs
- Layer 1 → Layer 2 → Layer 3 execution must respect the dependency order
- Layer 3 (PositioningMatrix + SWOT) must run **in parallel**
- Supporting scripts (if any) should be included in the skill directory and runnable without manual setup

Reference: [Claude Code skills documentation](https://docs.claude.com/en/docs/claude-code/skills)

---

### Tier 2 — Cascade Updates *(bonus)*

When the user modifies an upstream module via chat (e.g., adding or removing a competitor in CompetitiveLandscape, or updating a segment in AudienceOverview), the system automatically identifies which downstream modules are affected and regenerates them in topological order.

Requirements:
- Cascade must respect the dependency graph — a module is only regenerated after all its dependencies have been updated
- Layer 3 modules must still be triggered in parallel
- The system should indicate which modules were affected and what changed

**Sample test case we will run:**

> Starting from a fully generated state, the user says:  
> *"Add a new competitor to the competitive landscape: Nightingale (survival crafting, co-op focus)."*
>
> Expected: `CompetitiveLandscape.existingCompetitors` is updated with the new entry, then `AudienceOverview` regenerates (segment definitions and `selectedExistingCompetitors` may need to reflect Nightingale), then `PositioningMatrix` and `SWOT` regenerate in parallel (both should now account for Nightingale).

We will test additional cases not listed here. Your cascade logic should handle any upstream field change, not just this one.

---

### Tier 3 — Agent from an LLM API Endpoint

Build a conversational agent that wraps your pipeline. The agent must be constructed **from an LLM API call**, not from a pre-built agentic runtime (e.g., do not use Claude Code, Cursor, or similar tools as the execution environment).

You may adapt an open-source project (LangChain, LangGraph, CrewAI, a custom ReAct loop, etc.) as a starting point, but the core reasoning loop — how the agent decides what to do next — must be something you can explain and have meaningfully configured.

The agent should handle at minimum:
- "Generate the full GTM analysis for this game" → runs the full pipeline and returns all modules
- "Update [field] to [value]" → modifies the relevant upstream module and (if Tier 2 is implemented) cascades downstream
- "What does the positioning say?" → reads and returns a specific module
- Graceful handling of ambiguous or out-of-scope requests

---

### Tier 4 — Three-Column Frontend

Build a web frontend with three columns:

| Left | Middle | Right |
|------|--------|-------|
| **Input** — display the key facts from `input.md` (title, genre, platform, price, short description). Read-only. | **Canvas** — display the four generated modules as cards. Each card shows the module name, its content, and a visual indicator of its generation status (pending / generating / done). | **Chat** — the agent from Tier 3, embedded as a chatbot. User types messages here; the agent responds and updates the canvas in real-time as modules are generated or updated. |

The canvas must reflect module state in real-time: when the agent triggers generation or a cascade update, cards should update without a full page reload.

---

## What We Are Evaluating

| Tier | Primary signal |
|------|---------------|
| 1 | Does the pipeline run end-to-end? Is Layer 3 actually parallel? Is the output structured and readable? What methodology did the candidate use for each module — a single dump prompt or something more considered? Can they explain their prompt design choices? |
| 2 | Does cascade correctly identify affected modules? Is topological order respected? Do Layer 3 modules run in parallel during cascade? |
| 3 | Can you articulate how your agent loop works? Does it handle the listed scenarios? |
| 4 | Does the three-column layout work? Does the canvas update in real-time? Is the agent embedded correctly? |

**Red flags across all tiers:**
- Layer 3 modules generated sequentially when they could be parallel
- Cascade that blindly regenerates all modules instead of only affected ones
- An agent that cannot explain what it is doing or why
- A frontend that only works in the happy path (first generation, no updates)

---

## Submission

- A GitHub repository (public or shared with us), **or** a zip file containing the full project
- A `README.md` with: how to run each tier, your API key setup instructions, and a short note on any design decisions you made or trade-offs you hit
- Optional: a short screen recording (2–3 min) walking through your working system

Questions are welcome. Good luck.
