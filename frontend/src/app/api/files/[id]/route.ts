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
      SELECT structure 
      FROM file_structures
      WHERE user_id = ${userId}
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

export async function POST(request: Request) {
  try {
    const { user_id, name, structure } = await request.json();

    if (!user_id || !name || !structure) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, name, and structure are required" },
        { status: 400 },
      );
    }

    const data = await sql`
      INSERT INTO file_structures (user_id, name, structure, created_at)
      VALUES (${user_id}, ${name}, ${structure}, ${new Date().toISOString()})
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