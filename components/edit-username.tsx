"use client";

import { useState, useEffect } from "react";
import { formatUsername, normalizeUsername, validateUsername } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

interface EditUsernameProps {
  currentUsername: string | null;
  onUpdate: (newUsername: string) => void;
}

export function EditUsername({ currentUsername, onUpdate }: EditUsernameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setUsername(currentUsername || "");
      setError(null);
    }
  }, [isEditing, currentUsername]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setUsername(currentUsername || "");
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setUsername("");
    setError(null);
  };

  const handleSave = async () => {
    const normalized = normalizeUsername(username.trim().toLowerCase());
    
    // Validate format
    const validation = validateUsername(normalized);
    if (!validation.valid) {
      setError(validation.error || "Invalid username format");
      return;
    }

    // Check if unchanged
    if (normalized === (currentUsername || "").toLowerCase()) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users/update-username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: normalized }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update username");
        setIsSaving(false);
        return;
      }

      // Success
      onUpdate(data.username);
      setIsEditing(false);
      setError(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "Failed to update username");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-blue-900 font-medium">
          {currentUsername ? formatUsername(currentUsername) : "No username set"}
        </span>
        <button
          onClick={handleStartEdit}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-medium">
            @
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="username"
            className="w-full pl-8 pr-10 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSaving}
            autoFocus
          />
          {isSaving && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !username.trim()}
          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Save"
        >
          <Check className="h-5 w-5" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <p className="text-xs text-blue-600">
        3-30 characters, letters, numbers, underscores, and hyphens only
      </p>
    </div>
  );
}
