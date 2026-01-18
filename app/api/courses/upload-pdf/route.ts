import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface QuizItem {
  type: "quiz";
  title: string;
  content: {
    question: string;
    options: string[];
    correct_answer: number;
  };
  suggested_topic_tags: string[];
}

interface StickyNoteItem {
  type: "sticky_note";
  title: string;
  content: string;
  suggested_topic_tags: string[];
}

interface FlashcardItem {
  type: "flashcard";
  content: {
    question: string;
    answer: string;
  };
  suggested_topic_tags: string[];
}

interface OpenQuestionItem {
  type: "open_question";
  content: {
    question: string;
    answer: string;
  };
  suggested_topic_tags: string[];
}

type GeneratedContent = QuizItem | StickyNoteItem | FlashcardItem | OpenQuestionItem;

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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;

    if (!file || !courseId) {
      return NextResponse.json(
        { error: "File and courseId are required" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${courseId}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("course-pdfs")
      .upload(filePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Check if bucket doesn't exist
      if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("The resource was not found")) {
        return NextResponse.json(
          { error: "The 'course-pdfs' bucket does not exist. Create the bucket in Supabase Storage." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Error uploading file: ${uploadError.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Save metadata to database
    const { data: dbData, error: dbError } = await supabase
      .from("course_pdfs")
      .insert({
        course_id: courseId,
        name: file.name,
        file_path: filePath,
        user_id: user.id,
      })
      .select()
      .single();

    if (dbError) {
      // If database insert fails, try to remove the uploaded file
      await supabase.storage.from("course-pdfs").remove([filePath]);
      console.error("Database insert error:", dbError);
      return NextResponse.json(
        { error: "Error saving metadata" },
        { status: 500 }
      );
    }

    // Generate quizzes/flashcards from PDF automatically
    let generatedContent: GeneratedContent[] = [];
    try {
      // Get Gemini API key
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash",
        });
        
        // Convert PDF to base64 for inline upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString("base64");

        // Create prompt for Gemini
        const prompt = `Given the contents of this PDF document, generate educational content in JSON format.

Requirements:
1. Generate 2-3 sticky-note-style notes: focus on random, interesting, or high-yield facts from the PDF that are useful for quick review.
2. Generate 2-3 flashcards: specific front-back style (question/answer) for active recall.
3. Generate 1-5 multiple-choice quizzes (MCQs): exactly 4 options with one correct answer.
4. Generate 2 open questions: broader conceptual questions that require a detailed answer.
5. All content must be directly derived from the PDF.

Output format (JSON array):
[
  {
    "type": "sticky_note",
    "title": "Insight Title",
    "content": "Concise interesting fact or summary",
    "suggested_topic_tags": ["tag1"]
  },
  {
    "type": "flashcard",
    "content": {
      "question": "Short active recall question?",
      "answer": "Direct concise answer"
    },
    "suggested_topic_tags": ["tag1"]
  },
  {
    "type": "quiz",
    "title": "Topic Title",
    "content": {
      "question": "The MCQ text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 0
    },
    "suggested_topic_tags": ["tag1"]
  },
  {
    "type": "open_question",
    "content": {
      "question": "Conceptual or descriptive question?",
      "answer": "Detailed explanatory answer"
    },
    "suggested_topic_tags": ["tag1"]
  }
]

Rules:
- correct_answer is the index (0-3).
- Ensure a clear distinction between flashcards (brief) and open questions (more complex).
- Return ONLY valid JSON, no markdown formatting or code blocks.

Generate the content now:`;

        // Call Gemini API with the PDF as inline base64 data
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          { text: prompt },
        ]);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response (remove markdown code blocks if present)
        let jsonText = text.trim();
        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.replace(/^```json\n?/i, "").replace(/\n?```$/i, "");
        } else if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```\n?/i, "").replace(/\n?```$/i, "");
        }

        generatedContent = JSON.parse(jsonText);

        // Get PDF UUID to add to tags
        const pdfId = dbData.id;

        // Validate structure and filter valid items
        if (Array.isArray(generatedContent)) {
          const validContent: GeneratedContent[] = [];
          
          // Validate each item and add PDF ID to tags
          for (const item of generatedContent) {
            if (item.type === "quiz") {
              const quiz = item as QuizItem;
              if (!quiz.content.question || !Array.isArray(quiz.content.options) || quiz.content.options.length !== 4) {
                console.warn("Invalid quiz structure, skipping");
                continue;
              }
              if (quiz.content.correct_answer < 0 || quiz.content.correct_answer > 3) {
                console.warn("Invalid correct_answer index, skipping");
                continue;
              }
            } else if (item.type === "sticky_note") {
              const note = item as StickyNoteItem;
              if (!note.content || !note.title) {
                console.warn("Invalid sticky_note structure, skipping");
                continue;
              }
            } else if (item.type === "flashcard") {
              const flashcard = item as FlashcardItem;
              if (!flashcard.content?.question || !flashcard.content?.answer) {
                console.warn("Invalid flashcard structure, skipping");
                continue;
              }
            } else if (item.type === "open_question") {
              const openQuestion = item as OpenQuestionItem;
              if (!openQuestion.content?.question || !openQuestion.content?.answer) {
                console.warn("Invalid open_question structure, skipping");
                continue;
              }
            } else {
              console.warn(`Unknown content type: ${(item as any).type}, skipping`);
              continue;
            }
            
            // Add PDF ID to suggested_topic_tags if not already present
            if (!item.suggested_topic_tags) {
              item.suggested_topic_tags = [];
            }
            if (!item.suggested_topic_tags.includes(pdfId)) {
              item.suggested_topic_tags.push(pdfId);
            }
            
            // If it passed validation, add it
            validContent.push(item);
          }

          // Get user rating from profile table
          const { data: profileData } = await supabase
            .from("profile")
            .select("rating")
            .eq("id", user.id)
            .single();

          const userRating = profileData?.rating || 7.5;

          // Save each valid item to the quiz table
          for (const item of validContent) {
            try {
              const { error: quizInsertError } = await supabase
                .from("quiz")
                .insert({
                  data: item,
                  rating: userRating,
                  course_id: courseId,
                  user_id: user.id,
                });

              if (quizInsertError) {
                console.error("Error saving quiz/flashcard to database:", quizInsertError);
                // Continue with other items even if one fails
              }
            } catch (insertError) {
              console.error("Error inserting quiz item:", insertError);
              // Continue with other items
            }
          }
          
          // Update generatedContent to only include valid items
          generatedContent = validContent;
        }
      } else {
        console.warn("GEMINI_API_KEY not configured, skipping content generation");
      }
    } catch (genError) {
      // Don't fail the upload if content generation fails
      console.error("Error generating content from PDF:", genError);
      // Continue and return success for the upload
    }

    return NextResponse.json(
      { 
        success: true, 
        data: dbData,
        generated_content_count: generatedContent.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
