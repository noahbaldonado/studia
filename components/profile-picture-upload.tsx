"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

interface ProfilePictureUploadProps {
  currentPictureUrl: string | null;
  userId: string;
  onUpdate?: () => void;
}

export function ProfilePictureUpload({
  currentPictureUrl,
  userId,
  onUpdate,
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 5MB.");
      return;
    }

    setError(null);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/upload-picture", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload picture");
      }

      // Clear preview and reset input
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Reload page or call onUpdate callback
      if (onUpdate) {
        onUpdate();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error uploading picture:", err);
      setError(err instanceof Error ? err.message : "Failed to upload picture");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentPictureUrl) return;

    setIsUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Extract the path from the URL
      const path = currentPictureUrl.split("/").slice(-2).join("/");
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from("profile-pictures")
        .remove([path]);

      if (deleteError) {
        console.error("Error deleting file:", deleteError);
      }

      // Update profile to remove picture URL
      const { error: updateError } = await supabase
        .from("profile")
        .update({ profile_picture_url: null })
        .eq("id", user.id);

      if (updateError) {
        throw new Error("Failed to remove picture");
      }

      // Reload page or call onUpdate callback
      if (onUpdate) {
        onUpdate();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error removing picture:", err);
      setError(err instanceof Error ? err.message : "Failed to remove picture");
    } finally {
      setIsUploading(false);
    }
  };

  const displayUrl = previewUrl || currentPictureUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {displayUrl ? (
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[hsl(var(--border))]">
            <Image
              src={displayUrl}
              alt="Profile picture"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-[hsl(var(--muted))] border-2 border-[hsl(var(--border))] flex items-center justify-center">
            <Camera className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        
        {previewUrl && !currentPictureUrl && (
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
            <button
              onClick={() => {
                setPreviewUrl(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}

        {!previewUrl && (
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentPictureUrl ? "Change" : "Upload"}
            </button>
            {currentPictureUrl && (
              <button
                onClick={handleRemove}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-[hsl(var(--destructive))] text-center max-w-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
