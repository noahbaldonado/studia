-- Update get_scored_quizzes_with_tags function to include recency, normalization, and randomization
-- New algorithm: 35% tag scores + 25% user rating + 25% recency + 15% randomization
-- Remove rating from score calculation

-- Drop the old function
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
  pdf_owner_username TEXT
) AS $$
DECLARE
  max_tag_sum DOUBLE PRECISION;
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

  -- Ensure max_tag_sum is at least 1.0 to avoid division by zero
  IF max_tag_sum < 1.0 THEN
    max_tag_sum := 1.0;
  END IF;

  RETURN QUERY
  WITH scored_quizzes AS (
    SELECT
      q.id,
      to_jsonb(q.data) AS data,
      q.course_id,
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
      -- Calculate days since creation
      EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 86400.0 AS days_old
    FROM quiz q
    INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id
    LEFT JOIN profile p ON p.id = q.user_id
    LEFT JOIN profile author_profile ON author_profile.id = q.user_id
    LEFT JOIN course_pdfs pdf ON pdf.id = q.pdf_id
    LEFT JOIN profile pdf_owner_profile ON pdf_owner_profile.id = pdf.user_id
    LEFT JOIN quiz_tag qt ON qt.quiz_id = q.id
    LEFT JOIN tag t ON t.id = qt.tag_id
    LEFT JOIN quiz_interaction qi ON qi.quiz_id = q.id AND qi.user_id = p_user_id
    GROUP BY q.id, q.course_id, q.rating, q.likes, q.dislikes, q.created_at, q.user_id, 
             author_profile.username, q.pdf_id, pdf_owner_profile.id, pdf_owner_profile.username, 
             p.rating, qi.is_like
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
    -- Increased recency weight to prioritize new posts
    CASE 
      WHEN sq.is_like IS NOT NULL THEN 
        -- Heavily penalize already-interacted quizzes (essentially hide them)
        (
          -- Base score components (normalized)
          0.25 * COALESCE(LEAST(sq.tag_sum / NULLIF(max_tag_sum, 0), 1.0), 0.0) +  -- Normalized tag score (capped at 1.0, default 0 if no tags)
          0.20 * (sq.user_rating / 10.0) +  -- Normalized user rating (0-10 to 0-1)
          0.55 * EXP(-LEAST(sq.days_old, 30) / 7.0)  -- Recency (exponential decay, cap at 30 days) - increased weight
        ) * 0.1 * (0.9 + random() * 0.2)  -- Penalize interacted + randomize ±10%
      ELSE 
        -- Normal scoring for non-interacted quizzes
        (
          -- Base score components (normalized)
          0.25 * COALESCE(LEAST(sq.tag_sum / NULLIF(max_tag_sum, 0), 1.0), 0.0) +  -- Normalized tag score (capped at 1.0, default 0 if no tags)
          0.20 * (sq.user_rating / 10.0) +  -- Normalized user rating (0-10 to 0-1)
          0.55 * EXP(-LEAST(sq.days_old, 30) / 7.0)  -- Recency (exponential decay, cap at 30 days) - increased weight
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
    sq.pdf_owner_username
  FROM scored_quizzes sq
  LEFT JOIN quiz_tag qt ON qt.quiz_id = sq.id
  LEFT JOIN tag t ON t.id = qt.tag_id
  GROUP BY sq.id, sq.data, sq.course_id, sq.rating, sq.likes, sq.dislikes, sq.created_at, 
           sq.user_id, sq.author_username, sq.pdf_id, sq.pdf_owner_id, sq.pdf_owner_username, 
           sq.tag_sum, sq.user_rating, sq.is_like, sq.days_old, max_tag_sum
  ORDER BY final_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_scored_quizzes_with_tags(UUID, INT) TO authenticated;
