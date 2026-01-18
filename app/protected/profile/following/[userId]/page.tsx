import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { FollowList } from "@/components/follow-list";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const supabase = await createClient();
  const { userId } = await params;

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return redirect("/");
  }

  // Get profile data to get user name
  const { data: profile } = await supabase
    .from("profile")
    .select("metadata")
    .eq("id", userId)
    .single();

  const metadata = profile?.metadata as any;
  const displayName = metadata?.name || `User ${userId.substring(0, 8)}`;

  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={userId === user.id ? "/protected/profile" : `/protected/profile/${userId}`}
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Following - {displayName}</h1>
      </div>

      <FollowList userId={userId} type="following" />
    </div>
  );
}
