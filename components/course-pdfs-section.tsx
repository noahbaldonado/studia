"use client";

import { PdfUpload } from "./pdf-upload";
import { UploadPost } from "./upload-post";

interface CoursePdfsSectionProps {
  courseId: string;
}

export function CoursePdfsSection({ courseId }: CoursePdfsSectionProps) {
  const handleUploadSuccess = () => {
    // Upload successo, nessuna azione necessaria
  };

  return (
    <div className="mt-8">
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Upload Post</h3>
        <UploadPost courseId={courseId} onUploadSuccess={handleUploadSuccess} />
      </div>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Upload PDF</h3>
        <PdfUpload courseId={courseId} onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}
