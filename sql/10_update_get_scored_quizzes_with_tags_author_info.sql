-- Update get_scored_quizzes_with_tags function to include author and PDF owner information
-- This allows the feed to display "Created by @username" or "Created from @username's notes"

-- Drop the old function
DROP FUNCTION IF EXISTS get_scored_quizzes_with_tags(UUID, INT);

CREATE FUNCTION get_scored_quizzes_with_tags(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  data JSONB,
  course_id UUID,
  rating REAL,
  final_score DOUBLE PRECISION,
  tags JSONB,
  is_like BOOLEAN,
  user_id UUID,
  author_username TEXT,
  pdf_id UUID,
  pdf_owner_id UUID,
  pdf_owner_username TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    to_jsonb(q.data) AS data,
    q.course_id,
    q.rating,
    CASE 
      WHEN qi.is_like IS NOT NULL THEN 
        (0.5 * q.rating + 0.4 * COALESCE(SUM(t.score), 0) + 0.1 * COALESCE(p.rating, 7.5)) * 0.1
      ELSE 
        0.5 * q.rating + 0.4 * COALESCE(SUM(t.score), 0) + 0.1 * COALESCE(p.rating, 7.5)
    END AS final_score,
    COALESCE(
      jsonb_agg(jsonb_build_object('name', t.name, 'score', t.score)) 
      FILTER (WHERE t.id IS NOT NULL),
      '[]'::jsonb
    ) AS tags,
    qi.is_like,
    q.user_id,
    author_profile.username AS author_username,
    q.pdf_id,
    pdf_owner_profile.id AS pdf_owner_id,
    pdf_owner_profile.username AS pdf_owner_username
  FROM quiz q
  INNER JOIN course_subscription cs ON cs.course_id = q.course_id AND cs.user_id = p_user_id
  LEFT JOIN profile p ON p.id = q.user_id
  LEFT JOIN profile author_profile ON author_profile.id = q.user_id
  LEFT JOIN course_pdfs pdf ON pdf.id = q.pdf_id
  LEFT JOIN profile pdf_owner_profile ON pdf_owner_profile.id = pdf.user_id
  LEFT JOIN quiz_tag qt ON qt.quiz_id = q.id
  LEFT JOIN tag t ON t.id = qt.tag_id
  LEFT JOIN quiz_interaction qi ON qi.quiz_id = q.id AND qi.user_id = p_user_id
  GROUP BY q.id, q.course_id, q.rating, p.rating, qi.is_like, q.user_id, author_profile.username, q.pdf_id, pdf_owner_profile.id, pdf_owner_profile.username
  ORDER BY final_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_scored_quizzes_with_tags(UUID, INT) TO authenticated;
