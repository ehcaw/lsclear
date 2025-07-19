import { NextResponse } from "next/server";
import { Pool } from "pg";

// Create a connection pool to the Neon database
const pool = new Pool({
  connectionString: process.env.PGCONNECTIONSTRING,
  ssl: {
    rejectUnauthorized: false, // Required for Neon, but consider enabling this in production
  },
});

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Query the file_structures table
    const query = `
      SELECT structure FROM file_structures
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    const data = result.rows;

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
    const body = await request.json();

    // Validate required fields
    const { user_id, name, structure } = body;

    if (!user_id || !name || !structure) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: user_id, name, and structure are required",
        },
        { status: 400 },
      );
    }

    // Insert new file structure
    const query = `
      INSERT INTO file_structures (user_id, name, structure, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const now = new Date().toISOString();
    const result = await pool.query(query, [user_id, name, structure, now]);
    const data = result.rows[0];

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
