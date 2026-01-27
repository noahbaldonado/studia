# Database Migration Scripts

This directory contains SQL migration scripts for the Studia application. These scripts should be run sequentially in your Supabase database.

## Running the Migrations

These scripts should be run in your Supabase database. You can execute them via:

1. **Supabase Dashboard**: Go to SQL Editor and run each script in order
2. **Supabase CLI**: Use `supabase db push` if you have migrations set up
3. **Direct SQL connection**: Connect to your database and run the scripts

## Migration Order

**IMPORTANT**: Run the migrations in this exact order. Each migration depends on the previous ones.

### Required Migrations

1. **`01_base_tables.sql`** - **Run this FIRST!**
   - Creates all core tables: `profile`, `course`, `course_subscription`, `quiz`, `tag`, `quiz_tag`
   - Includes all columns: `username`, `profile_picture_url`, `syllabus_url`, `likes`, `dislikes`, `generated_from_pdf`
   - Sets up RLS policies and indexes
   - Creates triggers for `updated_at` timestamps

2. **`02_functions.sql`** - **Run AFTER base tables**
   - Creates `increment_tag_scores()` function for atomic tag score updates
   - Creates `increment_user_interaction_score()` function for view time tracking
   - Creates `get_scored_quizzes_with_tags()` function for the recommendation algorithm
   - Algorithm: 20% tag scores + 15% user rating + 45% recency + 20% total interaction score
   - Uses per-user interaction scores (0-10) to penalize already-interacted posts

3. **`03_additional_tables.sql`** - **Run AFTER functions**
   - Creates `comment` and `comment_like` tables for commenting system
   - Creates `quiz_interaction` table with `interaction_score` column (0-10)
   - Creates `follow` table for user relationships
   - Creates `poll_vote` table for poll voting
   - Sets up RLS policies and indexes for all tables

4. **`04_storage_policies.sql`** - **Run AFTER creating storage buckets**
   - Sets up RLS policies for `course-pdfs` bucket (public read, authenticated write)
   - Sets up RLS policies for `profile-pictures` bucket (public read, user-specific write)
   - **Note**: You must create these buckets in Supabase Dashboard → Storage first

5. **`06_messages.sql`** - **Run AFTER additional tables**
   - Creates `conversation` table for 1-on-1 conversations between users
   - Creates `message` table for individual messages
   - Sets up RLS policies and indexes
   - Creates triggers to update conversation timestamps when messages are sent

6. **`08_remove_pdf_storage.sql`** - **Run AFTER base tables**
   - Removes `pdf_id` column from `quiz` table
   - Adds `generated_from_pdf` boolean column to `quiz` table
   - Drops `course_pdfs` table (PDFs are no longer stored permanently)

7. **`09_add_professor_quarter.sql`** - **Run AFTER base tables**
   - Adds `professor` and `quarter` columns to `course` table
   - Adds indexes for efficient lookups by professor and quarter

8. **`10_allow_likes_dislikes_updates.sql`** - **Run AFTER base tables**
   - Adds RLS policy to allow authenticated users to update `likes` and `dislikes` on any quiz
   - Required for like/dislike functionality to work

9. **`11_allow_uppercase_usernames.sql`** - **Run AFTER base tables**
   - Updates username constraint to allow uppercase letters (A-Z)
   - Usernames remain case-insensitive for uniqueness (via LOWER index)

### Optional Migrations

6. **`05_seed_sample_courses.sql`** - **Optional seed script**
   - Adds 10 sample Computer Science courses for testing
   - Can be run after migrations are complete
   - Uses `INSERT ... WHERE NOT EXISTS` to avoid duplicates

## Database Schema Overview

### Core Tables

- **`profile`**: User profiles with username, rating, profile picture URL
- **`course`**: Course information (name, subject, course link)
- **`course_subscription`**: Many-to-many relationship between users and courses
- **`course_pdfs`**: Metadata for uploaded PDF files
- **`quiz`**: Posts (quizzes, flashcards, sticky notes, polls, open questions) with likes/dislikes
- **`tag`**: Tags with scores for recommendation algorithm
- **`quiz_tag`**: Junction table linking quizzes to tags

### Additional Tables

- **`comment`**: Comments on posts with parent-child relationships
- **`comment_like`**: Likes/dislikes on comments
- **`quiz_interaction`**: User interactions with posts (likes, dislikes, interaction scores)
- **`follow`**: User follow relationships
- **`poll_vote`**: Votes on poll content
- **`conversation`**: 1-on-1 conversations between users
- **`message`**: Individual messages in conversations
- **Note**: Syllabus replacements are now stored as quiz entries with `type: "syllabus_replacement"` in the `quiz` table

### Functions

- **`increment_tag_scores(tag_ids, score_delta)`**: Atomically updates multiple tag scores
- **`increment_user_interaction_score(quiz_id, user_id, increment)`**: Increments user's interaction score (capped at 10)
- **`get_scored_quizzes_with_tags(user_id, limit)`**: Returns scored quizzes filtered by subscriptions

## Storage Buckets

Before running `04_storage_policies.sql`, create these buckets in Supabase Dashboard → Storage:

1. **`course-pdfs`**: Public bucket for course PDF files
   - Public read access
   - Authenticated users can upload/update/delete

2. **`profile-pictures`**: Public bucket for user profile pictures
   - Public read access
   - Users can only upload/update/delete their own pictures (based on folder structure)

3. **`course-syllabi`**: Public bucket for course syllabus files
   - Public read access
   - Authenticated users can upload/update/delete

## Permissions

All functions are granted EXECUTE permission to the `authenticated` role, so any authenticated user can call them.

RLS policies ensure:
- Users can only modify their own data
- Public read access where appropriate
- Authenticated users can create content
- Users can manage their own subscriptions and interactions

## Notes

- All migrations use `IF NOT EXISTS` and `DROP ... IF EXISTS` to allow safe re-running
- Migrations are idempotent (can be run multiple times safely)
- The recommendation algorithm prioritizes new content (45% recency weight)
- User interaction scores penalize already-interacted posts to improve feed diversity
