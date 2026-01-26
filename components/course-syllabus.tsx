"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileText, Loader2 } from "lucide-react";

interface CourseSyllabusProps {
  courseId: string;
  userId: string;
}

export function CourseSyllabus({ courseId, userId }: CourseSyllabusProps) {
  const [currentSyllabusUrl, setCurrentSyllabusUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Check if user is subscribed
  useEffect(() => {
    async function checkSubscription() {
      const { data, error } = await supabase
        .from("course_subscription")
        .select("user_id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error checking subscription:", error);
      } else {
        setIsSubscribed(!!data);
      }
    }
    checkSubscription();
  }, [courseId, userId, supabase]);

  // Load syllabus data
  const loadSyllabusData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/syllabus-replacement`);
      if (response.ok) {
        const data = await response.json();
        setCurrentSyllabusUrl(data.currentSyllabusUrl);
      }
    } catch (error) {
      console.error("[CourseSyllabus] Error loading syllabus:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyllabusData();
  }, [courseId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/courses/${courseId}/upload-syllabus`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload syllabus");
      }

      // Reload syllabus data to ensure we have the latest
      await loadSyllabusData();

      // Trigger feed refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('refreshFeed'));

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload syllabus");
    } finally {
      setIsUploading(false);
    }
  };


  if (loading) {
    return (
      <div className="text-center py-4 text-[hsl(var(--muted-foreground))] text-sm">
        Loading syllabus...
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-foreground mb-4">Syllabus</h2>

      {/* Current Syllabus */}
      {currentSyllabusUrl ? (
        <div className="mb-6 p-4 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-5 w-5 text-[hsl(var(--primary))]" />
            <span className="font-medium text-foreground">Current Syllabus</span>
          </div>
          <a
            href={currentSyllabusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[hsl(var(--primary))] hover:underline"
          >
            View Syllabus
          </a>
        </div>
      ) : (
        <div className="mb-6 p-4 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No syllabus available yet
          </p>
        </div>
      )}

      {/* Upload Syllabus Button */}
      {isSubscribed && (
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--secondary))] transition-colors text-sm font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>{currentSyllabusUrl ? "Replace Syllabus" : "Upload Syllabus"}</span>
              </>
            )}
          </button>
          {uploadError && (
            <p className="mt-2 text-sm text-[hsl(var(--destructive))]">{uploadError}</p>
          )}
        </div>
      )}

    </div>
  );
}
