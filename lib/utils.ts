import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Formats a username for display by adding @ prefix
 */
export function formatUsername(username: string | null | undefined): string {
  if (!username) return "";
  return username.startsWith("@") ? username : `@${username}`;
}


/**
 * Removes @ prefix from username if present
 */
export function normalizeUsername(username: string): string {
  return username.startsWith("@") ? username.slice(1) : username;
}

/**
 * Validates username format
 * - 3-30 characters
 * - Only alphanumeric, underscore, hyphen
 * - Must start and end with alphanumeric
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > 30) {
    return { valid: false, error: "Username must be 30 characters or less" };
  }
  // Remove @ prefix if present for validation
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9][a-z0-9_\-]*[a-z0-9]$/i.test(normalized)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, underscores, and hyphens. Must start and end with a letter or number.",
    };
  }
  return { valid: true };
}

/**
 * Generates a base username from name or email
 */
function generateBaseUsername(name?: string | null, email?: string | null): string {
  let base = "";
  
  if (name && name.trim().length > 0) {
    // Use name: lowercase, replace spaces with underscores, remove special chars
    base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_\-]/g, "")
      .replace(/\s+/g, "_");
    // Ensure starts with alphanumeric
    base = base.replace(/^[^a-z0-9]+/, "");
    // Limit length
    if (base.length > 27) {
      base = base.substring(0, 27);
    }
  } else if (email) {
    // Use email prefix
    base = email
      .toLowerCase()
      .split("@")[0]
      .replace(/[^a-z0-9_\-]/g, "");
    // Ensure starts with alphanumeric
    base = base.replace(/^[^a-z0-9]+/, "");
  }
  
  // Ensure minimum length
  if (base.length < 3) {
    base = "user";
  }
  
  return base;
}

/**
 * Generates a unique username from name or email
 * Note: This function doesn't check database - you need to verify uniqueness in your code
 */
export function generateUsername(
  name?: string | null,
  email?: string | null,
  counter: number = 0
): string {
  const base = generateBaseUsername(name, email);
  
  if (counter === 0) {
    return base;
  }
  
  // Append counter, truncate base to fit
  const maxCounterLength = counter.toString().length;
  const baseLength = Math.max(3, 30 - maxCounterLength);
  return base.substring(0, baseLength) + counter;
}
