"use client";

import { useParams, useRouter } from "next/navigation";
import { UploadPost } from "@/components/upload-post";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function UploadPostPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSubscription() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/protected");
        return;
      }

      const { data, error } = await supabase
        .from("course_subscription")
        .select("course_id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error checking subscription:", error);
        setIsSubscribed(false);
      } else {
        setIsSubscribed(!!data);
      }
      setLoading(false);
    }

    checkSubscription();
  }, [courseId, router]);

  if (loading) {
    return (
      <div className="px-4 py-6 pb-24">
        <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">Loading...</div>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="px-4 py-6 pb-24">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="text-center py-12">
          <p className="text-foreground mb-4">You must be subscribed to this course to upload posts.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--background))] hover:opacity-90 transition-opacity"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-24">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] hover:text-foreground mb-6"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>Back</span>
      </button>
      
      <UploadPost 
        courseId={courseId} 
        onUploadSuccess={() => {
          router.back();
        }} 
      />
    </div>
  );
}
