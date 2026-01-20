import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SetupUsername } from "@/components/setup-username";

export default async function SetupUsernamePage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return redirect("/");
  }

  // Check if user already has a username
  const { data: profile } = await supabase
    .from("profile")
    .select("username")
    .eq("id", user.id)
    .single();

  // If user already has username, redirect to protected page
  if (profile?.username) {
    return redirect("/protected");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[hsl(var(--background))]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Studia!</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Choose a username to get started</p>
        </div>
        <SetupUsername />
      </div>
    </div>
  );
}
