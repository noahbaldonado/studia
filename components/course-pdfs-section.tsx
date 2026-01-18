"use client";

import { PdfUpload } from "./pdf-upload";
import { useRouter } from "next/navigation";

interface CoursePdfsSectionProps {
  courseId: string;
}

export function CoursePdfsSection({ courseId }: CoursePdfsSectionProps) {
  const router = useRouter();
  const handleUploadSuccess = () => {
    // Upload successo, nessuna azione necessaria
  };

  return (
    <div className="mt-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/protected/courses/${courseId}/upload-post`)}
          className="text-lg font-semibold text-blue-900 hover:text-blue-700 transition-colors w-full text-left"
        >
          Upload Post
        </button>
      </div>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Upload PDF</h3>
        <PdfUpload courseId={courseId} onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}
