import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface QuizItem {
  type: "quiz";
  title: string;
  content: {
    question: string;
    options: string[];
    correct_answer: number; // Index of correct option (0-3)
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

    const body = await request.json();
    const { pdfId } = body;

    if (!pdfId) {
      return NextResponse.json(
        { error: "PDF ID is required" },
        { status: 400 }
      );
    }

    // Get PDF metadata from database
    const { data: pdfMetadata, error: metadataError } = await supabase
      .from("course_pdfs")
      .select("id, name, file_path, course_id")
      .eq("id", pdfId)
      .single();

    if (metadataError || !pdfMetadata) {
      return NextResponse.json(
        { error: "PDF not found" },
        { status: 404 }
      );
    }

    // Download PDF from Supabase Storage
    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from("course-pdfs")
      .download(pdfMetadata.file_path);

    if (downloadError || !pdfFile) {
      console.error("Storage download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to download PDF" },
        { status: 500 }
      );
    }

    // Extract text and page count from PDF
    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let pdfText: string;
    let pdfPageCount: number;
    
    try {
      // Dynamic import for pdf-parse (ESM module)
      const pdfParseModule = await import("pdf-parse");
      // @ts-expect-error - pdf-parse is callable but TypeScript types don't reflect this
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const pdfData = await pdfParse(buffer);
      pdfText = pdfData.text;
      pdfPageCount = pdfData.numpages || 1;
      
      if (!pdfText || pdfText.trim().length === 0) {
        return NextResponse.json(
          { error: "PDF contains no extractable text. Please ensure the PDF has text content." },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error("PDF parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to extract text from PDF" },
        { status: 500 }
      );
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

    // Get Gemini API key from environment
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Initialize Gemini 2.5 Flash
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Create prompt for Gemini
    const prompt = `Given the contents of the following PDF (${pdfPageCount} pages), generate approximately ${targetItems} educational content items in JSON format.

PDF Content:
${pdfText.substring(0, 50000)} ${pdfText.length > 50000 ? "...[truncated]" : ""}

Requirements (generate approximately ${targetItems} items total):
1. Generate ${stickyNotes} sticky-note-style notes: focus on random, interesting, or high-yield facts from the PDF that are useful for quick review.
2. Generate ${flashcards} flashcards: specific front-back style (question/answer) for active recall.
3. Generate ${quizzes} multiple-choice quizzes (MCQs): exactly 4 options with one correct answer.
4. Generate ${polls} opinion-based polls: ONLY if there are subjective topics suitable for preference-based questions. If not suitable, generate 0 polls.
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
- Polls should have 2-5 options and ask for opinions/preferences, not factual answers.
- Return ONLY valid JSON, no markdown formatting or code blocks.

Generate the content now:`;

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response (remove markdown code blocks if present)
    let jsonText = text.trim();
    // Remove markdown code blocks if present
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n?/i, "").replace(/\n?```$/i, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n?/i, "").replace(/\n?```$/i, "");
    }

    let generatedContent: GeneratedContent[];
    try {
      generatedContent = JSON.parse(jsonText);
      
      // Validate structure
      if (!Array.isArray(generatedContent)) {
        throw new Error("Response is not an array");
      }
      
      // Validate each item
      for (const item of generatedContent) {
        const itemType = (item as any).type;
        if (!itemType) {
          throw new Error("Item missing type");
        }
        const validTypes = ["quiz", "sticky_note", "flashcard", "poll", "open_question"];
        if (!validTypes.includes(itemType)) {
          throw new Error(`Invalid type: ${itemType}`);
        }
        if (item.type === "quiz") {
          const quiz = item as QuizItem;
          if (!quiz.content.question || !Array.isArray(quiz.content.options) || quiz.content.options.length !== 4) {
            throw new Error("Invalid quiz structure");
          }
          if (quiz.content.correct_answer < 0 || quiz.content.correct_answer > 3) {
            throw new Error("Invalid correct_answer index");
          }
        }
        if (item.type === "sticky_note") {
          const note = item as StickyNoteItem;
          if (!note.content) {
            throw new Error("Sticky note missing content");
          }
        }
        if (item.type === "flashcard") {
          const flashcard = item as FlashcardItem;
          if (!flashcard.content.question || !flashcard.content.answer) {
            throw new Error("Flashcard missing question or answer");
          }
        }
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw response:", text);
      return NextResponse.json(
        { 
          error: "Failed to parse Gemini response",
          details: parseError instanceof Error ? parseError.message : "Unknown error",
          raw_response: text.substring(0, 500)
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        data: generatedContent,
        pdf_name: pdfMetadata.name,
        pdf_id: pdfId
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Generate content error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
