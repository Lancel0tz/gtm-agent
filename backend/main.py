"""FastAPI server — Tier 3 & 4 backend.

Endpoints:
  POST /api/chat        — send a message to the agent
  GET  /api/modules     — get all current module states
  GET  /api/modules/:id — get a single module
  GET  /api/input       — get parsed input.md key facts
  GET  /api/events      — SSE stream for real-time module updates
"""

import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.pipeline import Pipeline
from backend.agent import Agent

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


pipeline = Pipeline()
agent = Agent(pipeline, on_event=broadcast_event)


class ChatRequest(BaseModel):
    message: str


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Send a message to the agent.

    Module status/update events are broadcast over SSE in real-time while
    the agent works; the HTTP response carries the final text + event log.
    """
    result = await agent.chat(req.message)
    return result


@app.get("/api/modules")
async def get_modules():
    """Get all current module states."""
    return {
        "competitiveLandscape": pipeline.get_module("competitiveLandscape"),
        "audienceOverview": pipeline.get_module("audienceOverview"),
        "positioningMatrix": pipeline.get_module("positioningMatrix"),
        "swot": pipeline.get_module("swot"),
    }


@app.get("/api/modules/{module_name}")
async def get_module(module_name: str):
    """Get a single module's current state."""
    data = pipeline.get_module(module_name)
    if data is None:
        return {"error": f"Module '{module_name}' not generated yet"}
    return data


@app.get("/api/input")
async def get_input():
    """Return key facts from input.md for the left panel."""
    input_path = Path(__file__).parent.parent / "input.md"
    content = input_path.read_text()

    # Extract key facts
    return {
        "title": "Dune: Awakening",
        "genre": "Survival, Open-World, MMO",
        "platform": "Steam only",
        "price": "$50 USD + MTX / Battle Pass",
        "shortDescription": (
            "Rise from survival to greatness and challenge the power of an "
            "Imperium in Dune: Awakening, a multiplayer survival game on a "
            "massive scale."
        ),
        "rawMarkdown": content,
    }


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
