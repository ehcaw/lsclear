# In postgres.py
import psycopg2
from typing import Dict, List, Optional
from dotenv import load_dotenv
import os

load_dotenv()

class NeonDB:
    def __init__(self): 
        self.conn = None
        self.connect()

    def connect(self):
        self.conn = psycopg2.connect(
            host=os.getenv("PGHOST"),
            port=os.getenv("PGPORT"),
            user=os.getenv("PGUSER"),
            password=os.getenv("PGPASSWORD"),
            dbname=os.getenv("PGDATABASE"),
        )
        self.conn.autocommit = True

    def get_user_file_structure(self, user_id: str, parent_id: int = None) -> List[Dict]:
        """Get the file structure for a user as a tree structure"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                WITH RECURSIVE file_tree AS (
                    -- Base case: select root nodes (where parent_id is NULL)
                    SELECT 
                        id, 
                        parent_id, 
                        name, 
                        is_dir, 
                        content,
                        created_at,
                        updated_at,
                        ARRAY[]::TEXT[] as path
                    FROM fs_nodes 
                    WHERE user_id = %s AND (parent_id = %s OR (%s IS NULL AND parent_id IS NULL))
                    
                    UNION ALL
                    
                    -- Recursive case: join with children
                    SELECT 
                        f.id, 
                        f.parent_id, 
                        f.name, 
                        f.is_dir, 
                        f.content,
                        f.created_at,
                        f.updated_at,
                        ft.path || f.name as path
                    FROM fs_nodes f
                    JOIN file_tree ft ON f.parent_id = ft.id
                    WHERE f.user_id = %s
                )
                SELECT 
                    id,
                    parent_id,
                    name,
                    is_dir,
                    content,
                    created_at,
                    updated_at
                FROM file_tree
                ORDER BY is_dir DESC, name
            """, (user_id, parent_id, parent_id, user_id))
            
            nodes = []
            for row in cursor.fetchall():
                node = {
                    'id': row[0],
                    'parent_id': row[1],
                    'name': row[2],
                    'is_dir': row[3],
                    'content': row[4],
                    'created_at': row[5].isoformat() if row[5] else None,
                    'updated_at': row[6].isoformat() if row[6] else None,
                    'children': []
                }
                nodes.append(node)
            
            # Convert flat list to tree structure
            return self._build_tree(nodes)

    def get_file_content(self, user_id: str, file_id: int) -> Optional[str]:
        """Get the content of a specific file by ID"""
        with self.conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT content 
                FROM fs_nodes 
                WHERE user_id = %s AND id = %s AND NOT is_dir
                """,
                (user_id, file_id)
            )
            result = cursor.fetchone()
            return result[0] if result else None

    def update_file_content(
        self,
        user_id: str,
        file_id: int,
        content: str
    ) -> None:
        """Update a file's content by ID"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                UPDATE fs_nodes 
                SET content = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s AND NOT is_dir
                RETURNING id
            """, (content, file_id, user_id))
            
            if not cursor.fetchone():
                raise ValueError("File not found or not a file")

    def delete_node(self, user_id: str, node_id: int) -> None:
        """Delete a file or directory by ID (recursively for directories)"""
        with self.conn.cursor() as cursor:
            # First check if the node exists and belongs to the user
            cursor.execute(
                "SELECT id FROM fs_nodes WHERE id = %s AND user_id = %s",
                (node_id, user_id)
            )
            if not cursor.fetchone():
                raise ValueError("Node not found or access denied")
                
            # Recursively delete all children (PostgreSQL's ON DELETE CASCADE will handle this)
            cursor.execute(
                "DELETE FROM fs_nodes WHERE id = %s RETURNING is_dir",
                (node_id,)
            )

    def create_node(
        self,
        user_id: str,
        name: str,
        is_dir: bool,
        parent_id: Optional[int] = None,
        content: Optional[str] = None
    ) -> Dict:
        """Create a new file or directory"""
        with self.conn.cursor() as cursor:
            # Check if parent exists and belongs to user
            if parent_id is not None:
                cursor.execute(
                    "SELECT id FROM fs_nodes WHERE id = %s AND user_id = %s AND is_dir",
                    (parent_id, user_id)
                )
                if not cursor.fetchone():
                    raise ValueError("Parent directory not found or not a directory")
            
            # Check for duplicate name
            if parent_id is None:
                cursor.execute(
                    "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id IS NULL AND name = %s",
                    (user_id, name)
                )
            else:
                cursor.execute(
                    "SELECT id FROM fs_nodes WHERE user_id = %s AND parent_id = %s AND name = %s",
                    (user_id, parent_id, name)
                )
            if cursor.fetchone():
                raise ValueError("A node with this name already exists in the specified location")
            
            # Create the node
            cursor.execute("""
                INSERT INTO fs_nodes (
                    user_id, parent_id, name, is_dir, content
                ) VALUES (
                    %s, %s, %s, %s, %s
                )
                RETURNING id, created_at, updated_at
            """, (user_id, parent_id, name, is_dir, content))
            
            node_id, created_at, updated_at = cursor.fetchone()
            
            return {
                'id': node_id,
                'parent_id': parent_id,
                'name': name,
                'is_dir': is_dir,
                'content': content,
                'created_at': created_at.isoformat(),
                'updated_at': updated_at.isoformat(),
                'children': []
            }
    
    def _build_tree(self, nodes: List[Dict]) -> List[Dict]:
        """Helper method to convert flat list of nodes into a tree structure"""
        node_map = {}
        root_nodes = []
        
        # First pass: create a map of all nodes
        for node in nodes:
            node_id = node['id']
            node_map[node_id] = node
        
        # Second pass: build the tree
        for node in nodes:
            parent_id = node['parent_id']
            if parent_id is None:
                root_nodes.append(node)
            else:
                parent = node_map.get(parent_id)
                if parent:
                    if 'children' not in parent:
                        parent['children'] = []
                    parent['children'].append(node)
        
        return root_nodes