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

The sql/ directory contains consolidated migration files that set up the database schema. Run them in this exact order:

1. **`01_base_tables.sql`** - **Run this FIRST!**
   - Creates all core tables: `profile`, `course`, `course_subscription`, `quiz`, `tag`, `quiz_tag`
   - Includes username, profile picture, syllabus URL, and all necessary columns

2. **`02_functions.sql`** - Run after base tables
   - Creates database functions for recommendation algorithm and interaction tracking

3. **`03_additional_tables.sql`** - Run after functions
   - Creates comment, interaction, follow, and poll tables

4. **`04_storage_policies.sql`** - Run after creating storage buckets
   - Sets up RLS policies for profile picture and syllabus storage
   - **Note**: Create `profile-pictures` and `course-syllabi` buckets in Supabase Dashboard → Storage first
   - `profile-pictures`: Public bucket for user profile pictures
   - `course-syllabi`: Public bucket for course syllabus PDFs (5MB file size limit recommended)

5. **`05_seed_sample_courses.sql`** - **Optional** - Adds 10 sample courses for testing

6. **`06_messages.sql`** - Run after additional tables
   - Creates messaging system tables for 1-on-1 conversations

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

### Core Features
- **User Authentication**: Google Sign-In via Supabase Auth
- **User Profiles**: Customizable usernames, profile pictures, and user ratings
- **PDF Upload**: Upload course PDFs and automatically generate study content
- **Content Generation**: AI-powered generation of quizzes, flashcards, sticky notes, and polls from PDFs
- **Manual Content Creation**: Create quizzes, flashcards, sticky notes, and polls manually
- **Feed System**: Algorithm-based or chronological feed of posts with sorting and filtering
- **Courses**: Subscribe to courses and organize your study materials
- **Course Syllabi**: Upload and manage course syllabi with collaborative approval system
  - Upload a syllabus for any course (requires subscription)
  - Replace existing syllabi through a voting system
  - Dynamic approval/rejection thresholds based on class size
  - AI-generated change summaries when syllabi are updated
- **Social Features**: Follow other users, comment on posts, like/dislike content
- **Messaging**: 1-on-1 direct messaging between users
- **Search**: Search for users by username or name

### Gamification
- **Learning Streaks**: Track daily learning streaks with leaderboards
- **Quiz Rush**: Timed quiz game with leaderboards
- **User Ratings**: Algorithm-based user rating system

### Content Types
- **Quizzes**: Multiple choice questions with AI-generated explanations
- **Flashcards**: Front/back cards for memorization
- **Sticky Notes**: Quick reminders and notes
- **Polls**: Opinion-based polls with voting and result tracking
- **Open Questions**: Free-form questions for discussion
- **Syllabus Replacements**: Proposals to replace course syllabi with voting and approval system

### Algorithm Features
- Personalized feed based on tag scores, user ratings, recency, and interaction history
- Per-user interaction tracking (likes, dislikes, view time, quiz answers, poll votes)
- Comment-based boosting (posts with more comments and replies are prioritized)
