from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import docker
import uuid, asyncio, json, traceback
import os
import tarfile
from io import BytesIO
from user_file_system import FileSystemManager
from postgres import NeonDB
from pydantic import BaseModel
import shlex
from db_update_manager import ws_manager, notify_file_update

class FSEvent(BaseModel):
    user_id: str
    cmd: str
    cwd: str | None = "/workspace"

class FileUpdate(BaseModel):
    content: str
    userId: str
    filePath: str = None

app = FastAPI()
client = docker.from_env()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://lsclear.vercel.app", "http://localhost:3000", "https://documix.xyz"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Explicitly expose all headers
    max_age=600,  # Cache preflight response for 10 minutes
)

neon_db = NeonDB()

session_containers = {}
user_containers = {}  # Maps user_id to container_id

@app.get("/test")
async def test():
    return {"status": "ok"}

def cleanup_old_containers():
    """Clean up old containers that are no longer in use"""
    try:
        # Get all our managed containers
        containers = client.containers.list(
            all=True,
            filters={"label": ["managed_by=terminal"]}
        )

        # Find containers not associated with any active user
        active_container_ids = set(user_containers.values())
        for container in containers:
            if container.id not in active_container_ids:
                try:
                    print(f"Cleaning up unused container {container.id}")
                    container.remove(force=True)
                except Exception as e:
                    print(f"Error cleaning up container {container.id}: {e}")
    except Exception as e:
        print(f"Error in cleanup_old_containers: {e}")

def get_or_create_container(user_id: str):
    """Get existing container for user or create a new one"""
    # Try to find existing container for this user
    try:
        containers = client.containers.list(
            all=True,
            filters={"label": [f"user_id={user_id}", "managed_by=terminal"]}
        )

        # If container exists and is running, return it
        if containers:
            container = containers[0]
            if container.status != 'running':
                print(f"Container {container.id} is {container.status}, attempting to start...")
                try:
                    container.start()
                    # Verify the container is actually running
                    container.reload()
                    if container.status != 'running':
                        print(f"Failed to start container {container.id}, removing and creating new one...")
                        container.remove(force=True)
                        raise docker.errors.NotFound("Container failed to start")
                except Exception as e:
                    print(f"Error starting container {container.id}: {e}")
                    container.remove(force=True)
                    raise
            print(f"Reusing existing container {container.id} for user {user_id}")
            return container
    except Exception as e:
        print(f"Error finding existing container: {e}")
        if 'containers' in locals() and containers:
            try:
                containers[0].remove(force=True)
            except:
                pass

    # Create new container if none exists or if there was an error with the existing one
    print(f"Creating new container for user {user_id}")
    try:
        container = client.containers.run(
            "ehcaw/lsclear:latest",
            command=["tail", "-f", "/dev/null"],  # Keep container running
            tty=True,
            detach=True,
            working_dir="/workspace",
            network_disabled=False,
            mem_limit="1g",
            cpu_quota=50000,
            labels={"user_id": user_id, "managed_by": "terminal"},
            name=f"terminal-{user_id}",
            remove=False,
            restart_policy={"Name": "on-failure", "MaximumRetryCount": 3},
            healthcheck={
                "Test": ["CMD-SHELL", "exit 0"],
                "Interval": 30000000000,  # 30 seconds
                "Timeout": 10000000000,   # 10 seconds
                "Retries": 3
            }
        )
        
        # Wait a moment for the container to start
        import time
        time.sleep(2)
        
        # Verify the container is running
        container.reload()
        if container.status != 'running':
            raise Exception(f"Container failed to start. Status: {container.status}")
            
        print(f"Successfully created container {container.id} for user {user_id}")
        return container
        
    except Exception as e:
        print(f"Error creating container: {e}")
        # Clean up any partially created container
        if 'container' in locals():
            try:
                container.remove(force=True)
            except:
                pass
        raise

