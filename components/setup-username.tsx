"use client";

import { useState } from "react";
import { normalizeUsername, validateUsername, formatUsername } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function SetupUsername() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUsername(username);
    
    // Validate username format
    const validation = validateUsername(normalized);
    if (!validation.valid) {
      setError(validation.error || "Invalid username format");
      return;
    }

    setIsSubmitting(true);

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
        setError(data.error || "Failed to set username");
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to protected page
      router.push("/protected");
      router.refresh();
    } catch (err) {
      console.error("Error setting username:", err);
      setError("An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove @ if user types it
    const withoutAt = normalizeUsername(value);
    setUsername(withoutAt);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-blue-900 mb-2">
            Username
          </label>
          <div className="flex items-center">
            <span className="text-blue-600 font-medium mr-2">@</span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="username"
              className="flex-1 px-4 py-2 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-blue-900"
              autoFocus
              disabled={isSubmitting}
              pattern="[a-z0-9][a-z0-9_\-]*[a-z0-9]"
              title="Username must be 3-30 characters, alphanumeric with underscores or hyphens"
            />
          </div>
          <p className="text-xs text-blue-600 mt-1">
            3-30 characters, letters, numbers, underscores, or hyphens
          </p>
          {error && (
            <p className="text-red-600 text-sm mt-1" role="alert">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !username.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Setting up..." : "Continue"}
        </button>
      </form>

      {username && !error && validateUsername(normalizeUsername(username)).valid && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Your username will be: <span className="font-semibold">{formatUsername(normalizeUsername(username))}</span>
          </p>
        </div>
      )}
    </div>
  );
}
