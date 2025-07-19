// This is a lightweight client-side auth utility that doesn't use pg directly
import { createAuthClient } from "better-auth/react";
export const { useSession } = createAuthClient();

// Utility function for client components to get the current user
export async function getCurrentUser() {
  try {
    const response = await fetch("/api/auth/session");
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.authenticated ? data.user : null;
  } catch (error) {
    console.error("Error fetching user session:", error);
    return null;
  }
}