@app.post("/terminal/start")
async def create_session(user_data: dict):
    """Start or resume a terminal session"""
    user_id = user_data.get('user_id')
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    try:
        # Clean up any old containers first
        cleanup_old_containers()

        # Get or create container for this user
        container = get_or_create_container(user_id)

        # Track this user's container
        user_containers[user_id] = container.id

        # Generate a new session ID
        sid = str(uuid.uuid4())

        # Store session info
        session_containers[sid] = {
            "container_id": container.id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # prepopulate file structure into the container
        file_manager = FileSystemManager(user_id=user_id, container_id=container.id, base_path="/workspace")
        file_manager.initialize_file_structure()
        

        return {
            "session_id": sid,
            "container_id": container.id,
            "is_new_container": container.attrs["State"]["Running"]
        }
    except Exception as e:
        print(f"Error creating session: {e}")
        # Clean up any partially created resources
        if 'container' in locals():
            try:
                container.remove(force=True)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fs-event")
async def fs_event(evt: FSEvent):
    print("Received:", evt)

    # ── 1. split once ───────────────────────────────────────────────
    action, *args = shlex.split(evt.cmd)        # args is now a **list**
    if not args:                                # user just hit <Enter>
        return {"ok": True}

    # ── 2. make paths absolute & safe ───────────────────────────────
    def _abs(p: str) -> str:
        p = p if os.path.isabs(p) else os.path.join(evt.cwd, p)
        full = os.path.normpath(p)
        if not full.startswith("/workspace"):
            raise HTTPException(400, "Path escapes workspace")
        return full

    # ── 3. grab the user’s running container ────────────────────────
    container_id = user_containers.get(evt.user_id)
    if not container_id:
        raise HTTPException(404, "No live container for user")

    fsm = FileSystemManager(evt.user_id, container_id, base_path="/workspace")

    # ── 4. handle each verb ─────────────────────────────────────────
    try:
        if action == "touch":
            path = _abs(args[0])
            rel_path = os.path.relpath(path, "/workspace")
            # Create parent directories if they don't exist
            parent_path = os.path.dirname(rel_path)
            parent_id = None
            
            if parent_path and parent_path != '.':
                # Find or create parent directory
                parent_parts = parent_path.split(os.path.sep)
                current_parent_id = None
                
                for part in parent_parts:
                    try:
                        # Try to find existing parent
                        if current_parent_id is None:
                            cursor = fsm.db.conn.cursor()
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id IS NULL AND name = %s",
                                (evt.user_id, part)
                            )
                        else:
                            cursor = fsm.db.conn.cursor()
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id = %s AND name = %s",
                                (evt.user_id, current_parent_id, part)
                            )
                            
                        result = cursor.fetchone()
                        if result:
                            current_parent_id = result[0]
                        else:
                            # Create the directory if it doesn't exist
                            new_dir = fsm.db.create_node(
                                user_id=evt.user_id,
                                name=part,
                                is_dir=True,
                                parent_id=current_parent_id
                            )
                            current_parent_id = new_dir['id']
                            
                    except Exception as e:
                        print(f"Error creating parent directories: {e}")
                        raise
                    
                    parent_id = current_parent_id
            
            # Create the file
            file_name = os.path.basename(rel_path)
            try:
                fsm.db.create_node(
                    user_id=evt.user_id,
                    name=file_name,
                    is_dir=False,
                    parent_id=parent_id,
                    content=""
                )
                await notify_file_update(evt.user_id, "create", path)
            except Exception as e:
                if "duplicate" in str(e).lower():
                    # File exists, update it
                    pass  # Just continue, the file is already there
                else:
                    raise
                    
        elif action == "mkdir":
            path = _abs(args[0])
            rel_path = os.path.relpath(path, "/workspace")
            parent_path = os.path.dirname(rel_path)
            dir_name = os.path.basename(rel_path)
            parent_id = None
            
            # Handle parent directories
            if parent_path and parent_path != '.':
                # Find or create parent directories
                parent_parts = parent_path.split(os.path.sep)
                current_parent_id = None
                
                for part in parent_parts:
                    try:
                        if current_parent_id is None:
                            cursor = fsm.db.conn.cursor()
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id IS NULL AND name = %s",
                                (evt.user_id, part)
                            )
                        else:
                            cursor = fsm.db.conn.cursor()
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id = %s AND name = %s",
                                (evt.user_id, current_parent_id, part)
                            )
                            
                        result = cursor.fetchone()
                        if result:
                            current_parent_id = result[0]
                        else:
                            # Create the directory if it doesn't exist
                            new_dir = fsm.db.create_node(
                                user_id=evt.user_id,
                                name=part,
                                is_dir=True,
                                parent_id=current_parent_id
                            )
                            current_parent_id = new_dir['id']
                            
                    except Exception as e:
                        print(f"Error creating parent directories: {e}")
                        raise
                    
                    parent_id = current_parent_id
            
            # Create the directory
            try:
                fsm.db.create_node(
                    user_id=evt.user_id,
                    name=dir_name,
                    is_dir=True,
                    parent_id=parent_id
                )
                await notify_file_update(evt.user_id, "create", path)
            except Exception as e:
                if "duplicate" in str(e).lower():
                    # Directory exists, that's fine
                    pass
                else:
                    raise
                    
        elif action == "rm":
            path = _abs(args[0])
            rel_path = os.path.relpath(path, "/workspace")
            cursor = fsm.db.conn.cursor()
            # Find the node in the database
            cursor.execute("""
                WITH RECURSIVE node_tree AS (
                    -- Start with the target node
                    SELECT id, parent_id, name, is_dir
                    FROM fs_nodes 
                    WHERE user_id = %s 
                    AND name = %s
                    AND parent_id IS NULL
                    AND %s = name
                    
                    UNION ALL
                    
                    -- Recursively find all children
                    SELECT n.id, n.parent_id, n.name, n.is_dir
                    FROM fs_nodes n
                    JOIN node_tree nt ON n.parent_id = nt.id
                    WHERE n.user_id = %s
                )
                SELECT id, is_dir FROM node_tree
            """, (evt.user_id, rel_path, rel_path, evt.user_id))
            
            nodes_to_delete = cursor.fetchall()
            
            if not nodes_to_delete:
                # Try to find the node with parent path
                path_parts = rel_path.split(os.path.sep)
                if len(path_parts) > 1:
                    parent_path = os.path.sep.join(path_parts[:-1])
                    file_name = path_parts[-1]
                    
                    # Find parent ID
                    parent_id = None
                    parent_parts = parent_path.split(os.path.sep)
                    current_parent_id = None
                    
                    for part in parent_parts:
                        if current_parent_id is None:
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id IS NULL AND name = %s",
                                (evt.user_id, part)
                            )
                        else:
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id = %s AND name = %s",
                                (evt.user_id, current_parent_id, part)
                            )
                            
                        result = cursor.fetchone()
                        if not result:
                            raise HTTPException(404, "File or directory not found")
                        current_parent_id = result[0]
                    
                    parent_id = current_parent_id
                    
                    # Now find the node with this parent
                    cursor.execute(
                        "SELECT id, is_dir FROM fs_nodes WHERE user_id = %s AND parent_id = %s AND name = %s",
                        (evt.user_id, parent_id, file_name)
                    )
                    nodes_to_delete = cursor.fetchall()
            
            if not nodes_to_delete:
                raise HTTPException(404, "File or directory not found")
                
            # Delete from database (cascading delete will handle children)
            for node_id, is_dir in nodes_to_delete:
                fsm.db.delete_node(evt.user_id, node_id)
            
            await notify_file_update(evt.user_id, "delete", path)
            
        elif action == "mv" and len(args) == 2:
            src = _abs(args[0])
            dest = _abs(args[1])
            
            # Get source path relative to workspace
            src_rel = os.path.relpath(src, "/workspace")
            dest_rel = os.path.relpath(dest, "/workspace")
            
            # Find source node in database
            cursor = fsm.db.conn.cursor()
            
            # First try to find the node with the full path
            cursor.execute("""
                WITH RECURSIVE node_path AS (
                    -- Start with the target node
                    SELECT id, parent_id, name, is_dir, ARRAY[name] as path
                    FROM fs_nodes 
                    WHERE user_id = %s AND parent_id IS NULL
                    
                    UNION ALL
                    
                    -- Recursively find all children
                    SELECT f.id, f.parent_id, f.name, f.is_dir, np.path || f.name
                    FROM fs_nodes f
                    JOIN node_path np ON f.parent_id = np.id
                    WHERE f.user_id = %s
                )
                SELECT id, is_dir FROM node_path 
                WHERE array_to_string(path, '/') = %s
            """, (evt.user_id, evt.user_id, src_rel))
            
            result = cursor.fetchone()
            
            if not result:
                # If not found with full path, try to find by name (last resort)
                src_name = os.path.basename(src_rel)
                cursor.execute(
                    "SELECT id, is_dir FROM fs_nodes WHERE user_id = %s AND name = %s",
                    (evt.user_id, src_name)
                )
                result = cursor.fetchone()
                if not result:
                    raise HTTPException(404, "Source file or directory not found")
            
            node_id, is_dir = result
            
            # Handle destination parent directory
            dest_parent_rel = os.path.dirname(dest_rel)
            dest_name = os.path.basename(dest_rel)
            
            dest_parent_id = None
            if dest_parent_rel and dest_parent_rel != '.':
                # Find or create parent directories
                parent_parts = dest_parent_rel.split(os.path.sep)
                current_parent_id = None
                
                for part in parent_parts:
                    try:
                        if current_parent_id is None:
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id IS NULL AND name = %s",
                                (evt.user_id, part)
                            )
                        else:
                            cursor.execute(
                                "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id = %s AND name = %s",
                                (evt.user_id, current_parent_id, part)
                            )
                            
                        result = cursor.fetchone()
                        if result:
                            current_parent_id = result[0]
                        else:
                            # Create the directory if it doesn't exist
                            new_dir = fsm.db.create_node(
                                user_id=evt.user_id,
                                name=part,
                                is_dir=True,
                                parent_id=current_parent_id
                            )
                            current_parent_id = new_dir['id']
                            
                    except Exception as e:
                        print(f"Error creating parent directories: {e}")
                        raise
                    
                    dest_parent_id = current_parent_id
            
            # Update the node in the database
            cursor.execute(
                "UPDATE fs_nodes SET name = %s, parent_id = %s, updated_at = NOW() WHERE id = %s",
                (dest_name, dest_parent_id, node_id)
            )
            
            await notify_file_update(evt.user_id, "move", src, dest)
            
        return {"ok": True}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in fs_event: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, str(e))

