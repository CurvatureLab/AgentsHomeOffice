#!/usr/bin/env python3
"""
Simple WebSocket Event Bus for Curvature Labs Agent Viz
Mimics Pusher protocol for compatibility with the pusher client library.
"""

import asyncio
import json
import logging
import websockets
from datetime import datetime
from typing import Dict, Set

# Configuration
HOST = "0.0.0.0"
PORT = 6001
APP_ID = "curvature"
APP_KEY = "curvature-key"
APP_SECRET = "curvature-secret"

# Channel subscriptions: channel_name -> set of websockets
channels: Dict[str, Set] = {}

# Presence channel data: channel_name -> {user_id -> user_info}
presence_data: Dict[str, Dict[str, dict]] = {}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def send_event(websocket, event: str, data: dict, channel: str = None):
    """Send an event to a websocket client."""
    payload = {"event": event, "data": data}
    if channel:
        payload["channel"] = channel
    await websocket.send(json.dumps(payload))


async def broadcast_to_channel(channel: str, event: str, data: dict, exclude=None):
    """Broadcast an event to all subscribers of a channel."""
    if channel not in channels:
        return
    
    payload = json.dumps({"event": event, "data": data, "channel": channel})
    disconnected = []
    
    for ws in channels[channel]:
        if ws == exclude:
            continue
        try:
            await ws.send(payload)
        except websockets.exceptions.ConnectionClosed:
            disconnected.append(ws)
    
    # Clean up disconnected clients
    for ws in disconnected:
        channels[channel].discard(ws)


async def handle_connection(websocket):
    """Handle a new WebSocket connection."""
    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    logger.info(f"Client connected: {client_id}")
    
    # Track subscribed channels for this connection
    subscribed_channels: Set[str] = set()
    
    try:
        # Send connection established event (Pusher protocol)
        await send_event(websocket, "pusher:connection_established", {
            "socket_id": str(id(websocket)),
            "activity_timeout": 120
        })
        
        async for message in websocket:
            try:
                msg = json.loads(message)
                event = msg.get("event")
                data = msg.get("data", {})
                channel = msg.get("channel")
                
                if event == "pusher:subscribe":
                    channel_name = data.get("channel")
                    if channel_name:
                        if channel_name not in channels:
                            channels[channel_name] = set()
                        channels[channel_name].add(websocket)
                        subscribed_channels.add(channel_name)
                        
                        logger.info(f"Client {client_id} subscribed to {channel_name}")
                        
                        # Send subscription success (only ONCE, with presence if needed)
                        if channel_name.startswith("presence-"):
                            if channel_name not in presence_data:
                                presence_data[channel_name] = {}
                            
                            await send_event(websocket, "pusher_internal:subscription_succeeded", {
                                "presence": {
                                    "ids": list(presence_data[channel_name].keys()),
                                    "hash": presence_data[channel_name]
                                }
                            }, channel_name)
                        else:
                            await send_event(websocket, "pusher_internal:subscription_succeeded", {}, channel_name)
                
                elif event == "pusher:unsubscribe":
                    channel_name = data.get("channel")
                    if channel_name and channel_name in channels:
                        channels[channel_name].discard(websocket)
                        subscribed_channels.discard(channel_name)
                        logger.info(f"Client {client_id} unsubscribed from {channel_name}")
                
                elif event == "pusher:ping":
                    await send_event(websocket, "pusher:pong", {})
                
                elif event == "client-event":
                    # Handle client-triggered events (for HITL responses)
                    if channel and channel in channels:
                        await broadcast_to_channel(channel, data.get("event"), data.get("data"), websocket)
                

                else:
                    # Handle custom events (like state_update)
                    if channel:
                        if event == "state_update" and channel.startswith("presence-"):
                            agent_id = data.get("source", {}).get("agent_id")
                            if agent_id:
                                if channel not in presence_data:
                                    presence_data[channel] = {}
                                presence_data[channel][agent_id] = data
                                logger.info(f"Cached state for {agent_id} in {channel}. Current cache size: {len(presence_data[channel])}")
                        
                        if channel in channels:
                            await broadcast_to_channel(channel, event, data)
                            logger.info(f"Broadcasted event '{event}' to channel '{channel}'")

                        
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from client {client_id}: {message}")
            except Exception as e:
                logger.error(f"Error handling message from {client_id}: {e}")
    
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_id}")
    finally:
        # Clean up subscriptions
        for channel_name in subscribed_channels:
            if channel_name in channels:
                channels[channel_name].discard(websocket)


async def main():
    """Start the WebSocket server."""
    logger.info(f"Starting Curvature Event Bus on ws://{HOST}:{PORT}")
    logger.info(f"App ID: {APP_ID}")
    logger.info(f"App Key: {APP_KEY}")
    
    async with websockets.serve(handle_connection, HOST, PORT, ping_interval=30, ping_timeout=10):
        logger.info(f"WebSocket server running on ws://{HOST}:{PORT}")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
