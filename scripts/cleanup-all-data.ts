import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function cleanupAllData() {
  console.log('🧹 Starting FULL cleanup of all data...\n');
  console.log('⚠️  WARNING: This will delete EVERYTHING including users, courses, and tags!\n');

  try {
    // 1. Delete all messages (must delete before conversations due to foreign key)
    console.log('Deleting messages...');
    const { error: messagesError } = await supabase
      .from('message')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
    } else {
      console.log('✅ Messages deleted');
    }

    // 2. Delete all conversations
    console.log('Deleting conversations...');
    const { error: conversationsError } = await supabase
      .from('conversation')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (conversationsError) {
      console.error('Error deleting conversations:', conversationsError);
    } else {
      console.log('✅ Conversations deleted');
    }

    // 3. Delete all comment likes
    console.log('Deleting comment likes...');
    const { error: commentLikesError } = await supabase
      .from('comment_like')
      .delete()
      .neq('comment_id', '00000000-0000-0000-0000-000000000000');
    
    if (commentLikesError) {
      console.error('Error deleting comment likes:', commentLikesError);
    } else {
      console.log('✅ Comment likes deleted');
    }

    // 4. Delete all comments
    console.log('Deleting comments...');
    const { error: commentsError } = await supabase
      .from('comment')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (commentsError) {
      console.error('Error deleting comments:', commentsError);
    } else {
      console.log('✅ Comments deleted');
    }

    // 5. Delete all poll votes
    console.log('Deleting poll votes...');
    const { error: pollVotesError } = await supabase
      .from('poll_vote')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (pollVotesError) {
      console.error('Error deleting poll votes:', pollVotesError);
    } else {
      console.log('✅ Poll votes deleted');
    }

    // 6. Delete all quiz interactions
    console.log('Deleting quiz interactions...');
    const { error: interactionsError } = await supabase
      .from('quiz_interaction')
      .delete()
      .neq('quiz_id', '00000000-0000-0000-0000-000000000000');
    
    if (interactionsError) {
      console.error('Error deleting quiz interactions:', interactionsError);
    } else {
      console.log('✅ Quiz interactions deleted');
    }

    // 7. Delete all quiz_tag relationships
    console.log('Deleting quiz-tag relationships...');
    const { error: quizTagError } = await supabase
      .from('quiz_tag')
      .delete()
      .neq('quiz_id', '00000000-0000-0000-0000-000000000000');
    
    if (quizTagError) {
      console.error('Error deleting quiz-tag relationships:', quizTagError);
    } else {
      console.log('✅ Quiz-tag relationships deleted');
    }

    // 8. Delete all quizzes/posts
    console.log('Deleting quizzes/posts...');
    const { error: quizzesError } = await supabase
      .from('quiz')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (quizzesError) {
      console.error('Error deleting quizzes:', quizzesError);
    } else {
      console.log('✅ Quizzes/posts deleted');
    }

    // 9. Delete all follows
    console.log('Deleting follow relationships...');
    const { error: followsError } = await supabase
      .from('follow')
      .delete()
      .neq('follower_id', '00000000-0000-0000-0000-000000000000');
    
    if (followsError) {
      console.error('Error deleting follows:', followsError);
    } else {
      console.log('✅ Follow relationships deleted');
    }

    // 10. Delete all course subscriptions
    console.log('Deleting course subscriptions...');
    const { error: subscriptionsError } = await supabase
      .from('course_subscription')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000');
    
    if (subscriptionsError) {
      console.error('Error deleting subscriptions:', subscriptionsError);
    } else {
      console.log('✅ Course subscriptions deleted');
    }

    // 11. Delete all tags
    console.log('Deleting tags...');
    const { error: tagsError } = await supabase
      .from('tag')
      .delete()
      .neq('id', 0);
    
    if (tagsError) {
      console.error('Error deleting tags:', tagsError);
    } else {
      console.log('✅ Tags deleted');
    }

    // 12. Delete all courses
    console.log('Deleting courses...');
    const { error: coursesError } = await supabase
      .from('course')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (coursesError) {
      console.error('Error deleting courses:', coursesError);
    } else {
      console.log('✅ Courses deleted');
    }

    // 13. Clear profile pictures from storage
    console.log('Deleting profile pictures from storage...');
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('profile-pictures')
        .list('', {
          limit: 1000,
          offset: 0,
        });

      if (listError) {
        console.error('Error listing profile pictures:', listError);
      } else if (files && files.length > 0) {
        const filePaths = files.map(file => file.name);
        const { error: deleteError } = await supabase.storage
          .from('profile-pictures')
          .remove(filePaths);
        
        if (deleteError) {
          console.error('Error deleting profile pictures:', deleteError);
        } else {
          console.log(`✅ Deleted ${filePaths.length} profile picture(s)`);
        }
      } else {
        console.log('✅ No profile pictures to delete');
      }
    } catch (error) {
      console.error('Error deleting profile pictures:', error);
    }

    // 14. Clear syllabi from storage
    console.log('Deleting syllabi from storage...');
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('course-syllabi')
        .list('', {
          limit: 1000,
          offset: 0,
        });

      if (listError) {
        console.error('Error listing syllabi:', listError);
      } else if (files && files.length > 0) {
        const filePaths = files.map(file => file.name);
        const { error: deleteError } = await supabase.storage
          .from('course-syllabi')
          .remove(filePaths);
        
        if (deleteError) {
          console.error('Error deleting syllabi:', deleteError);
        } else {
          console.log(`✅ Deleted ${filePaths.length} syllabus/syllabi`);
        }
      } else {
        console.log('✅ No syllabi to delete');
      }
    } catch (error) {
      console.error('Error deleting syllabi:', error);
    }

    // 15. Delete all profiles
    console.log('Deleting user profiles...');
    const { error: profilesError } = await supabase
      .from('profile')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (profilesError) {
      console.error('Error deleting profiles:', profilesError);
    } else {
      console.log('✅ User profiles deleted');
    }

    // 16. Delete all user accounts (using admin API)
    console.log('Deleting user accounts...');
    try {
      // Get all users
      const { data: { users }, error: listUsersError } = await supabase.auth.admin.listUsers();
      
      if (listUsersError) {
        console.error('Error listing users:', listUsersError);
      } else if (users && users.length > 0) {
        // Delete each user
        for (const user of users) {
          const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
          if (deleteUserError) {
            console.error(`Error deleting user ${user.id}:`, deleteUserError);
          }
        }
        console.log(`✅ Deleted ${users.length} user account(s)`);
      } else {
        console.log('✅ No user accounts to delete');
      }
    } catch (error) {
      console.error('Error deleting user accounts:', error);
    }

    console.log('\n✨ Full cleanup complete!');
    console.log('\n⚠️  All data has been deleted:');
    console.log('   - Posts, comments, follows, subscriptions');
    console.log('   - Profile pictures and syllabi');
    console.log('   - Tags and courses');
    console.log('   - User profiles and accounts');
    console.log('\nYour database is now completely empty.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupAllData();
