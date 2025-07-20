# In user_file_system.py
import os
import json
import io
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path, PurePosixPath
import docker
from postgres import NeonDB

class FileSystemManager:
    def __init__(self, user_id: str, container_id: str, base_path: str = "/workspace"):
        self.user_id = user_id
        self.base_path = PurePosixPath(base_path)  # Using PurePosixPath for container paths
        self.db = NeonDB()
        self.docker_client = docker.from_env()
        self.container = self.docker_client.containers.get(container_id)
        
    def initialize_file_structure(self) -> None:
        """Initialize the file structure in the container based on the database"""
        # Get the root directory structure
        root_nodes = self.db.get_user_file_structure(self.user_id)
        if not root_nodes:
            # Create a default structure if none exists
            self._create_default_structure()
            root_nodes = self.db.get_user_file_structure(self.user_id)

        # Create the file structure
        for node in root_nodes:
            self._create_structure(node)
            
        # Populate file contents
        for node in root_nodes:
            self._sync_file_contents(node)

    def _create_default_structure(self) -> None:
        """Create a default file structure for new users"""
        try:
            # Create a main.py file
            self.db.create_node(
                user_id=self.user_id,
                name="main.py",
                is_dir=False,
                content="# Welcome to your project!\nprint('Hello, World!')"
            )
        except Exception as e:
            print(f"Error creating default structure: {e}")

    def _create_structure(self, node: Dict, current_path: PurePosixPath = None) -> None:
        """Create directory and file structure in the container"""
        if current_path is None:
            current_path = self.base_path

        item_path = current_path / node['name']

        if node.get('is_dir'):
            # It's a directory - create it in the container
            self._create_directory_in_container(item_path)
            for child in node.get('children', []):
                self._create_structure(child, item_path)
        else:
            # It's a file - create an empty file
            self._create_empty_file_in_container(item_path)

    def _sync_file_contents(self, node: Dict, current_path: PurePosixPath = None) -> None:
        """Sync file contents from the database to the container"""
        if current_path is None:
            current_path = self.base_path

        item_path = current_path / node['name']

        if node.get('is_dir'):
            # It's a directory, process children
            for child in node.get('children', []):
                self._sync_file_contents(child, item_path)
        else:
            # It's a file, sync content
            if 'content' in node and node['content'] is not None:
                self._write_file_to_container(item_path, node['content'])
            else:
                # Fallback to database if content isn't in the node
                content = self.db.get_file_content(self.user_id, node['id'])
                if content is not None:
                    self._write_file_to_container(item_path, content)

    def _create_directory_in_container(self, path: PurePosixPath) -> None:
        """Create a directory in the container"""
        cmd = f"mkdir -p {path}"
        self.container.exec_run(cmd, tty=True)

    def _create_empty_file_in_container(self, path: PurePosixPath) -> None:
        """Create an empty file in the container"""
        cmd = f"touch {path}"
        self.container.exec_run(cmd, tty=True)

    def _write_file_to_container(self, path: PurePosixPath, content: str) -> None:
        """Write content to a file in the container"""
        try:
            # Ensure parent directory exists
            parent_dir = str(path.parent)
            if parent_dir != '/':
                self._create_directory_in_container(PurePosixPath(parent_dir))
            
            # Create a temporary file with the content
            temp_file = f"/tmp/{path.name}"
            with open(temp_file, "w") as f:
                f.write(content)
            
            try:
                # Use docker cp to copy the file to the container
                container_path = f"{self.container.id}:/{path}"
                cmd = f"docker cp {temp_file} {container_path}"
                os.system(cmd)
            finally:
                # Ensure we clean up the temp file
                os.remove(temp_file)
                
        except Exception as e:
            print(f"Error writing file to container: {e}")
            raise

    def save_file(self, file_path: str, content: str) -> None:
        """Save file content to the database and container"""
        # Update in database first
        self.db.update_file_content(
            user_id=self.user_id,
            file_path=file_path,
            content=content
        )
        
        # Then sync to container
        full_path = self.base_path / file_path
        self._write_file_to_container(full_path, content)

    def delete_file(self, file_path: str) -> None:
        """Delete a file from both the database and container"""
        # Delete from database first
        self.db.delete_file(
            user_id=self.user_id,
            file_path=file_path
        )
        
        # Then delete from container
        full_path = self.base_path / file_path
        self.container.exec_run(f"rm -f {full_path}", tty=True)

    def update_structure(self, new_structure: Union[Dict, List]) -> None:
        """Update the file structure in both the container and database"""
        # Save to database first
        self.db.update_file_structure(self.user_id, new_structure)
        
        # Then update the container's filesystem
        self.initialize_file_structure()