@app.get("/api/files/{sid}/{name}")
async def get_file(sid: str, name: str):
    # lookup container by sid
    if sid not in session_containers:
        raise HTTPException(status_code=404, detail="Session not found")

    container_id = session_containers[sid]
    try:
        container = client.containers.get(container_id)
        # Get file content directly from the container
        exit_code, output = container.exec_run(f"cat /workspace/{name}")
        if exit_code != 0:
            raise HTTPException(status_code=404, detail="File not found")
        return {"content": output.decode('utf-8')}
    except Exception as e:
        print(f"Error getting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/files/{file_id}")
async def update_file(file_id: str, update: FileUpdate):
    """
    Update a file's content and sync it to the container
    """
    try:
        print(update)
        with neon_db.conn.cursor() as cursor:
            # Get the full path of the file by recursively traversing its parents
            cursor.execute("""
                WITH RECURSIVE file_path AS (
                    SELECT id, parent_id, name, name::text AS path
                    FROM fs_nodes
                    WHERE id = %s AND user_id = %s
                    UNION ALL
                    SELECT p.id, p.parent_id, p.name, (fp.path || '/' || p.name)
                    FROM fs_nodes p
                    JOIN file_path fp ON p.id = fp.parent_id
                )
                SELECT path FROM file_path WHERE id = %s;
            """, (file_id, update.userId, file_id))
            
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="File not found or access denied")
            
            # The query builds the path in reverse, so we split and reverse it
            path_parts = result[0].split('/')
            path_parts.reverse()
            full_path = "/".join(path_parts)
            
            # Update the file content in the database
            cursor.execute("""
                UPDATE fs_nodes 
                SET content = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s AND NOT is_dir
            """, (update.content, file_id, update.userId))
            neon_db.conn.commit()

        # Get the user's container
        container_id = user_containers.get(update.userId)
        if not container_id:
            raise HTTPException(status_code=404, detail="No active container found for user")
        
        container = client.containers.get(container_id)
        if container.status != 'running':
            container.start()

        # --- Safely write file to container using a tar stream ---
        
        # In-memory tarfile
        pw_tarstream = BytesIO()
        pw_tar = tarfile.TarFile(fileobj=pw_tarstream, mode='w')
        
        # Encode content to bytes
        content_bytes = update.content.encode('utf-8')
        
        tarinfo = tarfile.TarInfo(name=full_path)
        tarinfo.size = len(content_bytes)
        
        # Add file to tar stream
        pw_tar.addfile(tarinfo, BytesIO(content_bytes))
        
        pw_tar.close()
        pw_tarstream.seek(0)
        
        # Put the tar stream into the container's workspace
        container.put_archive(path='/workspace', data=pw_tarstream)

        return {"status": "success", "message": "File updated successfully"}
            
    except docker.errors.NotFound:
        if update.userId in user_containers:
            del user_containers[update.userId]
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
        print(f"Error updating file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/terminal/{sid}")
