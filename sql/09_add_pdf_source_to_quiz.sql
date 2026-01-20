-- Add pdf_id column to quiz table to track PDF source
-- This allows us to distinguish between manually created quizzes and PDF-generated quizzes
-- Run this migration to enable showing "Created from @username's notes" for PDF-generated quizzes

-- Add pdf_id column (nullable, foreign key to course_pdfs)
ALTER TABLE quiz 
ADD COLUMN IF NOT EXISTS pdf_id UUID REFERENCES course_pdfs(id) ON DELETE SET NULL;

-- Create index for querying PDF-generated quizzes
CREATE INDEX IF NOT EXISTS idx_quiz_pdf_id ON quiz(pdf_id) 
WHERE pdf_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN quiz.pdf_id IS 'References course_pdfs if this quiz was generated from a PDF, NULL if manually created';
