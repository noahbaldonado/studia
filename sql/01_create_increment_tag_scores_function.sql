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
