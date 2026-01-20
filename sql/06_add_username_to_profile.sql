-- Add username column to profile table
-- This migration adds a unique username field to the profile table
-- Usernames are stored without @ prefix (will be displayed with @ in UI)
-- Run this AFTER the base tables migration (00_create_base_tables.sql)

-- Add username column (nullable initially to allow existing users)
ALTER TABLE profile 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index on username (nulls are allowed, but duplicates are not)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_username ON profile(username) 
WHERE username IS NOT NULL;

-- Add check constraint for username format
-- Username must be 3-30 characters, alphanumeric + underscore/hyphen, start and end with alphanumeric
ALTER TABLE profile
DROP CONSTRAINT IF EXISTS check_username_format;

ALTER TABLE profile
ADD CONSTRAINT check_username_format 
CHECK (
  username IS NULL OR (
    LENGTH(username) >= 3 AND
    LENGTH(username) <= 30 AND
    username ~ '^[a-z0-9][a-z0-9_\-]*$' AND
    username ~ '[a-z0-9]$'
  )
);

-- Create index for case-insensitive username searches (using LOWER)
CREATE INDEX IF NOT EXISTS idx_profile_username_lower ON profile(LOWER(username))
WHERE username IS NOT NULL;
