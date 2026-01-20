-- Update scoring function to use per-user interaction scores
-- User-specific score is used to penalize posts (higher score = more penalty)
-- Total interaction score (sum of all user scores) is used to boost posts

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
  has_interacted BOOLEAN,
  user_interaction_score INTEGER
) AS $$
DECLARE
  max_tag_sum DOUBLE PRECISION;
  max_days_old DOUBLE PRECISION;
  max_total_interaction_score DOUBLE PRECISION;
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
             author_profile.username, q.pdf_id, pdf_owner_profile.id, pdf_owner_profile.username, 
             p.rating, qi.is_like, qi.quiz_id, qi.interaction_score
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
          0.20 * (sq.tag_sum / max_tag_sum) +  -- Normalized tag score (20%)
          0.15 * (sq.user_rating / 10.0) +  -- Normalized user rating (15%)
          0.45 * EXP(-sq.days_old / 7.0) +  -- Recency (45%)
          0.20 * (sq.total_interaction_score / max_total_interaction_score)  -- Total interaction score boost (20%)
        ) * (1.0 - (sq.user_interaction_score / 10.0) * 0.9) * (0.9 + random() * 0.2)  -- Penalize + randomize ±10%
      ELSE 
        -- Normal scoring for non-interacted quizzes
        (
          -- Base score components (normalized)
          0.20 * (sq.tag_sum / max_tag_sum) +  -- Normalized tag score (20%)
          0.15 * (sq.user_rating / 10.0) +  -- Normalized user rating (15%)
          0.45 * EXP(-sq.days_old / 7.0) +  -- Recency (45%)
          0.20 * (sq.total_interaction_score / max_total_interaction_score)  -- Total interaction score boost (20%)
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
    sq.user_interaction_score
  FROM scored_quizzes sq
  LEFT JOIN quiz_tag qt ON qt.quiz_id = sq.id
  LEFT JOIN tag t ON t.id = qt.tag_id
  GROUP BY sq.id, sq.data, sq.course_id, sq.course_name, sq.rating, sq.likes, sq.dislikes, sq.created_at, 
           sq.user_id, sq.author_username, sq.pdf_id, sq.pdf_owner_id, sq.pdf_owner_username, 
           sq.tag_sum, sq.user_rating, sq.is_like, sq.has_interacted, sq.user_interaction_score, 
           sq.total_interaction_score, sq.days_old, max_tag_sum, max_total_interaction_score
  ORDER BY final_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_scored_quizzes_with_tags(UUID, INT) TO authenticated;
