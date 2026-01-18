import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PuzzleRush } from "@/components/puzzle-rush";
import { PuzzleRushHeader } from "@/components/puzzle-rush-header";

export default async function PuzzleRushPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return redirect("/");
  }

  return (
    <div className="min-h-screen pb-20">
      <PuzzleRushHeader />
      <PuzzleRush />
    </div>
  );
}
