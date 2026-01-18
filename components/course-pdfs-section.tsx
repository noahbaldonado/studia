"use client";

import { PdfUpload } from "./pdf-upload";

interface CoursePdfsSectionProps {
  courseId: string;
}

export function CoursePdfsSection({ courseId }: CoursePdfsSectionProps) {
  const handleUploadSuccess = () => {
    // Upload successo, nessuna azione necessaria
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Course PDFs</h2>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Upload PDF</h3>
        <PdfUpload courseId={courseId} onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}
