import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";

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

interface PollItem {
  type: "poll";
  content: {
    question: string;
    options: string[];
  };
  suggested_topic_tags: string[];
}

type GeneratedContent = QuizItem | StickyNoteItem | FlashcardItem | OpenQuestionItem | PollItem;

export async function POST(request: NextRequest) {
  console.log("[upload-pdf] POST handler called");
  
  try {
    console.log("[upload-pdf] Creating Supabase client");
    const supabase = await createClient();

    // Check authentication
    console.log("[upload-pdf] Checking authentication");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[upload-pdf] Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[upload-pdf] User authenticated:", user.id);

    console.log("[upload-pdf] Parsing form data");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;

    console.log("[upload-pdf] Form data parsed - file:", file?.name, "courseId:", courseId);

    if (!file || !courseId) {
      console.error("[upload-pdf] Missing file or courseId");
      return NextResponse.json(
        { error: "File and courseId are required" },
        { status: 400 }
      );
    }

    // Fetch course name to prefix tags
    console.log("[upload-pdf] Fetching course data for:", courseId);
    const { data: courseData, error: courseError } = await supabase
      .from("course")
      .select("name")
      .eq("id", courseId)
      .single();

    if (courseError || !courseData) {
      console.error("[upload-pdf] Course not found:", courseError);
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    const courseName = courseData.name;
    console.log("[upload-pdf] Course found:", courseName);

    if (file.type !== "application/pdf") {
      console.error("[upload-pdf] Invalid file type:", file.type);
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Check file size (limit to 20MB for now - adjust as needed)
    const maxSize = 20 * 1024 * 1024; // 20MB
    console.log("[upload-pdf] File size:", file.size, "bytes");
    if (file.size > maxSize) {
      console.error("[upload-pdf] File too large:", file.size);
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // **CRITICAL FIX**: Read file into buffer first (File objects can only be read once)
    console.log("[upload-pdf] Reading file into buffer");
    let fileBuffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log("[upload-pdf] File read successfully, buffer size:", fileBuffer.length);
    } catch (fileReadError) {
      console.error("[upload-pdf] Error reading file:", fileReadError);
      if (fileReadError instanceof Error) {
        console.error("[upload-pdf] File read error message:", fileReadError.message);
        console.error("[upload-pdf] File read error stack:", fileReadError.stack);
      }
      return NextResponse.json(
        { error: "Error reading file" },
        { status: 500 }
      );
    }

    // Calculate hash from PDF buffer for tagging
    const pdfHash = createHash("sha256").update(fileBuffer).digest("hex");
    console.log("[upload-pdf] PDF hash calculated:", pdfHash.substring(0, 8) + "...");

    // Parse PDF to get page count for dynamic content generation
    let pdfPageCount = 1;
    try {
      const pdfParseModule = await import("pdf-parse");
      // @ts-expect-error - pdf-parse is callable but TypeScript types don't reflect this
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const pdfData = await pdfParse(fileBuffer);
      pdfPageCount = pdfData.numpages || 1;
      console.log("[upload-pdf] PDF page count:", pdfPageCount);
    } catch (parseError) {
      console.warn("[upload-pdf] Could not parse PDF for page count, using default:", parseError);
      // Continue with default page count of 1
    }

    // Calculate target number of items based on PDF size
    // Roughly 1-1.5 items per page, but scale appropriately
    // For small PDFs (1-5 pages): 5-10 items
    // For medium PDFs (6-20 pages): 10-25 items  
    // For large PDFs (21+ pages): 25-50 items (capped at 50)
    const targetItems = Math.min(
      Math.max(5, Math.round(pdfPageCount * 1.2)),
      50
    );

    // Distribute items across content types
    // 60% quizzes, 25% flashcards, 10% sticky notes, 5% polls
    const quizzes = Math.max(1, Math.round(targetItems * 0.6));
    const flashcards = Math.max(1, Math.round(targetItems * 0.25));
    const stickyNotes = Math.max(1, Math.round(targetItems * 0.1));
    const polls = Math.max(0, Math.min(2, Math.round(targetItems * 0.05)));

    // Generate quizzes/flashcards from PDF automatically
    let generatedContent: GeneratedContent[] = [];
    try {
      // Get Gemini API key
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        try {
          // Initialize Gemini
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
          });
          
          // Use the already-read buffer for base64 encoding (don't read file again)
          console.log("[upload-pdf] Converting buffer to base64 for Gemini");
          
          // Check file size before base64 encoding (base64 increases size by ~33%)
          // Gemini has limits on file size
          if (fileBuffer.length > 15 * 1024 * 1024) { // ~15MB limit before base64 encoding
            console.warn("[upload-pdf] PDF file is large, may cause issues with Gemini API");
            throw new Error("PDF file too large for Gemini API processing");
          }
          
          const base64Data = fileBuffer.toString("base64");
          console.log("[upload-pdf] Base64 conversion complete, size:", base64Data.length);

          // Create prompt for Gemini
          const prompt = `Given the contents of this PDF document (${pdfPageCount} pages), generate approximately ${targetItems} educational content items in JSON format.

Requirements (generate approximately ${targetItems} items total):
1. Generate ${stickyNotes} sticky-note-style notes: focus on random, interesting, or high-yield facts from the PDF that are useful for quick review.
2. Generate ${flashcards} flashcards: specific front-back style (question/answer) for active recall.
3. Generate ${quizzes} multiple-choice quizzes (MCQs): exactly 4 options with one correct answer.
4. Generate ${polls} opinion-based polls: ONLY if there are subjective topics suitable for preference-based questions. If not suitable, generate 0 polls.
5. All content must be directly derived from the PDF.

Poll Guidelines:
- Polls must be opinion-based (e.g., "Which do you prefer: X or Y?", "Who contributed more: A or B?", "Which approach do you find more intuitive?")
- DO NOT create polls for factual questions with correct answers (e.g., "What is 2+2?" or "What is the derivative of sin(x)?")
- Only generate polls if the PDF contains topics suitable for subjective discussion or preference-based questions
- If there's nothing suitable for opinion-based polling, generate 0 polls (it's okay to skip polls entirely)

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
  },
  {
    "type": "poll",
    "content": {
      "question": "Opinion-based question that asks for preference or subjective view?",
      "options": ["Option 1", "Option 2", "Option 3"]
    },
    "suggested_topic_tags": ["tag1"]
  }
]

Rules:
- correct_answer is the index (0-3) for quizzes only.
- Polls should have 2-4 options and ask for opinions/preferences, not factual answers.
- Return ONLY valid JSON, no markdown formatting or code blocks.

Generate the content now:`;

          // Call Gemini API with the PDF as inline base64 data
          console.log("[upload-pdf] Calling Gemini API");
          const result = await model.generateContent([
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data,
              },
            },
            { text: prompt },
          ]);
          console.log("[upload-pdf] Gemini API call completed");
          
          // Check if result is valid
          if (!result || !result.response) {
            console.error("[upload-pdf] Invalid response from Gemini API");
            throw new Error("Invalid response from Gemini API");
          }
          
          const response = result.response;
          console.log("[upload-pdf] Processing Gemini response");
          
          // Check for blocked content or errors in response
          if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.finishReason && candidate.finishReason !== "STOP") {
              console.warn(`[upload-pdf] Gemini finish reason: ${candidate.finishReason}`);
              if (candidate.finishReason === "SAFETY") {
                throw new Error("Content blocked by Gemini safety filters");
              }
              if (candidate.finishReason === "MAX_TOKENS") {
                throw new Error("Response too long from Gemini API");
              }
            }
            
            // Check for safety ratings that blocked content
            if (candidate.safetyRatings && candidate.safetyRatings.some((rating: any) => rating.blocked)) {
              console.error("[upload-pdf] Content blocked by safety ratings");
              throw new Error("Content blocked by Gemini safety ratings");
            }
          }
          
          console.log("[upload-pdf] Extracting text from Gemini response");
          const text = response.text();
          console.log("[upload-pdf] Response text length:", text.length);

          // Parse JSON response (remove markdown code blocks if present)
          console.log("[upload-pdf] Parsing JSON from Gemini response");
          let jsonText = text.trim();
          if (jsonText.startsWith("```json")) {
            jsonText = jsonText.replace(/^```json\n?/i, "").replace(/\n?```$/i, "");
          } else if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```\n?/i, "").replace(/\n?```$/i, "");
          }

          try {
            generatedContent = JSON.parse(jsonText);
            // Validate it's an array
            if (!Array.isArray(generatedContent)) {
              console.warn("[upload-pdf] Gemini returned non-array response, converting to array");
              generatedContent = [];
            } else {
              console.log("[upload-pdf] Successfully parsed JSON, items count:", generatedContent.length);
            }
          } catch (parseError) {
            console.error("[upload-pdf] JSON parsing error in Gemini response:", parseError);
            if (parseError instanceof Error) {
              console.error("[upload-pdf] Parse error message:", parseError.message);
              console.error("[upload-pdf] Parse error stack:", parseError.stack);
            }
            console.error("[upload-pdf] Raw response text (first 500 chars):", text.substring(0, 500));
            // Don't throw - continue without generated content
            generatedContent = [];
          }

            // Validate structure and filter valid items
            console.log("[upload-pdf] Validating generated content");
            if (Array.isArray(generatedContent)) {
              const validContent: GeneratedContent[] = [];
              
            // Validate each item
            for (const item of generatedContent) {
              if (item.type === "quiz") {
                const quiz = item as QuizItem;
                if (!quiz.content.question || !Array.isArray(quiz.content.options) || quiz.content.options.length !== 4) {
                  console.warn("[upload-pdf] Invalid quiz structure, skipping");
                  continue;
                }
                if (quiz.content.correct_answer < 0 || quiz.content.correct_answer > 3) {
                  console.warn("[upload-pdf] Invalid correct_answer index, skipping");
                  continue;
                }
              } else if (item.type === "sticky_note") {
                const note = item as StickyNoteItem;
                if (!note.content || !note.title) {
                  console.warn("[upload-pdf] Invalid sticky_note structure, skipping");
                  continue;
                }
              } else if (item.type === "flashcard") {
                const flashcard = item as FlashcardItem;
                if (!flashcard.content?.question || !flashcard.content?.answer) {
                  console.warn("[upload-pdf] Invalid flashcard structure, skipping");
                  continue;
                }
              } else if (item.type === "poll") {
                const poll = item as PollItem;
                if (!poll.content?.question || !Array.isArray(poll.content?.options) || poll.content.options.length < 2 || poll.content.options.length > 4) {
                  console.warn("[upload-pdf] Invalid poll structure, skipping");
                  continue;
                }
              } else if (item.type === "open_question") {
                // Open questions are valid but we handle them in the else block
                const openQ = item as OpenQuestionItem;
                if (!openQ.content?.question || !openQ.content?.answer) {
                  console.warn("[upload-pdf] Invalid open_question structure, skipping");
                  continue;
                }
              } else {
                console.warn(`[upload-pdf] Unknown content type: ${(item as any).type}, skipping`);
                continue;
              }
              
              // Ensure suggested_topic_tags exists
              if (!item.suggested_topic_tags) {
                item.suggested_topic_tags = [];
              }
              
              // If it passed validation, add it
              validContent.push(item);
            }

            // Save each valid item to the quiz table
            console.log("[upload-pdf] Saving", validContent.length, "items to quiz table");
            for (const item of validContent) {
              try {
              // Extract tags before saving (they'll be stored separately)
              const tags = item.suggested_topic_tags || [];
              
              // Add PDF hash as a tag
              tags.push(`pdf:${pdfHash}`);
              
              // Create a copy of the item without tags for the data column
              const { suggested_topic_tags, ...itemWithoutTags } = item;
              
              // Insert quiz into database with generated_from_pdf flag
              // likes and dislikes default to 0, created_at is set automatically
              const { data: insertedQuiz, error: quizInsertError } = await supabase
                .from("quiz")
                .insert({
                  data: itemWithoutTags,
                  likes: 0,
                  dislikes: 0,
                  course_id: courseId,
                  user_id: user.id,
                  generated_from_pdf: true, // Track that this quiz was generated from a PDF
                })
                .select("id")
                .single();

              if (quizInsertError || !insertedQuiz) {
                console.error("Error saving quiz/flashcard to database:", quizInsertError);
                // Continue with other items even if one fails
                continue;
              }

              // Save tags to tag and quiz_tag tables
              if (tags.length > 0) {
                for (const tagName of tags) {
                  if (!tagName || typeof tagName !== 'string') continue;
                  
                  // Prefix tag with course name (skip if it's a PDF hash tag)
                  const isPdfHash = tagName.startsWith("pdf:");
                  const prefixedTagName = isPdfHash ? tagName : `${courseName}: ${tagName}`;
                  
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

                  if (quizTagError) {
                    // Ignore duplicate key errors (tag already associated with quiz)
                    const isDuplicate = quizTagError.code === "23505" || 
                                       quizTagError.message?.toLowerCase().includes("duplicate") ||
                                       quizTagError.message?.toLowerCase().includes("unique");
                    if (!isDuplicate) {
                      console.error(`Error linking tag "${prefixedTagName}" to quiz:`, quizTagError);
                    }
                  }
                }
              }
              } catch (insertError) {
                console.error("[upload-pdf] Error inserting quiz item:", insertError);
                // Continue with other items
              }
            }
            
            // Update generatedContent to only include valid items
            generatedContent = validContent;
            console.log("[upload-pdf] Content validation complete, valid items:", generatedContent.length);
          }
        } catch (geminiError) {
          // Log detailed error information
          console.error("[upload-pdf] Gemini API error:", geminiError);
          if (geminiError instanceof Error) {
            console.error("[upload-pdf] Error message:", geminiError.message);
            console.error("[upload-pdf] Error stack:", geminiError.stack);
          } else if (typeof geminiError === 'object' && geminiError !== null) {
            // Handle Gemini API error objects
            const errorObj = geminiError as { message?: string; status?: number; statusText?: string };
            console.error("[upload-pdf] Gemini error details:", {
              message: errorObj.message,
              status: errorObj.status,
              statusText: errorObj.statusText,
            });
          }
          // Don't throw - continue without generated content
          // The PDF upload should still succeed even if content generation fails
          generatedContent = [];
        }
      } else {
        console.warn("[upload-pdf] GEMINI_API_KEY not configured, skipping content generation");
      }
    } catch (genError) {
      // Don't fail the upload if content generation fails
      console.error("[upload-pdf] Error generating content from PDF:", genError);
      if (genError instanceof Error) {
        console.error("[upload-pdf] Error message:", genError.message);
        console.error("[upload-pdf] Error stack:", genError.stack);
      } else {
        console.error("[upload-pdf] Unknown error type:", typeof genError, genError);
      }
      // Continue and return success for the upload
    }

    console.log("[upload-pdf] Upload complete, returning response");

    return NextResponse.json(
      { 
        success: true, 
        generated_content_count: generatedContent.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[upload-pdf] CRITICAL ERROR in upload route:", error);
    console.error("[upload-pdf] Error type:", typeof error);
    console.error("[upload-pdf] Error constructor:", error?.constructor?.name);
    
    if (error instanceof Error) {
      console.error("[upload-pdf] Error message:", error.message);
      console.error("[upload-pdf] Error stack:", error.stack);
      // Return more specific error message
      return NextResponse.json(
        { 
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.message : undefined
        },
        { status: 500 }
      );
    } else if (error !== null && typeof error === "object") {
      // Try to extract any useful information from error object
      const errorObj = error as { message?: string; code?: string; name?: string };
      console.error("[upload-pdf] Error object details:", {
        message: errorObj.message,
        code: errorObj.code,
        name: errorObj.name,
        keys: Object.keys(errorObj),
      });
      return NextResponse.json(
        { 
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? (errorObj.message || JSON.stringify(errorObj)) : undefined
        },
        { status: 500 }
      );
    } else {
      console.error("[upload-pdf] Unknown error value:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
}
