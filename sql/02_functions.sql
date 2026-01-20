-- Database functions for quiz scoring and tag management
-- Run this AFTER 01_base_tables.sql

-- Function to atomically update multiple tag scores
-- This is used when a quiz is liked/disliked to update all associated tags
CREATE OR REPLACE FUNCTION increment_tag_scores(
  tag_ids BIGINT[],
  score_delta DOUBLE PRECISION
)
RETURNS void AS $$
BEGIN
  UPDATE tag
  SET score = score + score_delta
  WHERE id = ANY(tag_ids);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_tag_scores(BIGINT[], DOUBLE PRECISION) TO authenticated;

-- Function to increment user interaction score with capping at 10
-- Used for view time tracking and flashcard flips
CREATE OR REPLACE FUNCTION increment_user_interaction_score(
  p_quiz_id UUID,
  p_user_id UUID,
  p_increment INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  current_score INTEGER;
  new_score INTEGER;
BEGIN
  -- Get current score or default to 0
  SELECT COALESCE(interaction_score, 0) INTO current_score
  FROM quiz_interaction
  WHERE quiz_id = p_quiz_id AND user_id = p_user_id;
  
  -- Calculate new score, capped at 10
  new_score := LEAST(COALESCE(current_score, 0) + p_increment, 10);
  
  -- Update or insert interaction
  INSERT INTO quiz_interaction (quiz_id, user_id, interaction_score, is_like)
  VALUES (p_quiz_id, p_user_id, new_score, NULL)
  ON CONFLICT (quiz_id, user_id)
  DO UPDATE SET interaction_score = new_score;
  
  RETURN new_score;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_user_interaction_score(UUID, UUID, INTEGER) TO authenticated;

-- Function to get quizzes with calculated scores, filtered by user subscriptions
-- Returns quizzes ordered by final_score (descending)
-- Algorithm: 15% tag scores + 10% user rating + 40% recency + 15% total interaction score + 10% comment count + 10% reply boost
-- User-specific interaction score (0-10) is used to penalize posts (higher = more penalty)
-- Total interaction score (sum of all user scores) is used to boost posts
-- Comment count boosts posts with more engagement
-- Reply boost increases score if someone replied to the user's comment
CREATE OR REPLACE FUNCTION get_scored_quizzes_with_tags(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  data JSONB,
  course_id UUID,
  rating REAL,
  likes INTEGER,
  dislikes INTEGER,
  created_at TIMESTAMPTZ,
  final_score DOUBLE PRECISION,
  tags JSONB,
  is_like BOOLEAN,
  user_id UUID,
  author_username TEXT,
  pdf_id UUID,
  pdf_owner_id UUID,
  pdf_owner_username TEXT,
  course_name TEXT,
  has_interacted BOOLEAN,
  user_interaction_score INTEGER,
  author_profile_picture_url TEXT,
  pdf_owner_profile_picture_url TEXT
) AS $$
DECLARE
  max_tag_sum DOUBLE PRECISION;
  max_days_old DOUBLE PRECISION;
  max_total_interaction_score DOUBLE PRECISION;
  max_comment_count DOUBLE PRECISION;
BEGIN
  -- Find maximum tag sum across all quizzes in the result set for normalization
  SELECT COALESCE(MAX(tag_sum), 1.0) INTO max_tag_sum
  FROM (
    SELECT q.id, COALESCE(SUM(t.score), 0) AS tag_sum
    FROM quiz q
    INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id
    LEFT JOIN quiz_tag qt ON qt.quiz_id = q.id
    LEFT JOIN tag t ON t.id = qt.tag_id
    GROUP BY q.id
  ) tag_sums;

  -- Find maximum days_old for normalization
  SELECT COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 86400.0), 1.0) INTO max_days_old
  FROM quiz q
  INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id;

  -- Find maximum total interaction score (sum of all user interaction scores) for normalization
  SELECT COALESCE(MAX(COALESCE(total_interaction_score, 0)), 1.0) INTO max_total_interaction_score
  FROM (
    SELECT q.id, COALESCE(SUM(qi.interaction_score), 0) AS total_interaction_score
    FROM quiz q
    INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id
    LEFT JOIN quiz_interaction qi ON qi.quiz_id = q.id
    GROUP BY q.id
  ) interaction_scores;

  -- Find maximum comment count for normalization
  SELECT COALESCE(MAX(COALESCE(comment_count, 0)), 1.0) INTO max_comment_count
  FROM (
    SELECT q.id, COUNT(DISTINCT c.id) AS comment_count
    FROM quiz q
    INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id
    LEFT JOIN comment c ON c.quiz_id = q.id
    GROUP BY q.id
  ) comment_counts;

  -- Ensure all max values are at least 1.0 to avoid division by zero
  IF max_tag_sum < 1.0 THEN
    max_tag_sum := 1.0;
  END IF;
  IF max_days_old < 1.0 THEN
    max_days_old := 1.0;
  END IF;
  IF max_total_interaction_score < 1.0 THEN
    max_total_interaction_score := 1.0;
  END IF;
  IF max_comment_count < 1.0 THEN
    max_comment_count := 1.0;
  END IF;

  RETURN QUERY
  WITH scored_quizzes AS (
    SELECT
      q.id,
      to_jsonb(q.data) AS data,
      q.course_id,
      c.name AS course_name,
      q.rating,
      q.likes,
      q.dislikes,
      q.created_at,
      q.user_id,
      author_profile.username AS author_username,
      author_profile.profile_picture_url AS author_profile_picture_url,
      q.pdf_id,
      pdf_owner_profile.id AS pdf_owner_id,
      pdf_owner_profile.username AS pdf_owner_username,
      pdf_owner_profile.profile_picture_url AS pdf_owner_profile_picture_url,
      COALESCE(SUM(t.score), 0) AS tag_sum,
      COALESCE(p.rating, 7.5) AS user_rating,
      qi.is_like,
      COALESCE(qi.interaction_score, 0) AS user_interaction_score,
      (qi.quiz_id IS NOT NULL) AS has_interacted,
      -- Calculate total interaction score (sum of all user interaction scores for this post)
      COALESCE((
        SELECT SUM(qi2.interaction_score)
        FROM quiz_interaction qi2
        WHERE qi2.quiz_id = q.id
      ), 0) AS total_interaction_score,
      -- Calculate comment count for this post
      COALESCE((
        SELECT COUNT(DISTINCT c.id)
        FROM comment c
        WHERE c.quiz_id = q.id
      ), 0) AS comment_count,
      -- Check if someone replied to the user's comment (boost for personal relevance)
      CASE 
        WHEN EXISTS (
          SELECT 1
          FROM comment c1
          INNER JOIN comment c2 ON c2.parent_comment_id = c1.id
          WHERE c1.quiz_id = q.id 
            AND c1.user_id = p_user_id
            AND c2.user_id != p_user_id
        ) THEN 1.0
        ELSE 0.0
      END AS has_reply_to_user_comment,
      -- Calculate days since creation
      EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 86400.0 AS days_old
    FROM quiz q
    INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id
    INNER JOIN course c ON c.id = q.course_id
    LEFT JOIN profile p ON p.id = q.user_id
    LEFT JOIN profile author_profile ON author_profile.id = q.user_id
    LEFT JOIN course_pdfs pdf ON pdf.id = q.pdf_id
    LEFT JOIN profile pdf_owner_profile ON pdf_owner_profile.id = pdf.user_id
    LEFT JOIN quiz_tag qt ON qt.quiz_id = q.id
    LEFT JOIN tag t ON t.id = qt.tag_id
    LEFT JOIN quiz_interaction qi ON qi.quiz_id = q.id AND qi.user_id = p_user_id
    GROUP BY q.id, q.course_id, c.name, q.rating, q.likes, q.dislikes, q.created_at, q.user_id, 
             author_profile.username, author_profile.profile_picture_url, q.pdf_id, pdf_owner_profile.id, pdf_owner_profile.username, 
             pdf_owner_profile.profile_picture_url, p.rating, qi.is_like, qi.quiz_id, qi.interaction_score, p_user_id
  )
  SELECT
    sq.id,
    sq.data,
    sq.course_id,
    sq.rating,
    sq.likes,
    sq.dislikes,
    sq.created_at,
    -- Calculate final score with normalization and randomization
    -- User-specific interaction score is used to penalize (higher = more penalty)
    -- Total interaction score is used to boost (higher = more popular/engaging)
    CASE 
      WHEN sq.user_interaction_score > 0 THEN 
        -- Penalize based on user's interaction score (0-10 scale)
        -- Higher interaction score = heavier penalty
        -- Penalty formula: multiply by (1 - interaction_score/10 * 0.9)
        -- This means max interaction (10) reduces score to 10% of original
        (
          -- Base score components (normalized)
          0.15 * (sq.tag_sum / max_tag_sum) +  -- Normalized tag score (15%)
          0.10 * (sq.user_rating / 10.0) +  -- Normalized user rating (10%)
          0.40 * EXP(-sq.days_old / 7.0) +  -- Recency (40%)
          0.15 * (sq.total_interaction_score / max_total_interaction_score) +  -- Total interaction score boost (15%)
          0.10 * LEAST(sq.comment_count / max_comment_count, 1.0) +  -- Comment count boost (10%, normalized and capped at 1.0)
          0.10 * sq.has_reply_to_user_comment  -- Reply boost (10% if someone replied to user's comment)
        ) * (1.0 - (sq.user_interaction_score / 10.0) * 0.9) * (0.9 + random() * 0.2)  -- Penalize + randomize ±10%
      ELSE 
        -- Normal scoring for non-interacted quizzes
        (
          -- Base score components (normalized)
          0.15 * (sq.tag_sum / max_tag_sum) +  -- Normalized tag score (15%)
          0.10 * (sq.user_rating / 10.0) +  -- Normalized user rating (10%)
          0.40 * EXP(-sq.days_old / 7.0) +  -- Recency (40%)
          0.15 * (sq.total_interaction_score / max_total_interaction_score) +  -- Total interaction score boost (15%)
          0.10 * LEAST(sq.comment_count / max_comment_count, 1.0) +  -- Comment count boost (10%, normalized and capped at 1.0)
          0.10 * sq.has_reply_to_user_comment  -- Reply boost (10% if someone replied to user's comment)
        ) * (0.9 + random() * 0.2)  -- Randomize ±10%
    END AS final_score,
    COALESCE(
      jsonb_agg(jsonb_build_object('name', t.name, 'score', t.score)) 
      FILTER (WHERE t.id IS NOT NULL),
      '[]'::jsonb
    ) AS tags,
    sq.is_like,
    sq.user_id,
    sq.author_username,
    sq.pdf_id,
    sq.pdf_owner_id,
    sq.pdf_owner_username,
    sq.course_name,
    sq.has_interacted,
    sq.user_interaction_score,
    sq.author_profile_picture_url,
    sq.pdf_owner_profile_picture_url
  FROM scored_quizzes sq
  LEFT JOIN quiz_tag qt ON qt.quiz_id = sq.id
  LEFT JOIN tag t ON t.id = qt.tag_id
  GROUP BY sq.id, sq.data, sq.course_id, sq.course_name, sq.rating, sq.likes, sq.dislikes, sq.created_at, 
           sq.user_id, sq.author_username, sq.author_profile_picture_url, sq.pdf_id, sq.pdf_owner_id, sq.pdf_owner_username, 
           sq.pdf_owner_profile_picture_url, sq.tag_sum, sq.user_rating, sq.is_like, sq.has_interacted, sq.user_interaction_score, 
           sq.total_interaction_score, sq.comment_count, sq.has_reply_to_user_comment, sq.days_old, max_tag_sum, max_total_interaction_score, max_comment_count
  ORDER BY final_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_scored_quizzes_with_tags(UUID, INT) TO authenticated;