async def terminal_status(sid: str):
    """
    Poll endpoint: returns {status: "RUNNING" | "FAILED" | "PENDING"}
    """
    if sid not in session_containers:
        raise HTTPException(status_code=404, detail="Session not found")

    container_id = session_containers[sid]
    try:
        container = client.containers.get(container_id)
        if container.status == "running":
            return {"status": "RUNNING"}
        elif container.status == "exited":
            return {"status": "FAILED"}
        else:
            return {"status": "PENDING"}
    except docker.errors.NotFound:
        return {"status": "FAILED"}

@app.delete("/terminal/{sid}")
async def terminal_stop(sid: str):
    """
    Gracefully stops and removes the container
    """
    if sid not in session_containers:
        raise HTTPException(status_code=404, detail="Session not found")

    container_id = session_containers[sid]
    try:
        container = client.containers.get(container_id)
        container.stop()
        container.remove()
        del session_containers[sid]
        return {"ok": True}
    except docker.errors.NotFound:
        # Container already gone
        del session_containers[sid]
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/terminal/cleanup/{user_id}")
async def cleanup_user_container(user_id: str):
    """Clean up a user's container when they're done"""
    try:
        print(f"Cleanup request for user: {user_id}")
        if not user_id or user_id == 'undefined' or user_id == 'null':
            print("No valid user ID provided for cleanup")
            return {"status": "skipped", "message": "No user ID provided"}

        if user_id in user_containers:
            container_id = user_containers[user_id]
            try:
                container = client.containers.get(container_id)
                print(f"Cleaning up container {container_id} for user {user_id}")
                container.remove(force=True)
                # Clean up any sessions for this user
                global session_containers
                session_containers = {k: v for k, v in session_containers.items()
                                   if v.get('user_id') != user_id}
                del user_containers[user_id]
                return {"status": "success", "message": f"Container {container_id} removed"}
            except docker.errors.NotFound:
                # Container already removed
                if user_id in user_containers:
                    del user_containers[user_id]
                return {"status": "success", "message": "Container not found"}
        return {"status": "not_found", "message": "No container found for user"}
    except Exception as e:
        print(f"Error cleaning up container for user {user_id}: {e}")
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail=str(e))
        raise

