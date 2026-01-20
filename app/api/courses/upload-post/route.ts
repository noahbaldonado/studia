import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, postData } = body;

    if (!courseId || !postData) {
      return NextResponse.json(
        { error: "courseId and postData are required" },
        { status: 400 }
      );
    }

    // Fetch course name to prefix tags
    const { data: courseData, error: courseError } = await supabase
      .from("course")
      .select("name")
      .eq("id", courseId)
      .single();

    if (courseError || !courseData) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Check if user is subscribed to the course
    const { data: subscription, error: subError } = await supabase
      .from("course_subscription")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "You must be subscribed to this course to upload posts" },
        { status: 403 }
      );
    }

    const courseName = courseData.name;

    // Get Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Generate tags using Gemini
    let tags: string[] = [];
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Create prompt based on post type
      let contentForTagging = "";
      if (postData.type === "quiz") {
        contentForTagging = `Title: ${postData.title}\nQuestion: ${postData.content.question}\nOptions: ${postData.content.options.join(", ")}`;
      } else if (postData.type === "flashcard") {
        contentForTagging = `Question: ${postData.content.question}\nAnswer: ${postData.content.answer}`;
      } else if (postData.type === "sticky_note") {
        contentForTagging = `Title: ${postData.title}\nContent: ${postData.content}`;
      } else if (postData.type === "poll") {
        contentForTagging = `Question: ${postData.content.question}\nOptions: ${postData.content.options.join(", ")}`;
      }

      const tagPrompt = `Given the following educational content, generate 3-5 relevant topic tags. Return ONLY a JSON array of tag strings, no other text.

Content:
${contentForTagging}

Example output: ["biology", "cell-structure", "mitochondria"]

Generate tags now:`;

      const result = await model.generateContent(tagPrompt);
      const response = await result.response;
      const text = response.text().trim();

      // Parse JSON array from response
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonText = jsonMatch ? jsonMatch[0] : text;
        tags = JSON.parse(jsonText);
        if (!Array.isArray(tags)) {
          tags = [];
        }
      } catch (parseError) {
        console.error("Error parsing tags from Gemini:", parseError);
        // Continue without tags if parsing fails
        tags = [];
      }
    } catch (geminiError: unknown) {
      const error = geminiError as { message?: string };
      console.error("Error generating tags with Gemini:", error.message || geminiError);
      // Continue without tags if Gemini fails
      tags = [];
    }

    // Create a copy of postData without tags for the data column
    const { suggested_topic_tags, ...postDataWithoutTags } = postData;

    // Insert post into quiz table
    // likes and dislikes default to 0, created_at is set automatically
    const { data: insertedQuiz, error: quizInsertError } = await supabase
      .from("quiz")
      .insert({
        data: postDataWithoutTags,
        likes: 0,
        dislikes: 0,
        course_id: courseId,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (quizInsertError || !insertedQuiz) {
      console.error("Error saving post to database:", quizInsertError);
      return NextResponse.json(
        { error: "Failed to save post to database" },
        { status: 500 }
      );
    }

    // Save tags to tag and quiz_tag tables
    if (tags.length > 0) {
      for (const tagName of tags) {
        if (!tagName || typeof tagName !== "string") continue;

        // Prefix tag with course name
        const prefixedTagName = `${courseName}: ${tagName}`;

        // Get or create tag
        let tagData: { id: number } | null = null;

        // First, try to get existing tag
        const { data: existingTag } = await supabase
          .from("tag")
          .select("id")
          .eq("name", prefixedTagName)
          .single();

        if (existingTag) {
          tagData = existingTag;
        } else {
          // Tag doesn't exist, insert it
          const { data: newTag, error: insertError } = await supabase
            .from("tag")
            .insert({ name: prefixedTagName })
            .select("id")
            .single();

          if (insertError || !newTag) {
            console.error(`Error inserting tag "${prefixedTagName}":`, insertError);
            continue;
          }
          tagData = newTag;
        }

        // Insert into quiz_tag join table (ignore if already exists)
        const { error: quizTagError } = await supabase
          .from("quiz_tag")
          .insert({
            quiz_id: insertedQuiz.id,
            tag_id: tagData.id,
          });

        if (quizTagError && quizTagError.code !== "23505") {
          // Ignore duplicate key errors (23505 = unique violation)
          console.error(`Error inserting quiz_tag for tag "${prefixedTagName}":`, quizTagError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      quizId: insertedQuiz.id,
      tagsGenerated: tags.length,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Error in upload-post route:", err.message || error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
