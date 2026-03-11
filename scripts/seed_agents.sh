#!/bin/bash
# Seed initial mock agents so the dashboard isn't empty on boot
echo "Seeding agents to Event Bus..."
python3 ../../../scripts/casp_push.py --agent-id main --state idle --name "Mavis" --department "ops_center" --project "Core Ops"
python3 ../../../scripts/casp_push.py --agent-id coder --state executing --name "Builder" --department "dev_studio" --project "Agent Viz"
python3 ../../../scripts/casp_push.py --agent-id research --state idle --name "Researcher" --department "dev_studio" --project "Knowledge Base"
python3 ../../../scripts/casp_push.py --agent-id operator --state idle --name "Operator" --department "ops_center" --project "System Health"
python3 ../../../scripts/casp_push.py --agent-id strategist --state idle --name "Strategist" --department "trading_floor" --project "Market Analysis"
echo "Agents seeded."
