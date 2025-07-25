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


export async function getFileTreeForUser(userId: string): Promise<FileNode[]> {
  const client = await pool.connect();
  
  try {
    // Get all nodes for the user in a single query
    const result = await client.query(`
      SELECT 
        id, 
        parent_id, 
        name, 
        is_dir, 
        content, 
        created_at, 
        updated_at
      FROM fs_nodes 
      WHERE user_id = $1
      ORDER BY is_dir DESC, name
    `, [userId]);

    console.log('Raw nodes from DB:', result.rows);
    
    if (result.rows.length === 0) {
      return [];
    }

    // Build a map of all nodes by id
    const nodesById = new Map<string, FileNode>();
    const rootNodes: FileNode[] = [];

    // First pass: create all nodes
    for (const row of result.rows) {
      const node: FileNode = {
        id: row.id,
        name: row.name,
        parent_id: row.parent_id,
        is_dir: row.is_dir,
        content: row.content,
        created_at: row.created_at,
        updated_at: row.updated_at,
        children: []
      };
      nodesById.set(row.id, node);
    }

    // Second pass: build the tree
    for (const row of result.rows) {
      const node = nodesById.get(row.id)!;
      
      if (row.parent_id && nodesById.has(row.parent_id)) {
        // Add as child to parent
        const parent = nodesById.get(row.parent_id)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else if (row.parent_id === null) {
        // Add to root nodes
        rootNodes.push(node);
      }
    }

    console.log('Built tree:', JSON.stringify(rootNodes, null, 2));
    return rootNodes;
    
  } catch (error) {
    console.error('Error fetching file tree:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
