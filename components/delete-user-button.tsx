"use client";

import { useState } from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function DeleteUserButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/users/delete", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete account");
        setIsDeleting(false);
        return;
      }

      // Sign out the user after successful deletion
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // Redirect to home page with hard refresh to clear all state
      window.location.href = "/";
    } catch (err) {
      console.error("Error deleting account:", err);
      setError("An unexpected error occurred");
      setIsDeleting(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="mt-4 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
      >
        <Trash2 className="inline h-4 w-4 mr-2" />
        Delete Account
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">Delete Account</h3>
          <p className="text-sm text-red-700">
            Are you sure you want to delete your account? This action cannot be undone.
            All your data including posts, comments, and following relationships will be
            permanently deleted. You can create a new account with the same Google account later.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-100 border border-red-300 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
        >
          {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
        </Button>
        <Button
          onClick={() => {
            setShowConfirm(false);
            setError(null);
          }}
          disabled={isDeleting}
          variant="outline"
          className="flex-1 border-red-300 text-red-700 hover:bg-red-100"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
