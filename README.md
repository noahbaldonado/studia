# Studia

A learning platform built for CruzHacks 2026. Upload PDFs, generate study materials like flashcards and quizzes, and track your progress with streaks and leaderboards.

## Live Demo

The app is deployed on Vercel at https://cruzhack-l626.vercel.app/

## Tech Stack

- Next.js with React
- TypeScript
- Supabase for database and authentication
- Tailwind CSS for styling
- Google Gemini AI for content generation
- Vercel for deployment

## Getting Started

### Prerequisites

You need Node.js installed on your machine. Also make sure you have npm or yarn.

### Installation

1. Clone the repository or download the project files

2. Install dependencies:
   npm install

3. Set up environment variables. Create a .env.local file in the root directory with the following variables:
   - SUPABASE_URL - your Supabase project URL
   - SUPABASE_ANON_KEY - your Supabase anon key
   - SUPABASE_SERVICE_ROLE_KEY - your Supabase service role key (required for account deletion)
     * Get it from: Supabase Dashboard → Settings → API → Service Role Key
     * ⚠️ **Never expose this key to the client** - it has admin privileges
   - GEMINI_API_KEY - your Google Gemini API key for content generation
   - NEXT_PUBLIC_SUPABASE_URL - same as SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY - same as SUPABASE_ANON_KEY (required for Supabase SSR client)

4. Set up your Supabase database. The project includes SQL migration files in the sql/ directory. Run them in order to create the necessary database tables and functions.

5. Run the development server:
   npm run dev

6. Open your browser and navigate to http://localhost:3000

The app uses Google OAuth for authentication, so make sure your Supabase project is configured with Google as an OAuth provider.

### Database Setup

The sql/ directory contains migration files that set up the database schema. Make sure to run them in order:
- `00_create_base_tables.sql` - **Run this first!** Creates all core tables
- `01_create_increment_tag_scores_function.sql`
- `02_create_get_scored_quizzes_with_tags_function.sql`
- `03_create_comment_tables.sql`
- `04_create_quiz_interaction_table.sql`
- `05_create_follow_table.sql`
- `06_add_username_to_profile.sql`
- `08_remove_deleted_at_from_profile.sql`
- `09_add_pdf_source_to_quiz.sql`
- `10_update_get_scored_quizzes_with_tags_author_info.sql`
- `11_seed_sample_courses.sql` - **Optional** - Adds 10 sample courses for testing

See `sql/README.md` for detailed information about each migration.

### Available Scripts

- `npm run dev` - starts the development server with Turbopack
- `npm run build` - builds the app for production
- `npm run start` - starts the production server
- `npm run lint` - runs ESLint to check for code issues

### Project Structure

- app/ - Next.js app router pages and API routes
- components/ - React components
- lib/ - utility functions and Supabase clients
- sql/ - database migration files

### Deployment

The app is configured for Vercel deployment. Make sure all environment variables are set in your Vercel project settings (including `SUPABASE_SERVICE_ROLE_KEY`). The build command is automatically detected from package.json.

## Features

- User authentication with Google Sign-In
- Upload PDFs and generate study content automatically
- Create flashcards, quizzes, and sticky notes from PDF content with AI or create them yourself
- Follow courses and friends
- Track learning streaks
- Quiz Rush game with leaderboards
- Comment system to interact with posts created by other users
- Profile pages with course and post management
