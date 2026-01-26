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

interface CourseData {
  name: string;
  subject: string;
  professor: string;
  quarter: string;
  course_link?: string;
}

async function importCoursesFromJson(jsonFilePath: string) {
  console.log(`📂 Reading courses from ${jsonFilePath}...\n`);

  let courses: CourseData[];
  try {
    const fileContent = readFileSync(jsonFilePath, 'utf-8');
    courses = JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Error reading JSON file: ${error}`);
    process.exit(1);
  }

  if (!Array.isArray(courses)) {
    console.error('❌ JSON file must contain an array of courses');
    process.exit(1);
  }

  if (courses.length === 0) {
    console.log('⚠️  No courses found in JSON file');
    return;
  }

  console.log(`💾 Importing ${courses.length} courses into database...\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const course of courses) {
    try {
      // Validate required fields
      if (!course.name || !course.subject || !course.professor || !course.quarter) {
        console.error(`⚠️  Skipping course with missing fields: ${JSON.stringify(course)}`);
        skipped++;
        continue;
      }

      // Check if course already exists (by name, professor, and quarter)
      const { data: existing } = await supabase
        .from('course')
        .select('id')
        .eq('name', course.name)
        .eq('professor', course.professor)
        .eq('quarter', course.quarter)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert new course
      const { error } = await supabase
        .from('course')
        .insert({
          name: course.name,
          subject: course.subject,
          professor: course.professor,
          quarter: course.quarter,
          course_link: course.course_link || null,
        });

      if (error) {
        console.error(`❌ Error inserting "${course.name}":`, error.message);
        errors++;
      } else {
        inserted++;
        if (inserted % 10 === 0) {
          process.stdout.write(`   Inserted ${inserted} courses...\r`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing "${course.name}":`, error);
      errors++;
    }
  }

  console.log('\n');
  console.log('✨ Course import complete!');
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
}

// Get JSON file path from command line argument or use default
const jsonFilePath = process.argv[2] || 'ucsc_courses.json';

importCoursesFromJson(jsonFilePath).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
