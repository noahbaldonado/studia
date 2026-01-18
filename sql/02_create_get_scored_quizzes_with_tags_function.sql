-- Function to get quizzes with calculated scores, filtered by user subscriptions
-- Returns quizzes ordered by final_score (descending)
-- Score calculation: 0.5 * quiz rating + 0.4 * sum(tag scores) + 0.1 * user score

-- Drop the function first to ensure clean recreation
DROP FUNCTION IF EXISTS get_scored_quizzes_with_tags(UUID, INT);

CREATE FUNCTION get_scored_quizzes_with_tags(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  data JSONB,
  course_id UUID,
  rating REAL,
  final_score DOUBLE PRECISION,
  tags JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    to_jsonb(q.data) AS data,
    q.course_id,
    q.rating,
    0.5 * q.rating + 0.4 * COALESCE(SUM(t.score), 0) + 0.1 * COALESCE(p.rating, 7.5) AS final_score,
    COALESCE(
      jsonb_agg(jsonb_build_object('name', t.name, 'score', t.score)) 
      FILTER (WHERE t.id IS NOT NULL),
      '[]'::jsonb
    ) AS tags
  FROM quiz q
  INNER JOIN course_subscription cs ON cs.course_id = q.course_id
  LEFT JOIN profile p ON p.id = q.user_id
  LEFT JOIN quiz_tag qt ON qt.quiz_id = q.id
  LEFT JOIN tag t ON t.id = qt.tag_id
  WHERE cs.user_id = p_user_id
  GROUP BY q.id, p.rating
  ORDER BY final_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_scored_quizzes_with_tags(UUID, INT) TO authenticated;
