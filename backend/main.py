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

    result = await _execute_turn(thread, req.message)
    return {**result, "thread_id": thread["id"], "messages": thread["messages"]}


# In-flight generation tasks, per thread — lets /api/chat/stop cancel them
_running_turns: dict[str, asyncio.Task] = {}


async def _execute_turn(thread: dict, message: str) -> dict:
    """One chat turn: snapshot for undo, run the agent (cancellable), persist.

    On stop, partial module changes are rolled back to the pre-turn snapshot
    and the LLM history is truncated — a stopped turn can leave dangling
    tool calls that would corrupt the next API request otherwise.
    """
    thread.setdefault("snapshots", []).append(pipeline.snapshot())
    thread["snapshots"] = thread["snapshots"][-5:]
    pre_history_len = len(thread["history"])

    thread["messages"].append({"role": "user", "content": message})
    if thread["title"] == "New chat":
        thread["title"] = message.lstrip("> ").splitlines()[0][:48] if message.strip() else "New chat"

    task = asyncio.create_task(agent.chat(message, history=thread["history"]))
    _running_turns[thread["id"]] = task
    try:
        result = await task
    except asyncio.CancelledError:
        snap = thread["snapshots"].pop()
        _restore_and_broadcast(snap)
        del thread["history"][pre_history_len:]
        thread["history"].append({"role": "user", "content": message})
        thread["history"].append({"role": "assistant", "content": "(The user stopped this response before completion.)"})
        result = {
            "response": "Generation stopped. Any partial module changes were rolled back.",
            "events": [],
            "stopped": True,
        }
    finally:
        _running_turns.pop(thread["id"], None)

    thread["messages"].append({"role": "assistant", "content": result["response"]})
    thread["updated"] = time.time()
    threads.set_active(thread["id"])
    return result


class StopRequest(BaseModel):
    thread_id: str | None = None


@app.post("/api/chat/stop")
async def stop_chat(req: StopRequest):
    """Cancel the in-flight generation for a thread (or the active one)."""
    tid = req.thread_id or threads.active_id
    task = _running_turns.get(tid or "")
    if task and not task.done():
        task.cancel()
        return {"ok": True}
    return {"ok": False, "reason": "no generation in progress"}


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


class RenameRequest(BaseModel):
    title: str


@app.patch("/api/threads/{tid}")
async def rename_thread(tid: str, req: RenameRequest):
    thread = threads.get(tid)
    if thread is None:
        raise HTTPException(404, "Thread not found")
    thread["title"] = req.title.strip()[:60] or thread["title"]
    threads.save()
    return {"ok": True, "title": thread["title"]}


class EditRequest(BaseModel):
    index: int
    message: str


@app.post("/api/threads/{tid}/edit")
async def edit_message(tid: str, req: EditRequest):
    """Edit a past user message and re-run from that point (ChatGPT-style).

    Everything after the edited message is discarded; module state is
    restored to the snapshot taken before that turn when still available.
    """
    thread = threads.get(tid)
    if thread is None:
        raise HTTPException(404, "Thread not found")
    msgs = thread["messages"]
    if not (0 <= req.index < len(msgs)) or msgs[req.index]["role"] != "user":
        raise HTTPException(400, "Index does not point at a user message")

    _activate_brief(thread["brief"])

    # How many turns (user messages) from the edited one to the end
    turns_back = sum(1 for m in msgs[req.index:] if m["role"] == "user")
    snaps = thread.get("snapshots", [])
    k = len(snaps) - turns_back
    if k >= 0:
        _restore_and_broadcast(snaps[k])
        thread["snapshots"] = snaps[:k]
    # else: the turn is older than our snapshot window — conversation is
    # still truncated, but module state stays as-is

    thread["messages"] = msgs[:req.index]
    hist = thread["history"]
    user_idxs = [i for i, h in enumerate(hist) if h.get("role") == "user"]
    if len(user_idxs) >= turns_back:
        thread["history"] = hist[:user_idxs[-turns_back]]

    result = await _execute_turn(thread, req.message)
    threads.save()
    return {**result, "messages": thread["messages"], "thread_id": tid}


@app.delete("/api/threads/{tid}")
async def delete_thread(tid: str):
    threads.delete(tid)
    return {"ok": True}


def _truncate_last_exchange(thread: dict) -> str | None:
    """Drop the last user→assistant exchange. Returns the user message text."""
    msgs = thread["messages"]
    idx = max((i for i, m in enumerate(msgs) if m["role"] == "user"), default=None)
    if idx is None:
        return None
    user_text = msgs[idx]["content"]
    thread["messages"] = msgs[:idx]

    hist = thread["history"]
    hidx = max((i for i, h in enumerate(hist) if h.get("role") == "user"), default=None)
    if hidx is not None:
        thread["history"] = hist[:hidx]
    return user_text


def _restore_and_broadcast(snap: dict):
    pipeline.restore(snap)
    for name, data in snap["modules"].items():
        if data is not None:
            broadcast_event({
                "type": "module_update", "module": name, "data": data,
                "changes": snap["changes"].get(name, {"added": {}, "removed": {}}),
            })


@app.post("/api/threads/{tid}/undo")
async def undo_turn(tid: str):
    """Revert the last exchange: module state AND conversation."""
    thread = threads.get(tid)
    if thread is None:
        raise HTTPException(404, "Thread not found")
    if not thread.get("snapshots"):
        raise HTTPException(400, "Nothing to undo")
    _activate_brief(thread["brief"])
    _restore_and_broadcast(thread["snapshots"].pop())
    _truncate_last_exchange(thread)
    thread["updated"] = time.time()
    threads.save()
    return {"messages": thread["messages"]}


@app.post("/api/threads/{tid}/regenerate")
async def regenerate_turn(tid: str):
    """Re-run the last user message: restore pre-turn module state, then
    answer again. The snapshot stays on the stack — it still represents
    the state before this (re-run) turn."""
    thread = threads.get(tid)
    if thread is None:
        raise HTTPException(404, "Thread not found")
    if not thread.get("snapshots"):
        raise HTTPException(400, "Nothing to regenerate")
    _activate_brief(thread["brief"])
    _restore_and_broadcast(thread["snapshots"][-1])
    user_text = _truncate_last_exchange(thread)
    if user_text is None:
        raise HTTPException(400, "No user message to re-run")

    thread["messages"].append({"role": "user", "content": user_text})
    result = await agent.chat(user_text, history=thread["history"])
    thread["messages"].append({"role": "assistant", "content": result["response"]})
    thread["updated"] = time.time()
    threads.save()
    return {**result, "messages": thread["messages"], "thread_id": tid}


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
