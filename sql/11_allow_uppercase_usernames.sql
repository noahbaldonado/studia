-- Migration to allow uppercase letters in usernames
-- Usernames will still be case-insensitive for uniqueness (via LOWER index)

-- Drop existing constraint
ALTER TABLE profile
DROP CONSTRAINT IF EXISTS check_username_format;

-- Update constraint to allow uppercase letters (A-Z)
ALTER TABLE profile
ADD CONSTRAINT check_username_format 
CHECK (
  username IS NULL OR (
    LENGTH(username) >= 3 AND
    LENGTH(username) <= 30 AND
    username ~ '^[a-zA-Z0-9][a-zA-Z0-9_\-]*$' AND
    username ~ '[a-zA-Z0-9]$'
  )
);

-- Note: The unique index on LOWER(username) ensures case-insensitive uniqueness
-- So "JohnDoe" and "johndoe" cannot both exist, but "JohnDoe" is allowed
