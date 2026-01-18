import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CardFeed } from "@/components/card-feed";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return redirect("/");
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10 px-4 py-4 border-b">
        <h1 className="text-2xl font-bold">Feed</h1>
      </div>
      <CardFeed />
    </div>
  );
}