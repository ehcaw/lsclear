import { Pool } from 'pg';

// Create a PostgreSQL connection pool
const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.POSTGRES_DB,
    port: Number(process.env.PGPORT || 5432),
  })

export interface FileNode {
  id: number;
  parent_id: number | null;
  name: string;
  is_dir: boolean;
  content: string | null;
  created_at: string;
  updated_at: string;
  children?: FileNode[];
}

// Helper function to build a tree from a flat list of nodes
function buildTree(nodes: FileNode[], parentId: number | null = null): FileNode[] {
  return nodes
    .filter(node => node.parent_id === parentId)
    .map(node => ({
      ...node,
      children: buildTree(nodes, node.id)
    }));
}

export async function getFileTreeForUser(userId: string): Promise<FileNode[]> {
  const client = await pool.connect();
  
  try {
    // First, get all nodes for the user
    const query = `
      WITH RECURSIVE file_tree AS (
        SELECT id, parent_id, name, is_dir, content, created_at, updated_at
        FROM fs_nodes 
        WHERE user_id = $1
        
        UNION ALL
        
        SELECT f.id, f.parent_id, f.name, f.is_dir, f.content, f.created_at, f.updated_at
        FROM fs_nodes f
        INNER JOIN file_tree ft ON f.parent_id = ft.id
        WHERE f.user_id = $1
      )
      SELECT id, parent_id, name, is_dir, content, 
             created_at, updated_at
      FROM file_tree
      ORDER BY is_dir DESC, name;
    `;

    const result = await client.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return [];
    }
    
    // Build the tree structure
    return buildTree(result.rows);
    
  } catch (error) {
    console.error('Error fetching file tree:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
