"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function handleInvite() {
      try {
        const { data: user, error: userError } = await supabase.auth.getUser();

        if (userError || !user?.user) {
          console.error("Auth error:", userError);
          throw new Error("No user found");
        }
        router.push("/");
      } catch (error: any) {
        console.error("Error processing invite:", error.message);
        router.push("/error");
      }
    }

    handleInvite();
  }, [router, supabase]);

  return <>Loading...</>;
}
