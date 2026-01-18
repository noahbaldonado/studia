-- Create comment and comment_like tables for quiz commenting system

-- Comment table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comment_quiz_id ON comment(quiz_id);
CREATE INDEX IF NOT EXISTS idx_comment_parent_id ON comment(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_user_id ON comment(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_like_comment_id ON comment_like(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_like_user_id ON comment_like(user_id);

-- Enable RLS
ALTER TABLE comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_like ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comment table
-- Anyone can read comments
CREATE POLICY "Anyone can read comments" ON comment
  FOR SELECT USING (true);

-- Users can create their own comments
CREATE POLICY "Users can create comments" ON comment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON comment
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON comment
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comment_like table
-- Anyone can read comment likes
CREATE POLICY "Anyone can read comment likes" ON comment_like
  FOR SELECT USING (true);

-- Users can create/update their own likes
CREATE POLICY "Users can manage own likes" ON comment_like
  FOR ALL USING (auth.uid() = user_id);
