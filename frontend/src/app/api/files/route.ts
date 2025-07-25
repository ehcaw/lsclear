import { NextResponse } from "next/server";
import { Pool } from "pg";

// Create a connection pool to the Neon database - this runs server-side only
const pool = new Pool({
  connectionString: process.env.PGCONNECTIONSTRING,
  ssl: {
    rejectUnauthorized: false,
  },
});

// GET /api/files?userId=123
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `SELECT * FROM fs_nodes WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    return NextResponse.json({ files: result.rows });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 },
    );
  }
}

// POST /api/files
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, language, content, userId } = body;

    if (!name || !language || !content || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `INSERT INTO fs_nodes (name, language, content, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [name, language, content, userId, new Date().toISOString()],
    );

    return NextResponse.json({ file: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating file:", error);
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 },
    );
  }
}
