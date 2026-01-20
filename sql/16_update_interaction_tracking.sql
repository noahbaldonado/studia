-- Update interaction tracking to be more general
-- Any row in quiz_interaction means the user has "interacted" with the post
-- This includes likes, dislikes, and view time interactions

-- First, ensure the table can handle general interactions
-- The is_like column can be NULL for view-time-only interactions
ALTER TABLE quiz_interaction ALTER COLUMN is_like DROP NOT NULL;

-- Add a comment to clarify the new behavior
COMMENT ON COLUMN quiz_interaction.is_like IS 'true for like, false for dislike, NULL for view-time-only interaction';

-- Update the scoring function to check for ANY interaction (presence of row, not just is_like)
-- The presence of a row in quiz_interaction means the user has interacted
DROP FUNCTION IF EXISTS get_scored_quizzes_with_tags(UUID, INT);

CREATE FUNCTION get_scored_quizzes_with_tags(p_user_id UUID, p_limit INT DEFAULT 50)
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
  has_interacted BOOLEAN
) AS $$
DECLARE
  max_tag_sum DOUBLE PRECISION;
  max_days_old DOUBLE PRECISION;
  max_interaction_score DOUBLE PRECISION;
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

  -- Find maximum interaction_score for normalization
  SELECT COALESCE(MAX(COALESCE(q.interaction_score, 0)), 1.0) INTO max_interaction_score
  FROM quiz q
  INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id;

  -- Ensure all max values are at least 1.0 to avoid division by zero
  IF max_tag_sum < 1.0 THEN
    max_tag_sum := 1.0;
  END IF;
  IF max_days_old < 1.0 THEN
    max_days_old := 1.0;
  END IF;
  IF max_interaction_score < 1.0 THEN
    max_interaction_score := 1.0;
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
      q.pdf_id,
      pdf_owner_profile.id AS pdf_owner_id,
      pdf_owner_profile.username AS pdf_owner_username,
      COALESCE(q.interaction_score, 0) AS interaction_score,
      COALESCE(SUM(t.score), 0) AS tag_sum,
      COALESCE(p.rating, 7.5) AS user_rating,
      qi.is_like,
      (qi.quiz_id IS NOT NULL) AS has_interacted, -- TRUE if any row exists in quiz_interaction
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
             q.interaction_score, author_profile.username, q.pdf_id, pdf_owner_profile.id, pdf_owner_profile.username, 
             p.rating, qi.is_like, qi.quiz_id
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
    -- Use has_interacted instead of is_like to check for ANY interaction
    -- Include interaction_score to boost posts that people engage with more
    CASE 
      WHEN sq.has_interacted THEN 
        -- Heavily penalize already-interacted quizzes (essentially hide them)
        (
          -- Base score components (normalized)
          0.20 * (sq.tag_sum / max_tag_sum) +  -- Normalized tag score (20%)
          0.15 * (sq.user_rating / 10.0) +  -- Normalized user rating (15%)
          0.45 * EXP(-sq.days_old / 7.0) +  -- Recency (45%)
          0.20 * (sq.interaction_score / max_interaction_score)  -- Interaction score (20%)
        ) * 0.1 * (0.9 + random() * 0.2)  -- Penalize interacted + randomize ±10%
      ELSE 
        -- Normal scoring for non-interacted quizzes
        (
          -- Base score components (normalized)
          0.20 * (sq.tag_sum / max_tag_sum) +  -- Normalized tag score (20%)
          0.15 * (sq.user_rating / 10.0) +  -- Normalized user rating (15%)
          0.45 * EXP(-sq.days_old / 7.0) +  -- Recency (45%)
          0.20 * (sq.interaction_score / max_interaction_score)  -- Interaction score (20%)
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
    sq.has_interacted
  FROM scored_quizzes sq
  LEFT JOIN quiz_tag qt ON qt.quiz_id = sq.id
  LEFT JOIN tag t ON t.id = qt.tag_id
  GROUP BY sq.id, sq.data, sq.course_id, sq.course_name, sq.rating, sq.likes, sq.dislikes, sq.created_at, 
           sq.user_id, sq.author_username, sq.pdf_id, sq.pdf_owner_id, sq.pdf_owner_username, 
           sq.tag_sum, sq.user_rating, sq.is_like, sq.has_interacted, sq.interaction_score, sq.days_old, max_tag_sum, max_interaction_score
  ORDER BY final_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_scored_quizzes_with_tags(UUID, INT) TO authenticated;
