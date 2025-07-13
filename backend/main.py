import os
import pty
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
from supabase import create_client, Client
import tempfile
from dotenv import load_dotenv
import shutil

load_dotenv()

app = FastAPI()
url: str = os.environ["SUPABASE_URL"]
key: str = os.environ["SUPABASE_ANON_KEY"]
supabase: Client = create_client(url, key)

async def fetch_files_from_db(user_id: str):
    # response = (
    #     supabase.table("afterquery.files")
    #     .select("*")
    #     .execute()
    # )
    # print(response)
    # return response
    """
    Fetches file data from the database for a given session/user.
    Replace this with your actual database logic.
    """
    print(f"Fetching files for user: {user_id}")
    # Example: Query your database using the session_id (or a user_id associated with it)
    # import your_db_connector
    # files = await your_db_connector.get_files(user_id=...)
    return [
        {
            "name": "main.py",
            "content": "# Welcome to your personal sandbox!\nprint('Hello from main.py!')\n"
        },
        {
            "name": "data.txt",
            "content": "This is some data from your database."
        },
        {
            "name": "README.md",
            "content": "## Project Files\n\n- `main.py`: The main script.\n- `data.txt`: A data file."
        }
    ]
async def fetch_file_structure_from_db(user_id: str):
    response = (
        supabase.table("afterquery.file_structures")
        .select("*")
        .execute()
    )
    print(response)
    return response

@app.websocket("/ws/{user_id}")
async def ws_pty(ws: WebSocket, user_id: str):
    await ws.accept()

    # The 'with' block now wraps the entire user session.
    # The directory will exist until the user disconnects.
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # 1. Fetch and write files to the temporary directory
            files_data = await fetch_files_from_db(user_id)
            for file_info in files_data:
                file_path = os.path.join(temp_dir, file_info["name"])
                with open(file_path, "w") as f:
                    f.write(file_info["content"])

            print(f"Populated {temp_dir} for session {user_id}")

            # 2. Fork a process to run the shell *inside the directory*
            master_fd, slave_fd = pty.openpty()
            pid = os.fork()

            if pid == 0:
                # --- CHILD PROCESS (The Shell) ---
                os.setsid()
                os.close(master_fd)

                # CRITICAL STEP: Change the current directory to the temp one
                os.chdir(temp_dir)

                # Set up the PTY as standard I/O
                os.dup2(slave_fd, 0)
                os.dup2(slave_fd, 1)
                os.dup2(slave_fd, 2)
                if slave_fd > 2:
                    os.close(slave_fd)

                # Start the shell. It will now be running inside temp_dir.
                shell = os.environ.get("SHELL", "/bin/bash")
                os.execv(shell, [shell])
            else:
                # --- PARENT PROCESS (Your FastAPI App) ---
                os.close(slave_fd)
                loop = asyncio.get_event_loop()

                # Function to read from the shell and send to the client
                def read_pty():
                    try:
                        data = os.read(master_fd, 1024)
                        asyncio.create_task(ws.send_text(data.decode(errors="ignore")))
                    except OSError:
                        pass

                loop.add_reader(master_fd, read_pty)

                # Loop to read from the client and send to the shell
                while True:
                    data = await ws.receive_text()
                    os.write(master_fd, data.encode())

        except (WebSocketDisconnect, asyncio.CancelledError):
            # This happens when the user closes their terminal/browser tab
            print(f"Session {user_id} disconnected.")
        finally:
            # This 'finally' block is for cleaning up the PTY, not the directory.
            # The directory is cleaned up automatically by the 'with' statement
            # after this function returns.
            if 'loop' in locals() and 'master_fd' in locals():
                loop.remove_reader(master_fd)
                os.close(master_fd)

            print(f"Cleaned up PTY for session {user_id}. Temporary directory {temp_dir} will now be removed.")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
