-- Base tables migration
-- This file creates all the core tables required by the application
-- Run this BEFORE the other migration files (01-05)

-- Profile table: Stores user profile information
CREATE TABLE IF NOT EXISTS profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating REAL DEFAULT 7.5,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profile
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile
-- Anyone can read profiles
CREATE POLICY "Anyone can read profiles" ON profile
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profile
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profile
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Indexes for profile
CREATE INDEX IF NOT EXISTS idx_profile_rating ON profile(rating);

-- Course table: Stores course information
CREATE TABLE IF NOT EXISTS course (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  course_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on course
ALTER TABLE course ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course
-- Anyone can read courses
CREATE POLICY "Anyone can read courses" ON course
  FOR SELECT USING (true);

-- Indexes for course
CREATE INDEX IF NOT EXISTS idx_course_name ON course(name);
CREATE INDEX IF NOT EXISTS idx_course_subject ON course(subject);

-- Course subscription table: Tracks which users are subscribed to which courses
CREATE TABLE IF NOT EXISTS course_subscription (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

-- Enable RLS on course_subscription
ALTER TABLE course_subscription ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_subscription
-- Users can read all subscriptions
CREATE POLICY "Anyone can read subscriptions" ON course_subscription
  FOR SELECT USING (true);

-- Users can create their own subscriptions
CREATE POLICY "Users can create own subscriptions" ON course_subscription
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions" ON course_subscription
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for course_subscription
CREATE INDEX IF NOT EXISTS idx_course_subscription_user_id ON course_subscription(user_id);
CREATE INDEX IF NOT EXISTS idx_course_subscription_course_id ON course_subscription(course_id);

-- Course PDFs table: Stores metadata for uploaded PDF files
CREATE TABLE IF NOT EXISTS course_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on course_pdfs
ALTER TABLE course_pdfs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_pdfs
-- Anyone can read PDFs
CREATE POLICY "Anyone can read course PDFs" ON course_pdfs
  FOR SELECT USING (true);

-- Users can upload their own PDFs
CREATE POLICY "Users can upload PDFs" ON course_pdfs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own PDFs
CREATE POLICY "Users can delete own PDFs" ON course_pdfs
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for course_pdfs
CREATE INDEX IF NOT EXISTS idx_course_pdfs_course_id ON course_pdfs(course_id);
CREATE INDEX IF NOT EXISTS idx_course_pdfs_user_id ON course_pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_course_pdfs_created_at ON course_pdfs(created_at DESC);

-- Quiz table: Stores quiz, flashcard, sticky note, and other post types
CREATE TABLE IF NOT EXISTS quiz (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  rating REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on quiz
ALTER TABLE quiz ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz
-- Anyone can read quizzes
CREATE POLICY "Anyone can read quizzes" ON quiz
  FOR SELECT USING (true);

-- Users can create their own quizzes
CREATE POLICY "Users can create quizzes" ON quiz
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own quizzes
CREATE POLICY "Users can update own quizzes" ON quiz
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own quizzes
CREATE POLICY "Users can delete own quizzes" ON quiz
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for quiz
CREATE INDEX IF NOT EXISTS idx_quiz_course_id ON quiz(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_user_id ON quiz(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_rating ON quiz(rating DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_created_at ON quiz(created_at DESC);

-- Tag table: Stores tags with scores for recommendation algorithm
CREATE TABLE IF NOT EXISTS tag (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  score DOUBLE PRECISION DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tag
ALTER TABLE tag ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tag
-- Anyone can read tags
CREATE POLICY "Anyone can read tags" ON tag
  FOR SELECT USING (true);

-- Authenticated users can insert tags (needed for quiz creation)
CREATE POLICY "Authenticated users can create tags" ON tag
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update tags (for score updates via functions)
CREATE POLICY "Authenticated users can update tags" ON tag
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Indexes for tag
CREATE INDEX IF NOT EXISTS idx_tag_name ON tag(name);
CREATE INDEX IF NOT EXISTS idx_tag_score ON tag(score DESC);

-- Quiz tag junction table: Links quizzes to tags
CREATE TABLE IF NOT EXISTS quiz_tag (
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quiz_id, tag_id)
);

-- Enable RLS on quiz_tag
ALTER TABLE quiz_tag ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_tag
-- Anyone can read quiz tags
CREATE POLICY "Anyone can read quiz tags" ON quiz_tag
  FOR SELECT USING (true);

-- Authenticated users can create quiz tags
CREATE POLICY "Authenticated users can create quiz tags" ON quiz_tag
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can delete quiz tags
CREATE POLICY "Authenticated users can delete quiz tags" ON quiz_tag
  FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes for quiz_tag
CREATE INDEX IF NOT EXISTS idx_quiz_tag_quiz_id ON quiz_tag(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_tag_tag_id ON quiz_tag(tag_id);

-- Trigger to update updated_at timestamp for profile
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_updated_at
  BEFORE UPDATE ON profile
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

-- Trigger to update updated_at timestamp for course
CREATE OR REPLACE FUNCTION update_course_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER course_updated_at
  BEFORE UPDATE ON course
  FOR EACH ROW
  EXECUTE FUNCTION update_course_updated_at();

-- Trigger to update updated_at timestamp for quiz
CREATE OR REPLACE FUNCTION update_quiz_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_updated_at
  BEFORE UPDATE ON quiz
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_updated_at();