@app.websocket("/terminal/ws/{sid}")
async def terminal_ws(ws: WebSocket, sid: str):
    """
    WebSocket proxy to the running container's bash
    """

    if not sid:
        print("Error: session_id query parameter is required")
        await ws.close(code=1008, reason="session_id query parameter is required")
        return

    print(f"\n=== New WebSocket Connection ===")
    print(f"Session ID: {sid}")
    print(f"Client headers: {dict(ws.headers)}")
    print(f"Query params: {dict(ws.query_params)}")
    print(f"Available sessions: {list(session_containers.keys())}")

    # Check if session exists
    if sid not in session_containers:
        error_msg = f"Session {sid} not found in {list(session_containers.keys())}"
        print(f"Error: {error_msg}")
        await ws.close(code=1008, reason=error_msg)
        return

    session = session_containers[sid]
    container_id = session["container_id"]
    user_id = session["user_id"]
    exec_id = None
    sock = None

    print(f"Found container ID: {container_id} for user: {user_id}")

    try:
        print(f"WebSocket connection accepted for session: {sid}")
        await ws.accept()
        loop = asyncio.get_running_loop()

        print(f"Found container ID: {container_id} for session: {sid} (user: {user_id})")
        container = client.containers.get(container_id)
        print(f"Container status: {container.status}")

        # Ensure container is running
        if container.status != 'running':
            print(f"Container {container_id} is not running. Starting...")
            container.start()

        # Default terminal size
        cols = 80
        rows = 24

        # Create exec instance
        exec_config = client.api.exec_create(
            container_id,
            ["/bin/bash", "-i"],
            tty=True,
            stdin=True,
            stdout=True,
            stderr=True,
            environment={
                "TERM": "xterm-256color",
                "COLUMNS": str(cols),
                "LINES": str(rows),
                "HOME": "/root",
                "SHELL": "/bin/bash",
                "USER": "root"
            }
        )
        exec_id = exec_config["Id"]
        print(f"Created exec instance: {exec_id}")

        # Start the exec instance
        sock = client.api.exec_start(exec_id, socket=True, tty=True)
        print("Exec instance started")

        async def handle_messages():
            nonlocal cols, rows
            try:
                while True:
                    message = await ws.receive()
                    text = message.get("text", "")
                    # Only try to parse JSON resize if it actually _looks_ like an object
                    if text.startswith("{"):
                        try:
                            payload = json.loads(text)
                            # Ensure it’s a dict and has a “type” key
                            if isinstance(payload, dict) and payload.get("type") == "resize":
                                new_cols = payload.get("cols", cols)
                                new_rows = payload.get("rows", rows)
                                if (new_cols, new_rows) != (cols, rows):
                                    print(f"Resizing terminal: {cols}x{rows} -> {new_cols}x{new_rows}")
                                    cols, rows = new_cols, new_rows
                                    # positional args only
                                    await loop.run_in_executor(
                                        None,
                                        client.api.exec_resize,
                                        exec_id,
                                        rows,
                                        cols
                                    )
                                # skip the “send to shell” below
                                continue
                        except json.JSONDecodeError:
                            # not valid JSON — fall through
                            pass

                    # If it wasn’t a resize object, send raw text to the container
                    if text and hasattr(sock, "_sock"):
                        sock._sock.send(text.encode("utf-8"))

                    # And handle any binary frames as before
                    if "bytes" in message and hasattr(sock, "_sock"):
                        data = message["bytes"]
                        print(f"Sending binary data to container: {len(data)} bytes")
                        sock._sock.send(data)
            except Exception as e:
                print(f"Error in handle_messages: {e}")
                raise


        async def read_from_container():
            try:
                while True:
                    # pull raw bytes off the underlying socket
                    data = await loop.run_in_executor(
                        None,
                        sock._sock.recv,
                        4096
                    )
                    if not data:
                        break
                    await ws.send_bytes(data)
            except Exception as e:
                print(f"Error reading from container: {e}")
                raise

        # Start both tasks
        await asyncio.gather(
            read_from_container(),
            handle_messages(),  
            return_exceptions=True
        )

    except Exception as e:
        print(f"WebSocket error: {e}")
        print(traceback.format_exc())
        try:
            await ws.close(code=1011, reason=str(e))
        except:
            pass
    finally:
        # Clean up
        print("Cleaning up WebSocket connection")
        if exec_id:
            try:
                client.api.kill(exec_id)
                print(f"Terminated exec instance: {exec_id}")
            except:
                pass
        if sock:
            try:
                sock.close()
            except:
                pass

