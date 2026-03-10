#!/usr/bin/env python3
"""Multi-agent state update script for OpenClaw.
Directly updates agents-state.json and state.json (for main)."""

import json
import os
import sys
from datetime import datetime

DIR = os.path.dirname(os.path.abspath(__file__))
AGENTS_FILE = os.path.join(DIR, "agents-state.json")
MAIN_STATE_FILE = os.path.join(DIR, "state.json")

VALID_STATES = [
    "idle", "writing", "receiving", "replying", 
    "researching", "executing", "syncing", "error"
]

def load_json(path, default_val):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default_val

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_multi_agent_state.py <agent_id> <state> [detail]")
        sys.exit(1)

    agent_id = sys.argv[1].lower()
    state_name = sys.argv[2].lower()
    detail = sys.argv[3] if len(sys.argv) > 3 else ""

    if state_name not in VALID_STATES:
        state_name = "executing"

    now_iso = datetime.now().isoformat()

    # Update main legacy state.json if it's the main agent
    if agent_id in ("main", "star", "mavis"):
        state_data = load_json(MAIN_STATE_FILE, {"state": "idle", "detail": ""})
        state_data["state"] = state_name
        state_data["detail"] = detail
        state_data["updated_at"] = now_iso
        save_json(MAIN_STATE_FILE, state_data)
        # We also want to update the multi-agent list below, using 'star' as the default main ID for the UI
        actual_id = "star"
    else:
        actual_id = agent_id

    # Update agents-state.json
    agents = load_json(AGENTS_FILE, [])
    found = False
    for a in agents:
        if a.get("agentId") == actual_id:
            a["state"] = state_name
            a["detail"] = detail
            a["updated_at"] = now_iso
            a["authStatus"] = "approved" # auto-approve local scripts
            found = True
            break
    
    if not found:
        # Create new agent entry
        new_agent = {
            "agentId": actual_id,
            "name": actual_id.capitalize(),
            "isMain": actual_id == "star",
            "state": state_name,
            "detail": detail,
            "updated_at": now_iso,
            "area": "desk" if state_name != "idle" else "breakroom",
            "source": "local",
            "authStatus": "approved"
        }
        agents.append(new_agent)

    save_json(AGENTS_FILE, agents)
    print(f"[{actual_id}] state updated to {state_name}: {detail}")
