from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import docker
import uuid, asyncio, json, traceback
import tarfile
import io
import os

app = FastAPI()
client = docker.from_env()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for session -> container mapping
# In production, you'd use a proper database
session_containers = {}
user_containers = {}  # Maps user_id to container_id

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

def make_tar_archive(name, file_path):
    """Create a tar archive for a single file"""
    tar_buffer = io.BytesIO()
    with tarfile.open(fileobj=tar_buffer, mode='w') as tar:
        tar.add(file_path, arcname=name)
    tar_buffer.seek(0)
    return tar_buffer.getvalue()

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
                container.start()
            print(f"Reusing existing container {container.id} for user {user_id}")
            return container
    except Exception as e:
        print(f"Error finding existing container: {e}")

    # Create new container if none exists
    print(f"Creating new container for user {user_id}")
    container = client.containers.run(
        "ehcaw/lsclear-sandbox:latest",
        command=["/bin/sleep", "infinity"],  # Keep container running
        tty=True,
        detach=True,
        working_dir="/root",
        network_disabled=True,
        mem_limit="1g",  # Increased memory limit
        cpu_quota=50000,
        labels={"user_id": user_id, "managed_by": "terminal"},
        name=f"terminal-{user_id}",
        remove=False,
        auto_remove=False,
        environment={
            "TERM": "xterm-256color",
            "HOME": "/root",
            "SHELL": "/bin/bash",
            "USER": "root"
        },
        volumes={
            '/var/run/docker.sock': {
                'bind': '/var/run/docker.sock',
                'mode': 'ro'
            }
        },
        privileged=True  # Required for some operations
    )
    
    # Install basic tools
    exit_code, output = container.exec_run(
        "apt-get update && apt-get install -y bash-completion vim nano curl wget git",
        tty=True
    )
    
    # Create a simple bashrc with basic settings
    try:
        # Set a simple prompt
        container.exec_run("echo \"export PS1='[\\u@\\h \\W]\\\\$ '\" > /root/.bashrc", tty=True)
        # Add some useful aliases
        container.exec_run("echo \"alias ll='ls -la'\" >> /root/.bashrc", tty=True)
        # Set proper permissions
        container.exec_run("chmod 644 /root/.bashrc", tty=True)
    except Exception as e:
        print(f"Warning: Failed to set up bashrc: {e}")
    
    print(f"Created new container {container.id} for user {user_id}")
    return container

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
            "created_at": datetime.utcnow().isoformat()
        }

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

@app.get("/api/files/{sid}/{name}")
async def get_file(sid: str, name: str):
    # lookup container by sid
    if sid not in session_containers:
        raise HTTPException(status_code=404, detail="Session not found")

    container_id = session_containers[sid]
    try:
        container = client.containers.get(container_id)
        # Get file from container
        bits, stat = container.get_archive(f"/workspace/{name}")
        # Extract file content from tar archive
        tar_buffer = io.BytesIO()
        for chunk in bits:
            tar_buffer.write(chunk)
        tar_buffer.seek(0)

        with tarfile.open(fileobj=tar_buffer, mode='r') as tar:
            file_obj = tar.extractfile(name)
            if file_obj:
                content = file_obj.read().decode('utf-8')
                return {"content": content}
            else:
                raise HTTPException(status_code=404, detail="File not found")
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/files/{sid}/{name}")
async def save_file(sid: str, name: str, content: str):
    # lookup container by sid
    if sid not in session_containers:
        raise HTTPException(status_code=404, detail="Session not found")

    container_id = session_containers[sid]
    try:
        container = client.containers.get(container_id)

        # Write content to temporary file
        temp_file = f"/tmp/{name}"
        with open(temp_file, "w") as f:
            f.write(content)

        # Create tar archive and put it in container
        tar_data = make_tar_archive(name, temp_file)
        container.put_archive("/workspace", tar_data)

        # Clean up temp file
        os.remove(temp_file)

        return {"ok": True}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
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

    # Set CORS headers for WebSocket
    origin = ws.headers.get('origin')
    print(f"Origin: {origin}")

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
                        print(f"Sending text data to container: {repr(text)}")
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