@app.websocket("/db_update/ws/{user_id}")
async def db_update_websocket(websocket: WebSocket, user_id: str):
    await websocket.accept()
    await ws_manager.connect(user_id, websocket)  
    try:
        while True:
            # Keep the connection alive
            await asyncio.sleep(10)
            try:
                # Send a ping to keep the connection alive
                await websocket.send_json({"type": "ping"})
            except Exception as e:
                print(f"Error sending ping: {e}")
                break
    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected")
        await ws_manager.disconnect(user_id)  
    except Exception as e:
        print(f"Unexpected error: {e}")
        await ws_manager.disconnect(user_id)  
    finally:
        # Ensure cleanup happens even if an exception occurs
        if user_id in ws_manager.active_connections and websocket in ws_manager.active_connections[user_id]:
            ws_manager.active_connections[user_id].remove(websocket)

@app.post("/run")
async def run(user_data: dict):
    user_id = user_data.get('user_id')
    file_path = user_data.get('file_path')  # Full path from frontend
    working_dir = user_data.get('working_dir', '/workspace')  # Default to /workspace if not provided
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    try: 
        container_id = user_containers[user_id]
        container = client.containers.get(container_id)
        
        # Get the directory of the file being executed
        file_dir = os.path.dirname(file_path) if file_path else working_dir
        filename = os.path.basename(file_path) if file_path else 'main.py'
        
        # Execute the command in the file's directory
        cmd = f"cd {file_dir} && python3 {filename}"
        exit_code, output = container.exec_run(
            cmd,
            workdir=file_dir,  # Set working directory
            tty=True
        )
        
        return {
            "exit_code": exit_code,
            "output": output.decode('utf-8') if output else ""
        }
        
    except KeyError:
        raise HTTPException(status_code=404, detail="User container not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))