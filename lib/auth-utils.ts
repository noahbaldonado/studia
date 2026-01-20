import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Checks if the user has a username. Redirects to setup page if not.
 * Use this in protected pages that require a username.
 */
export async function requireUsername(): Promise<string> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profile")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) {
    redirect("/protected/setup-username");
  }

  return user.id;
}
