# In user_file_system.py
import os
import json
import tarfile
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
        structure = self.db.get_user_file_structure(self.user_id)
        if not structure:
            return

        # Create the file structure
        self._create_structure(structure)
        
        # Populate file contents
        self._sync_file_contents(structure)

    def _create_structure(self, structure: Union[Dict, List], current_path: PurePosixPath = None) -> None:
        """Create directory and file structure in the container"""
        if current_path is None:
            current_path = self.base_path

        if isinstance(structure, list):
            for item in structure:
                self._create_structure(item, current_path)
            return

        item_path = current_path / structure['name']

        if 'children' in structure and structure['children']:
            # It's a directory - create it in the container
            self._create_directory_in_container(item_path)
            for child in structure['children']:
                self._create_structure(child, item_path)
        else:
            # It's a file - create an empty file
            self._create_empty_file_in_container(item_path)

    def _sync_file_contents(self, structure: Union[Dict, List], current_path: PurePosixPath = None) -> None:
        """Sync file contents from the database to the container"""
        if current_path is None:
            current_path = self.base_path

        if isinstance(structure, list):
            for item in structure:
                self._sync_file_contents(item, current_path)
            return

        item_path = current_path / structure['name']

        if 'children' in structure and structure['children']:
            # It's a directory, process children
            for child in structure['children']:
                self._sync_file_contents(child, item_path)
        else:
            # It's a file, sync content
            content = self.db.get_file_content(self.user_id, str(item_path.relative_to(self.base_path)))
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
        # Create a tar stream in memory
        tar_stream = io.BytesIO()
        tar = tarfile.TarFile(fileobj=tar_stream, mode='w')
        
        # Create a TarInfo for the file
        tarinfo = tarfile.TarInfo(name=str(path.relative_to('/')))
        content_bytes = content.encode('utf-8')
        tarinfo.size = len(content_bytes)
        
        # Add file to tar
        tar.addfile(tarinfo, io.BytesIO(content_bytes))
        tar.close()
        
        # Rewind the stream
        tar_stream.seek(0)
        
        # Write to container
        self.container.put_archive(path='/', data=tar_stream)

    def save_file(self, file_path: str, content: str) -> None:
        """Save file content to the container and database"""
        full_path = self.base_path / file_path
        self._write_file_to_container(full_path, content)
        
        # Update in database
        self.db.update_file_content(
            user_id=self.user_id,
            file_path=file_path,
            content=content
        )

    def delete_file(self, file_path: str) -> None:
        """Delete a file from both the container and database"""
        full_path = self.base_path / file_path
        self.container.exec_run(f"rm -f {full_path}", tty=True)
        
        # Delete from database
        self.db.delete_file(
            user_id=self.user_id,
            file_path=file_path
        )

    def update_structure(self, new_structure: Union[Dict, List]) -> None:
        """Update the file structure in both the container and database"""
        # Save to database first
        self.db.update_file_structure(self.user_id, new_structure)
        
        # Then update the container's filesystem
        self.initialize_file_structure()