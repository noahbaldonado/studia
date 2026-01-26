-- Remove PDF storage and replace with generated_from_pdf flag
-- Run this AFTER 01_base_tables.sql

-- Remove pdf_id column from quiz table
ALTER TABLE quiz DROP COLUMN IF EXISTS pdf_id;

-- Drop the index on pdf_id if it exists
DROP INDEX IF EXISTS idx_quiz_pdf_id;

-- Add generated_from_pdf boolean column to quiz table
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS generated_from_pdf BOOLEAN DEFAULT FALSE;

-- Add index for generated_from_pdf
CREATE INDEX IF NOT EXISTS idx_quiz_generated_from_pdf ON quiz(generated_from_pdf);

-- Drop course_pdfs table (this will fail if there are foreign key references, 
-- but since we dropped pdf_id, there shouldn't be any)
DROP TABLE IF EXISTS course_pdfs CASCADE;
