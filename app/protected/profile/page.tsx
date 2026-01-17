import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export default async function UserProfilePage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return redirect("/");
  }
  const displayName = user.user_metadata?.full_name;

  return (
    <main className="flex min-h-screen flex-col bg-white p-10 text-black">
      <header className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-medium">{displayName}</h1>
        <LogoutButton />
      </header>

      <section className="mt-10">
        <p className="mt-1 font-mono">{user.email}</p>
      </section>
    </main>
  );
}
