"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Download, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface PdfFile {
  id: string;
  name: string;
  file_path: string;
  course_id: string;
  created_at: string;
}

interface CourseInfo {
  id: string;
  name: string;
}

interface MyMaterialProps {
  userId: string;
}

export function MyMaterial({ userId }: MyMaterialProps) {
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [courses, setCourses] = useState<Record<string, CourseInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchPdfs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch PDFs uploaded by this user
      const { data: pdfData, error: fetchError } = await supabase
        .from("course_pdfs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching PDFs:", fetchError);
        setError(`Error loading PDFs: ${fetchError.message || "Unknown error"}`);
        setPdfs([]);
        return;
      }

      if (pdfData && pdfData.length > 0) {
        setPdfs(pdfData);

        // Fetch course information for all unique course IDs
        const uniqueCourseIds = [...new Set(pdfData.map((pdf) => pdf.course_id))];
        const { data: courseData, error: courseError } = await supabase
          .from("course")
          .select("id, name")
          .in("id", uniqueCourseIds);

        if (!courseError && courseData) {
          const courseMap: Record<string, CourseInfo> = {};
          courseData.forEach((course) => {
            courseMap[course.id] = course;
          });
          setCourses(courseMap);
        }
      } else {
        setPdfs([]);
      }
    } catch (err) {
      console.error("Unexpected error fetching PDFs:", err);
      setError("Error loading PDFs");
      setPdfs([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (userId) {
      fetchPdfs();
    }
  }, [userId, fetchPdfs]);

  const handleDownload = async (pdf: PdfFile) => {
    try {
      const { data, error: downloadError } = await supabase.storage
        .from("course-pdfs")
        .download(pdf.file_path);

      if (downloadError) throw downloadError;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdf.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      setNotification({ message: "Error downloading file", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteClick = (pdfId: string) => {
    setShowDeleteConfirm(pdfId);
  };

  const handleConfirmDelete = async (pdfId: string, filePath: string) => {
    setShowDeleteConfirm(null);
    try {
      setDeletingId(pdfId);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("course-pdfs")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("course_pdfs")
        .delete()
        .eq("id", pdfId);

      if (dbError) throw dbError;

      // Remove from local state
      setPdfs(pdfs.filter((pdf) => pdf.id !== pdfId));
    } catch (err) {
      console.error("Delete error:", err);
      setNotification({ message: "Error deleting file", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="mb-2">You haven't uploaded any PDFs yet.</p>
        <p className="text-sm">Visit a course page to upload PDFs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pdfs.map((pdf) => {
        const course = courses[pdf.course_id];
        return (
          <div
            key={pdf.id}
            className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {pdf.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {course && (
                    <Link
                      href={`/protected/courses/${pdf.course_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {course.name}
                    </Link>
                  )}
                  <span className="text-xs text-zinc-400">•</span>
                  <p className="text-xs text-zinc-500">
                    {new Date(pdf.created_at).toLocaleDateString("en-US")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleDownload(pdf)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                aria-label="Download"
              >
                <Download className="h-4 w-4 text-zinc-600" />
              </button>
              <button
                onClick={() => handleDeleteClick(pdf.id)}
                disabled={deletingId === pdf.id}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Delete"
              >
                {deletingId === pdf.id ? (
                  <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-red-600" />
                )}
              </button>
            </div>
            {showDeleteConfirm === pdf.id && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 mb-2">Are you sure you want to delete this PDF?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmDelete(pdf.id, pdf.file_path)}
                    disabled={deletingId === pdf.id}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    disabled={deletingId === pdf.id}
                    className="px-3 py-1.5 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {notification && (
        <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300">
          {notification.message}
        </div>
      )}
    </div>
  );
}
