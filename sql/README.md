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
3. `03_create_comment_tables.sql` - Creates comment and comment_like tables for quiz commenting system
4. `04_create_quiz_interaction_table.sql` - Creates quiz_interaction table to track which quizzes users have liked/disliked
5. `05_create_follow_table.sql` - Creates follow table to track user relationships (who follows whom)

## What These Functions Do

### `increment_tag_scores(tag_ids, score_delta)`
- Atomically updates multiple tag scores
- Used when a quiz is liked/disliked to update all associated tags
- Parameters:
  - `tag_ids`: Array of tag IDs (BIGINT[])
  - `score_delta`: Amount to add/subtract from scores (DOUBLE PRECISION)

### `get_scored_quizzes_with_tags(p_user_id, p_limit)`
- Returns quizzes with calculated scores, filtered by user subscriptions
- **Excludes quizzes the user has already liked/disliked** (via quiz_interaction table)
- Calculates score as: `0.5 * rating + 0.4 * sum(tag scores) + 0.1 * user score`
- Orders results by `final_score` descending
- Includes tags as JSONB array
- Parameters:
  - `p_user_id`: User ID to filter subscriptions (UUID)
  - `p_limit`: Maximum number of quizzes to return (INT, default 50)

### `quiz_interaction` Table
- Tracks which quizzes each user has liked or disliked
- Prevents showing the same quiz to a user after they've interacted with it
- Schema:
  - `quiz_id` (UUID, FK to quiz)
  - `user_id` (UUID, FK to auth.users)
  - `is_like` (BOOLEAN) - true for like, false for dislike
  - `created_at`, `updated_at` (TIMESTAMPTZ)
  - Primary key: (quiz_id, user_id)
- RLS policies ensure users can only read/modify their own interactions

### `follow` Table
- Tracks user relationships (who follows whom)
- Schema:
  - `follower_id` (UUID, FK to auth.users) - The user who is following
  - `following_id` (UUID, FK to auth.users) - The user being followed
  - `created_at` (TIMESTAMPTZ)
  - Primary key: (follower_id, following_id)
  - Constraint: Users cannot follow themselves
- RLS policies:
  - Anyone can read follow relationships
  - Users can create their own follow relationships (follow others)
  - Users can delete their own follow relationships (unfollow)

## Permissions

All functions are granted EXECUTE permission to the `authenticated` role, so any authenticated user can call them.
