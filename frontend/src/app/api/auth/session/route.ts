import { NextResponse } from "next/server";
import { auth } from "@/utils/server-auth";

// This runs on the server only
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Return minimal user data to avoid exposing sensitive information
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        // Add other non-sensitive user data you need
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
