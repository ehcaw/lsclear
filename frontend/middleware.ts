import { getCookieCache } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
 
export async function middleware(request: NextRequest) {
	const session = await getCookieCache(request);
	if (!session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}