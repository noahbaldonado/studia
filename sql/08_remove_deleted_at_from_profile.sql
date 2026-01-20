-- Remove deleted_at column from profile table
-- This migration removes the soft delete functionality in favor of hard delete
-- Run this AFTER migrating to hard delete in the codebase

-- Drop index on deleted_at
DROP INDEX IF EXISTS idx_profile_deleted_at;

-- Remove deleted_at column
ALTER TABLE profile 
DROP COLUMN IF EXISTS deleted_at;
