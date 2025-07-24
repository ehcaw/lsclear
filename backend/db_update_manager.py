from typing import Dict, Set
from fastapi import WebSocket
import json
from datetime import datetime, timezone

class DBUpdateManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        """Register a new WebSocket connection for a user"""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        print(f"New WebSocket connection for user {user_id}")
        return websocket

    async def disconnect(self, user_id: str, websocket: WebSocket = None):
        """Remove a WebSocket connection"""
        if user_id not in self.active_connections:
            return
            
        if websocket:
            try:
                await websocket.close()
                self.active_connections[user_id].discard(websocket)
                print(f"Closed WebSocket for user {user_id}")
            except Exception as e:
                print(f"Error closing WebSocket: {e}")
        
        # Clean up if no more connections for this user
        if not self.active_connections[user_id]:
            del self.active_connections[user_id]
            print(f"No more active WebSocket connections for user {user_id}")

    async def send_personal_message(self, message: str, user_id: str):
        """Send a message to all WebSocket connections for a user"""
        if user_id not in self.active_connections:
            return False
            
        disconnected = set()
        for connection in list(self.active_connections[user_id]):
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error sending message to WebSocket: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected sockets
        for connection in disconnected:
            await self.disconnect(user_id, connection)
            
        return True

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