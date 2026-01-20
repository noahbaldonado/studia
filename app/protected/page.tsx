import { requireUsername } from "@/lib/auth-utils";
import { FeedHeader } from "@/components/feed-header";
import { FeedPageClient } from "@/components/feed-page-client";

export default async function ProtectedPage() {
  await requireUsername();

  return (
    <div className="min-h-screen pb-20">
      <FeedHeader />
      <FeedPageClient />
    </div>
  );
}