# Database Migration Scripts

This directory contains SQL migration scripts for the quiz scoring system.

## Running the Migrations

These scripts should be run in your Supabase database. You can execute them via:

1. **Supabase Dashboard**: Go to SQL Editor and run each script
2. **Supabase CLI**: Use `supabase db push` if you have migrations set up
3. **Direct SQL connection**: Connect to your database and run the scripts

## Migration Order

Run the migrations in this order:

1. `01_create_increment_tag_scores_function.sql` - Creates function to update tag scores atomically
2. `02_create_get_scored_quizzes_with_tags_function.sql` - Creates function to get scored quizzes filtered by subscriptions

## What These Functions Do

### `increment_tag_scores(tag_ids, score_delta)`
- Atomically updates multiple tag scores
- Used when a quiz is liked/disliked to update all associated tags
- Parameters:
  - `tag_ids`: Array of tag IDs (BIGINT[])
  - `score_delta`: Amount to add/subtract from scores (DOUBLE PRECISION)

### `get_scored_quizzes_with_tags(p_user_id, p_limit)`
- Returns quizzes with calculated scores, filtered by user subscriptions
- Calculates score as: `0.5 * rating + 0.5 * sum(tag scores)`
- Orders results by `final_score` descending
- Includes tags as JSONB array
- Parameters:
  - `p_user_id`: User ID to filter subscriptions (UUID)
  - `p_limit`: Maximum number of quizzes to return (INT, default 50)

## Permissions

Both functions are granted EXECUTE permission to the `authenticated` role, so any authenticated user can call them.
