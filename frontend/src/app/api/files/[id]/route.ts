import { NextResponse } from "next/server";
import { Pool } from "pg";

// Create a connection pool to the Neon database - this runs server-side only
const pool = new Pool({
  connectionString: process.env.PGCONNECTIONSTRING,
  ssl: {
    rejectUnauthorized: false,
  },
});

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

    await pool.query(
      `UPDATE files
       SET content = $1, updated_at = $2
       WHERE id = $3 AND user_id = $4`,
      [content, new Date().toISOString(), id, userId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating file:", error);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 },
    );
  }
}

// DELETE /api/files/[id]?userId=123
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    await pool.query(`DELETE FROM files WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
