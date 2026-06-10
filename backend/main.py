"""FastAPI server — Tier 3 & 4 backend.

Endpoints:
  POST /api/chat           — send a message to the agent
  GET  /api/modules        — all module states (current + previous for diffs)
  GET  /api/modules/:id    — a single module
  GET  /api/input          — key facts parsed from the active input file
  GET  /api/inputs         — list available input files
  POST /api/inputs/select  — switch the active input file
  GET  /api/events         — SSE stream for real-time module updates
"""

import asyncio
import json
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.pipeline import Pipeline, DEPENDENCY_GRAPH
from backend.agent import Agent
from backend.threads import ThreadStore

import time

ROOT = Path(__file__).parent.parent

app = FastAPI(title="GTM Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE event queues for real-time updates (one per connected client)
event_queues: list[asyncio.Queue] = []


def broadcast_event(event: dict):
    """Send an event to all connected SSE clients immediately."""
    for q in event_queues:
        q.put_nowait(event)


# Active input file — switchable at runtime via /api/inputs/select
active_input = {"path": ROOT / "inputs" / "input.md"}

pipeline = Pipeline()
agent = Agent(
    pipeline,
    on_event=broadcast_event,
    get_input=lambda: active_input["path"].read_text(),
)
agent.get_input_label = lambda: active_input["path"].name
threads = ThreadStore()


def _activate_brief(filename: str) -> bool:
    """Switch the active brief + pipeline workspace. Returns False if unknown."""
    for f in _list_input_files():
        if f.name == filename:
            if active_input["path"] != f:
                active_input["path"] = f
                pipeline.switch_workspace(f.stem)
                broadcast_event({"type": "input_changed", "filename": f.name})
            return True
    return False


class ChatRequest(BaseModel):
    message: str
    thread_id: str | None = None


class SelectInputRequest(BaseModel):
    filename: str


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Send a message to the agent within a thread.

    Module status/update events are broadcast over SSE in real-time while
    the agent works; the HTTP response carries the final text + event log.
    """
    thread = threads.get(req.thread_id) if req.thread_id else threads.get(threads.active_id or "")
    if thread is None:
        thread = threads.create(active_input["path"].name)

    # A thread is bound to its brief — selecting it follows the brief
    _activate_brief(thread["brief"])

    thread["messages"].append({"role": "user", "content": req.message})
    if thread["title"] == "New chat":
        thread["title"] = req.message[:48]

    result = await agent.chat(req.message, history=thread["history"])

    thread["messages"].append({"role": "assistant", "content": result["response"]})
    thread["updated"] = time.time()
    threads.set_active(thread["id"])
    return {**result, "thread_id": thread["id"]}


@app.get("/api/threads")
async def list_threads():
    return {"threads": threads.summaries(), "active": threads.active_id}


@app.post("/api/threads")
async def create_thread():
    thread = threads.create(active_input["path"].name)
    return {"id": thread["id"], "brief": thread["brief"], "messages": []}


@app.post("/api/threads/{tid}/select")
async def select_thread(tid: str):
    thread = threads.get(tid)
    if thread is None:
        raise HTTPException(404, "Thread not found")
    threads.set_active(tid)
    _activate_brief(thread["brief"])
    return {"id": tid, "brief": thread["brief"], "messages": thread["messages"]}


@app.delete("/api/threads/{tid}")
async def delete_thread(tid: str):
    threads.delete(tid)
    return {"ok": True}


@app.get("/api/modules")
async def get_modules():
    """All module states; each includes the previous version for diff display."""
    return {
        name: {
            "data": pipeline.get_module(name),
            "changes": pipeline.get_changes(name),
        }
        for name in DEPENDENCY_GRAPH
    }


@app.get("/api/modules/{module_name}")
async def get_module(module_name: str):
    data = pipeline.get_module(module_name)
    if data is None:
        raise HTTPException(404, f"Module '{module_name}' not generated yet")
    return data


def _list_input_files() -> list[Path]:
    """All game briefs live in inputs/ (root input*.md kept as fallback)."""
    inputs_dir = ROOT / "inputs"
    files = sorted(inputs_dir.glob("*.md")) if inputs_dir.is_dir() else []
    files += [f for f in sorted(ROOT.glob("input*.md")) if f.name not in {x.name for x in files}]
    return files


def _parse_input_facts(content: str) -> dict:
    """Extract key facts from any game-brief markdown (not Dune-specific)."""
    title_m = re.search(r"^#\s*(?:Game Brief:\s*)?(.+)$", content, re.M)

    def field(name: str) -> str:
        m = re.search(rf"\*\*{name}:\*\*\s*(.+)", content)
        return m.group(1).strip() if m else "—"

    sd = re.search(r"##\s*Short Description\s*\n+(.+?)(?=\n#|\Z)", content, re.S)
    short = sd.group(1).strip().split("\n\n")[0] if sd else content[:300]

    return {
        "title": title_m.group(1).strip() if title_m else "Untitled",
        "genre": field("Genre"),
        "platform": field("Platform"),
        "price": field("Price"),
        "shortDescription": short,
    }


@app.get("/api/input")
async def get_input():
    """Key facts from the active input file for the left panel."""
    content = active_input["path"].read_text()
    facts = _parse_input_facts(content)
    facts["rawMarkdown"] = content
    facts["filename"] = active_input["path"].name
    return facts


@app.get("/api/inputs")
async def list_inputs():
    """Available input files and which one is active."""
    return {
        "files": [f.name for f in _list_input_files()],
        "active": active_input["path"].name,
    }


@app.post("/api/inputs/select")
async def select_input(req: SelectInputRequest):
    """Switch the active input file. Affects future generations."""
    for f in _list_input_files():
        if f.name == req.filename:
            active_input["path"] = f
            pipeline.switch_workspace(f.stem)
            broadcast_event({"type": "input_changed", "filename": f.name})
            return {"ok": True, "active": f.name}
    raise HTTPException(404, f"Input file '{req.filename}' not found")


@app.get("/api/events")
async def events(request: Request):
    """SSE endpoint for real-time module status updates."""
    queue: asyncio.Queue = asyncio.Queue()
    event_queues.append(queue)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        finally:
            event_queues.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
