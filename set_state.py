#!/usr/bin/env python3
"""Update AgentsHomeOffice state (for testing or agent-driven sync).

For automatic state sync from OpenClaw: add a rule in your agent SOUL.md or AGENTS.md:
  Before starting a task: run `python3 set_state.py writing "doing XYZ"`.
  After finishing: run `python3 set_state.py idle "ready"`.
The office UI reads state from the same state.json this script writes.

Multi-agent support:
  python set_state.py <state> [detail] [--agent <agent_id>]
  python set_state.py --agent <agent_id> <state> [detail]
"""

import json
import os
import sys
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.environ.get(
    "STAR_OFFICE_STATE_FILE",
    os.path.join(ROOT_DIR, "state.json"),
)
AGENTS_STATE_FILE = os.path.join(ROOT_DIR, "agents-state.json")

VALID_STATES = [
    "idle",
    "writing",
    "receiving",
    "replying",
    "researching",
    "executing",
    "syncing",
    "error"
]

# Agent ID to name mapping
AGENT_NAMES = {
    "main": "Main",
    "research": "Research",
    "builder": "Builder",
    "operator": "Operator",
    "strategist": "Strategist",
    "coder": "Coder",
}

STATE_TO_AREA = {
    "idle": "breakroom",
    "writing": "writing",
    "receiving": "writing",
    "replying": "writing",
    "researching": "writing",
    "executing": "writing",
    "syncing": "writing",
    "error": "error",
}

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "state": "idle",
        "detail": "待命中...",
        "progress": 0,
        "updated_at": datetime.now().isoformat()
    }

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_agents_state():
    if os.path.exists(AGENTS_STATE_FILE):
        with open(AGENTS_STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_agents_state(agents):
    with open(AGENTS_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(agents, f, ensure_ascii=False, indent=2)

def update_agent_state(agent_id, state_name, detail):
    """Update state for a specific agent in agents-state.json"""
    agents = load_agents_state()
    
    # Find existing agent or create new
    agent = None
    for a in agents:
        if a.get("agentId") == agent_id:
            agent = a
            break
    
    now = datetime.now().isoformat()
    
    if agent is None:
        # Create new agent entry
        agent = {
            "agentId": agent_id,
            "name": AGENT_NAMES.get(agent_id, agent_id.capitalize()),
            "isMain": False,
            "state": state_name,
            "detail": detail,
            "updated_at": now,
            "area": STATE_TO_AREA.get(state_name, "breakroom"),
            "source": "openclaw",
            "joinKey": None,
            "authStatus": "approved",
            "authExpiresAt": None,
            "lastPushAt": now
        }
        agents.append(agent)
    else:
        # Update existing agent
        agent["state"] = state_name
        agent["detail"] = detail
        agent["updated_at"] = now
        agent["area"] = STATE_TO_AREA.get(state_name, "breakroom")
        agent["lastPushAt"] = now
    
    save_agents_state(agents)
    return agent

def parse_args(args):
    """Parse arguments to extract state, detail, and optional agent_id"""
    agent_id = None
    state_name = None
    detail = ""
    
    i = 0
    while i < len(args):
        if args[i] == "--agent" and i + 1 < len(args):
            agent_id = args[i + 1]
            i += 2
        elif state_name is None and not args[i].startswith("-"):
            state_name = args[i]
            i += 1
        elif state_name is not None and detail == "":
            detail = args[i]
            i += 1
        else:
            i += 1
    
    return agent_id, state_name, detail

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python set_state.py [--agent <agent_id>] <state> [detail]")
        print(f"状态选项: {', '.join(VALID_STATES)}")
        print("\n例子:")
        print("  python set_state.py idle")
        print("  python set_state.py researching \"在查 Godot MCP...\"")
        print("  python set_state.py --agent coder writing \"在写代码...\"")
        print("  python set_state.py executing \"运行任务中...\" --agent builder")
        sys.exit(1)
    
    agent_id, state_name, detail = parse_args(sys.argv[1:])
    
    if state_name is None:
        print("错误: 未提供状态")
        sys.exit(1)
    
    if state_name not in VALID_STATES:
        print(f"无效状态: {state_name}")
        print(f"有效选项: {', '.join(VALID_STATES)}")
        sys.exit(1)
    
    if agent_id:
        # Multi-agent mode: update agents-state.json
        agent = update_agent_state(agent_id, state_name, detail)
        print(f"Agent '{agent_id}' 状态已更新: {state_name} - {detail}")
    else:
        # Legacy mode: update state.json (main agent)
        state = load_state()
        state["state"] = state_name
        state["detail"] = detail
        state["updated_at"] = datetime.now().isoformat()
        save_state(state)
        print(f"主状态已更新: {state_name} - {detail}")
