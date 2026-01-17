"use client";

import { useState } from "react";
import { PdfUpload } from "./pdf-upload";
import { PdfList } from "./pdf-list";

interface CoursePdfsSectionProps {
  courseId: string;
}

export function CoursePdfsSection({ courseId }: CoursePdfsSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Course PDFs</h2>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Upload PDF</h3>
        <PdfUpload courseId={courseId} onUploadSuccess={handleUploadSuccess} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Uploaded PDFs</h3>
        <PdfList key={refreshKey} courseId={courseId} />
      </div>
    </div>
  );
}
