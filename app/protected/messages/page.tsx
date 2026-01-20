import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessagesClient } from "@/components/messages-client";
import { Suspense } from "react";

export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/error");
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
      </div>
      <Suspense fallback={<div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-sm">Loading...</div>}>
        <MessagesClient />
      </Suspense>
    </div>
  );
}
