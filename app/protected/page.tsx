import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return redirect("/");
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">Feed</h1>
    </div>
  );
}