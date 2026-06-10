"""Persistent chat threads — like ChatGPT/Claude conversation history.

Each thread carries its own LLM history and display messages, and remembers
which game brief it belongs to. Stored in output/_threads.json.
"""

import json
import time
import uuid
from pathlib import Path

OUTPUT_ROOT = Path(__file__).parent.parent / "output"


class ThreadStore:
    def __init__(self):
        self.path = OUTPUT_ROOT / "_threads.json"
        OUTPUT_ROOT.mkdir(exist_ok=True)
        if self.path.exists():
            self.data = json.loads(self.path.read_text())
        else:
            self.data = {"threads": {}, "active": None}

    def save(self):
        self.path.write_text(json.dumps(self.data, indent=2, ensure_ascii=False))

    def create(self, brief: str) -> dict:
        tid = uuid.uuid4().hex[:8]
        thread = {
            "id": tid,
            "title": "New chat",
            "brief": brief,
            "updated": time.time(),
            "messages": [],   # display messages: [{role, content}]
            "history": [],    # raw LLM history incl. tool calls
        }
        self.data["threads"][tid] = thread
        self.data["active"] = tid
        self.save()
        return thread

    def get(self, tid: str) -> dict | None:
        return self.data["threads"].get(tid)

    def delete(self, tid: str):
        self.data["threads"].pop(tid, None)
        if self.data["active"] == tid:
            self.data["active"] = None
        self.save()

    def set_active(self, tid: str):
        self.data["active"] = tid
        self.save()

    @property
    def active_id(self) -> str | None:
        return self.data.get("active")

    def summaries(self) -> list[dict]:
        threads = sorted(self.data["threads"].values(), key=lambda t: -t["updated"])
        return [
            {"id": t["id"], "title": t["title"], "brief": t["brief"], "updated": t["updated"]}
            for t in threads
        ]

    def latest_for_brief(self, brief: str) -> dict | None:
        candidates = [t for t in self.data["threads"].values() if t["brief"] == brief]
        return max(candidates, key=lambda t: t["updated"]) if candidates else None
