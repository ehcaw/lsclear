# In postgres.py
from datetime import datetime
import psycopg2
from typing import Dict, List, Any, Optional, Union
import json
from dotenv import load_dotenv
import os

load_dotenv()

class NeonDB:
    def __init__(self): 
        self.conn = psycopg2.connect(
            host=os.getenv("PGHOST"),
            port=os.getenv("PGPORT"),
            user=os.getenv("PGUSER"),
            password=os.getenv("PGPASSWORD"),
            dbname=os.getenv("PGDATABASE"),
        )
        self.conn.autocommit = True

    def get_user_file_structure(self, user_id: str) -> Optional[Dict]:
        """Get the file structure for a user"""
        with self.conn.cursor() as cursor:
            cursor.execute(
                "SELECT structure FROM file_structures WHERE user_id = %s",
                (user_id,)
            )
            result = cursor.fetchone()
            return result[0] if result else None

    def get_file_content(self, user_id: str, file_path: str) -> Optional[str]:
        """Get the content of a specific file"""
        with self.conn.cursor() as cursor:
            cursor.execute(
                "SELECT content FROM files WHERE user_id = %s AND file_path = %s",
                (user_id, file_path)
            )
            result = cursor.fetchone()
            return result[0] if result else None

    def update_file_content(
        self,
        user_id: str,
        file_path: str,
        content: str
    ) -> None:
        """Update or create a file's content"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO files (user_id, file_path, content, created_at, updated_at)
                VALUES (%s, %s, %s, NOW(), NOW())
                ON CONFLICT (user_id, file_path)
                DO UPDATE SET
                    content = EXCLUDED.content,
                    updated_at = NOW()
            """, (user_id, file_path, content))

    def delete_file(self, user_id: str, file_path: str) -> None:
        """Delete a file"""
        with self.conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM files WHERE user_id = %s AND file_path = %s",
                (user_id, file_path)
            )

    def update_file_structure(
        self,
        user_id: str,
        structure: Union[Dict, List]
    ) -> None:
        """Update the file structure for a user"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO file_structures (user_id, structure, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (user_id)
                DO UPDATE SET
                    structure = EXCLUDED.structure,
                    updated_at = NOW()
            """, (user_id, json.dumps(structure)))