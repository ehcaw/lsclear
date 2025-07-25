import { NextResponse } from "next/server";
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.PGCONNECTIONSTRING!);

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const data = await sql`
      SELECT * 
      FROM fs_nodes
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Update the POST route
export async function POST(request: Request) {
  try {
    const { user_id, name, content, is_dir = false, parent_id = null } = await request.json();

    if (!user_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: user_id and name are required" },
        { status: 400 },
      );
    }

    const data = await sql`
      INSERT INTO fs_nodes 
        (user_id, name, content, is_dir, parent_id, created_at, updated_at)
      VALUES 
        (${user_id}, ${name}, ${content || null}, ${is_dir}, ${parent_id}, NOW(), NOW())
      RETURNING *
    `;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/files/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;
    const body = await request.json();
    const { content, userId } = body;

    if (!content || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get the file details including its path using a simpler query
    const [file] = await sql`
      WITH RECURSIVE file_tree AS (
        -- Start with the target file
        SELECT 
          id, 
          parent_id, 
          name, 
          is_dir, 
          name as full_path
        FROM fs_nodes 
        WHERE id = ${id} AND user_id = ${userId}
        
        UNION ALL
        
        -- Recursively get all parents
        SELECT 
          p.id, 
          p.parent_id, 
          p.name, 
          p.is_dir,
          p.name || '/' || ft.full_path as full_path
        FROM fs_nodes p
        JOIN file_tree ft ON p.id = ft.parent_id
        WHERE p.user_id = ${userId}
      )
      SELECT 
        id, 
        name, 
        is_dir, 
        full_path as path
      FROM file_tree
      WHERE parent_id IS NULL;
    `;

    if (!file) {
      return NextResponse.json(
        { error: "File not found or access denied" },
        { status: 404 },
      );
    }

    // Forward the request to the backend API
    const response = await fetch(`${process.env.NEXT_PUBLIC_REACT_APP_API_URL}/api/files/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        userId,
        filePath: file.path
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Backend error:", error);
      return NextResponse.json(
        { error: "Failed to update file in container" },
        { status: response.status },
      );
    }

    // Update the database
    await sql`
      UPDATE fs_nodes
      SET 
        content = ${content}, 
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating file:", error);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 },
    );
  }
}