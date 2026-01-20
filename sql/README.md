# Database Migration Scripts

This directory contains SQL migration scripts for the quiz scoring system.

## Running the Migrations

These scripts should be run in your Supabase database. You can execute them via:

1. **Supabase Dashboard**: Go to SQL Editor and run each script
2. **Supabase CLI**: Use `supabase db push` if you have migrations set up
3. **Direct SQL connection**: Connect to your database and run the scripts

## Migration Order

**IMPORTANT**: Run the migrations in this exact order. The base tables migration must be run first as all other migrations depend on these tables.

1. **`00_create_base_tables.sql`** - **Run this FIRST!** Creates all core tables: `profile`, `course`, `course_subscription`, `course_pdfs`, `quiz`, `tag`, and `quiz_tag`
2. `01_create_increment_tag_scores_function.sql` - Creates function to update tag scores atomically
3. `02_create_get_scored_quizzes_with_tags_function.sql` - Creates function to get scored quizzes filtered by subscriptions
4. `03_create_comment_tables.sql` - Creates comment and comment_like tables for quiz commenting system
5. `04_create_quiz_interaction_table.sql` - Creates quiz_interaction table to track which quizzes users have liked/disliked
6. `05_create_follow_table.sql` - Creates follow table to track user relationships (who follows whom)
7. `06_add_username_to_profile.sql` - Adds username column to profile table with validation
8. `08_remove_deleted_at_from_profile.sql` - Removes deleted_at column (migration 07 was removed, this is the final cleanup)
9. `09_add_pdf_source_to_quiz.sql` - Adds pdf_id column to quiz table to track PDF source
10. `10_update_get_scored_quizzes_with_tags_author_info.sql` - Updates RPC function to include author and PDF owner information
11. `11_seed_sample_courses.sql` - **Optional seed script** - Adds 10 sample courses for testing. Run this in Supabase SQL Editor after setting up your database.
12. `12_create_storage_bucket_policies.sql` - **Required if using PDF uploads** - Sets up RLS policies for the 'course-pdfs' storage bucket. Run this after creating the bucket in Supabase Storage.
13. `13_create_poll_vote_table.sql` - Creates the `poll_vote` table to track votes on poll content. Required for poll functionality.
14. `14_add_likes_dislikes_to_quiz.sql` - Adds `likes` and `dislikes` columns to quiz table and migrates existing data from `quiz_interaction` table.
15. `15_update_scoring_with_recency.sql` - Updates scoring function with recency (exponential decay), normalization, and randomization. New algorithm: 35% tag scores + 25% user rating + 25% recency + 15% randomization.
16. `17_add_interaction_score.sql` - **Run BEFORE migration 16!** Adds `interaction_score` column to quiz table to track overall engagement (views, flips, answers, votes, etc.)
17. `16_update_interaction_tracking.sql` - Updates interaction tracking to be more general (any row in quiz_interaction = interacted) and updates scoring function to include `interaction_score`. Requires migration 17 to be run first.

## Base Tables (00_create_base_tables.sql)

This migration creates all the core tables required by the application:

### `profile` Table
- Stores user profile information
- Columns: `id` (UUID, FK to auth.users), `rating` (REAL), `metadata` (JSONB)
- Automatically created in auth callback, but table must exist first
- RLS enabled: Anyone can read, users can update their own

### `course` Table
- Stores course information
- Columns: `id` (UUID), `name` (TEXT), `subject` (TEXT), `course_link` (TEXT)
- RLS enabled: Anyone can read

### `course_subscription` Table
- Tracks which users are subscribed to which courses
- Columns: `user_id` (UUID), `course_id` (UUID)
- Primary key: (user_id, course_id)
- RLS enabled: Anyone can read, users can manage their own subscriptions

### `course_pdfs` Table
- Stores metadata for uploaded PDF files
- Columns: `id` (UUID), `course_id` (UUID), `user_id` (UUID), `name` (TEXT), `file_path` (TEXT)
- RLS enabled: Anyone can read, users can upload/delete their own PDFs

### `quiz` Table
- Stores quiz, flashcard, sticky note, and other post types
- Columns: `id` (UUID), `course_id` (UUID), `user_id` (UUID), `data` (JSONB), `rating` (REAL)
- RLS enabled: Anyone can read, users can manage their own quizzes

### `tag` Table
- Stores tags with scores for recommendation algorithm
- Columns: `id` (BIGSERIAL), `name` (TEXT, UNIQUE), `score` (DOUBLE PRECISION)
- RLS enabled: Anyone can read, authenticated users can create/update

### `quiz_tag` Table
- Junction table linking quizzes to tags
- Columns: `quiz_id` (UUID), `tag_id` (BIGINT)
- Primary key: (quiz_id, tag_id)
- RLS enabled: Anyone can read, authenticated users can manage

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
