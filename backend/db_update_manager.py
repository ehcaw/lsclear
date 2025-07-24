# Add these imports at the top of main.py
from typing import Dict, Set
from fastapi import WebSocket 
import json
from datetime import datetime, timezone

class DBUpdateManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        print(f"New WebSocket connection for user {user_id}")

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except Exception as e:
                print(f"Error closing WebSocket: {e}")
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(message)
                except:
                    self.disconnect(user_id, connection)

# Create a global instance
ws_manager = DBUpdateManager()

async def notify_file_update(user_id: str, action: str, path: str):
    message = json.dumps({
        "type": "file_update",
        "action": action,
        "path": path,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    await ws_manager.send_personal_message(message, user_id)