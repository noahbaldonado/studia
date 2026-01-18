"use client";

import { useParams, useRouter } from "next/navigation";
import { UploadPost } from "@/components/upload-post";
import { ChevronLeft } from "lucide-react";

export default function UploadPostPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  return (
    <div className="px-4 py-6 pb-24">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
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
