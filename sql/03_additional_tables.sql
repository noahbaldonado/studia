-- Additional tables for comments, interactions, follows, and polls
-- Run this AFTER 01_base_tables.sql and 02_functions.sql

-- Comment table: Stores comments on quizzes/posts
CREATE TABLE IF NOT EXISTS comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comment(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment like/dislike table
CREATE TABLE IF NOT EXISTS comment_like (
  comment_id UUID NOT NULL REFERENCES comment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_like BOOLEAN NOT NULL, -- true for like, false for dislike
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- Indexes for comment tables
CREATE INDEX IF NOT EXISTS idx_comment_quiz_id ON comment(quiz_id);
CREATE INDEX IF NOT EXISTS idx_comment_parent_id ON comment(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_user_id ON comment(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_like_comment_id ON comment_like(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_like_user_id ON comment_like(user_id);

-- Enable RLS on comment tables
ALTER TABLE comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_like ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comment table
CREATE POLICY "Anyone can read comments" ON comment
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON comment
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comment
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comment_like table
CREATE POLICY "Anyone can read comment likes" ON comment_like
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON comment_like
  FOR ALL USING (auth.uid() = user_id);

-- Quiz interaction table: Tracks user interactions with quizzes/posts
-- Stores likes/dislikes and per-user interaction scores (0-10)
CREATE TABLE IF NOT EXISTS quiz_interaction (
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_like BOOLEAN, -- true for like, false for dislike, NULL for view-time-only interactions
  interaction_score INTEGER DEFAULT 0 CHECK (interaction_score >= 0 AND interaction_score <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quiz_id, user_id)
);

-- Add comment for interaction_score
COMMENT ON COLUMN quiz_interaction.interaction_score IS 'User-specific interaction score (0-10). Like/dislike/quiz/poll interaction = 10, flashcard flip = +4, view time = +1 per 10s (capped at 10 total)';

-- Indexes for quiz_interaction
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_user_id ON quiz_interaction(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_quiz_id ON quiz_interaction(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_score ON quiz_interaction(interaction_score DESC);

-- Enable RLS on quiz_interaction
ALTER TABLE quiz_interaction ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_interaction table
CREATE POLICY "Users can read own interactions" ON quiz_interaction
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interactions" ON quiz_interaction
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions" ON quiz_interaction
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions" ON quiz_interaction
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp for quiz_interaction
CREATE OR REPLACE FUNCTION update_quiz_interaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_interaction_updated_at
  BEFORE UPDATE ON quiz_interaction
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_interaction_updated_at();

-- Follow table: Tracks user relationships (who follows whom)
CREATE TABLE IF NOT EXISTS follow (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follow_no_self CHECK (follower_id != following_id)
);

-- Indexes for follow
CREATE INDEX IF NOT EXISTS idx_follow_follower_id ON follow(follower_id);
CREATE INDEX IF NOT EXISTS idx_follow_following_id ON follow(following_id);

-- Enable RLS on follow
ALTER TABLE follow ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follow table
CREATE POLICY "Anyone can read follow relationships" ON follow
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON follow
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON follow
  FOR DELETE USING (auth.uid() = follower_id);

-- Poll vote table: Tracks votes on poll content
CREATE TABLE IF NOT EXISTS poll_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, user_id) -- One vote per user per poll
);

-- Indexes for poll_vote
CREATE INDEX IF NOT EXISTS idx_poll_vote_quiz_id ON poll_vote(quiz_id);
CREATE INDEX IF NOT EXISTS idx_poll_vote_user_id ON poll_vote(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_vote_option_index ON poll_vote(option_index);

-- Enable RLS on poll_vote
ALTER TABLE poll_vote ENABLE ROW LEVEL SECURITY;

-- RLS Policies for poll_vote
CREATE POLICY "Anyone can read poll votes" ON poll_vote
  FOR SELECT USING (true);

CREATE POLICY "Users can create own poll votes" ON poll_vote
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own poll votes" ON poll_vote
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own poll votes" ON poll_vote
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update updated_at on poll vote changes
CREATE OR REPLACE FUNCTION update_poll_vote_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poll_vote_updated_at
  BEFORE UPDATE ON poll_vote
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_vote_updated_at();
