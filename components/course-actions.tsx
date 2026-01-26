"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Plus, Upload } from "lucide-react";

interface CourseActionsProps {
  courseId: string;
  courseLink?: string | null;
}

export function CourseActions({ courseId, courseLink }: CourseActionsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handlePdfClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className="flex items-center justify-around px-2 py-4 mb-6">
        {/* Course Link Icon */}
        {courseLink ? (
          <a
            href={courseLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 flex-1"
          >
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
              <LinkIcon className="w-7 h-7 text-blue-600" />
            </div>
            <span className="text-xs text-blue-600 font-medium">Link</span>
          </a>
        ) : (
          <div className="flex flex-col items-center gap-2 flex-1 opacity-50">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <LinkIcon className="w-7 h-7 text-blue-600" />
            </div>
            <span className="text-xs text-blue-600 font-medium">Link</span>
          </div>
        )}

        {/* Add Post Icon */}
        <button
          onClick={() => router.push(`/protected/courses/${courseId}/upload-post`)}
          className="flex flex-col items-center gap-2 flex-1"
        >
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
            <Plus className="w-7 h-7 text-blue-600" />
          </div>
          <span className="text-xs text-blue-600 font-medium">Post</span>
        </button>

        {/* Upload PDF Icon */}
        <button
          onClick={handlePdfClick}
          className="flex flex-col items-center gap-2 flex-1"
        >
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
            <Upload className="w-7 h-7 text-blue-600" />
          </div>
          <span className="text-xs text-blue-600 font-medium">PDF</span>
        </button>
      </div>

      {/* Upload Status Area */}
      {uploadStatus !== 'idle' && (
        <div className="mt-4 mb-2">
          <div
            className={`w-full rounded-lg px-4 py-3 flex items-center justify-center text-sm font-medium transition-colors ${
              uploadStatus === 'uploading'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : uploadStatus === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {uploadStatus === 'uploading'
              ? 'Generating content...'
              : uploadStatus === 'success'
              ? 'Content generated successfully!'
              : 'Error occurred'}
          </div>
        </div>
      )}

      {/* Hidden PDF Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setUploadStatus('uploading');

            // Use XMLHttpRequest for upload
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append("file", file);
            formData.append("courseId", courseId);

            // Handle completion
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploadStatus('success');
                // Clear file input
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
                // Reset to idle after 3 seconds
                setTimeout(() => {
                  setUploadStatus('idle');
                }, 3000);
              } else {
                setUploadStatus('error');
                // Reset to idle after 3 seconds
                setTimeout(() => {
                  setUploadStatus('idle');
                }, 3000);
              }
            });

            // Handle errors
            xhr.addEventListener("error", () => {
              setUploadStatus('error');
              // Reset to idle after 3 seconds
              setTimeout(() => {
                setUploadStatus('idle');
              }, 3000);
            });

            // Handle abort
            xhr.addEventListener("abort", () => {
              setUploadStatus('idle');
            });

            // Start upload
            xhr.open("POST", "/api/courses/upload-pdf");
            xhr.send(formData);
          }
        }}
      />
    </>
  );
}
