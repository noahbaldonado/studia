-- Add deleted_at column to profile table for soft deletes
-- This migration adds support for user account deletion while preserving data

-- Add deleted_at column (nullable, will be set when user is deleted)
ALTER TABLE profile 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for filtering out deleted users
CREATE INDEX IF NOT EXISTS idx_profile_deleted_at ON profile(deleted_at) 
WHERE deleted_at IS NULL;

-- Update RLS policy to exclude deleted users from reads
-- Note: We keep the existing policy but queries should filter WHERE deleted_at IS NULL
