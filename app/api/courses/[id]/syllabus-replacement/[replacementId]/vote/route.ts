import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Calculate dynamic approval threshold based on class size and existing syllabus
function calculateApprovalThreshold(
  hasExistingSyllabus: boolean,
  classSize: number
): number {
  if (!hasExistingSyllabus) {
    return 0;
  } else if (classSize <= 3) {
    return 0;
  } else if (classSize <= 5) {
    return 1;
  } else if (classSize <= 10) {
    return 2;
  } else if (classSize <= 20) {
    return 3;
  } else {
    return Math.min(Math.ceil(classSize / 5), 10);
  }
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; replacementId: string }>;
  }
) {
  try {
    const supabase = await createClient();
    const { id: courseId, replacementId } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { voteType } = body; // 'approve' or 'reject'

    if (!voteType || !["approve", "reject"].includes(voteType)) {
      return NextResponse.json(
        { error: "Invalid vote type. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get the quiz entry (syllabus replacement)
    const { data: quiz, error: quizError } = await supabase
      .from("quiz")
      .select("id, data, user_id, course_id, likes, dislikes")
      .eq("id", replacementId)
      .eq("course_id", courseId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Syllabus replacement not found" },
        { status: 404 }
      );
    }

    const quizData = quiz.data as any;
    if (quizData?.type !== "syllabus_replacement") {
      return NextResponse.json(
        { error: "Not a syllabus replacement" },
        { status: 400 }
      );
    }

    if (quizData.content.status !== "pending") {
      return NextResponse.json(
        { error: "This proposal has already been finalized" },
        { status: 400 }
      );
    }

    // Prevent users from voting on their own proposals
    if (quiz.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot vote on your own proposal" },
        { status: 403 }
      );
    }

    // Calculate dynamic approval threshold
    const { data: course } = await supabase
      .from("course")
      .select("syllabus_url, name")
      .eq("id", courseId)
      .single();

    const { count: subscriberCount } = await supabase
      .from("course_subscription")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId);

    const classSize = subscriberCount || 0;
    const hasExistingSyllabus = !!course?.syllabus_url;
    const APPROVAL_THRESHOLD = calculateApprovalThreshold(hasExistingSyllabus, classSize);
    const REJECTION_THRESHOLD = APPROVAL_THRESHOLD === 0 ? 1 : APPROVAL_THRESHOLD;

    // Check if user already voted (using quiz_interaction)
    const { data: existingInteraction } = await supabase
      .from("quiz_interaction")
      .select("id, is_like")
      .eq("quiz_id", replacementId)
      .eq("user_id", user.id)
      .maybeSingle();

    const isLike = voteType === "approve";
    let newLikes = quiz.likes || 0;
    let newDislikes = quiz.dislikes || 0;

    if (existingInteraction) {
      // User already voted - update or remove vote
      if (existingInteraction.is_like === isLike) {
        // Toggle off: remove vote
        await supabase
          .from("quiz_interaction")
          .delete()
          .eq("id", existingInteraction.id);
        
        if (isLike) {
          newLikes = Math.max(0, newLikes - 1);
        } else {
          newDislikes = Math.max(0, newDislikes - 1);
        }
      } else {
        // Change vote: update interaction and adjust counts
        await supabase
          .from("quiz_interaction")
          .update({ is_like: isLike })
          .eq("id", existingInteraction.id);
        
        if (isLike) {
          // Was dislike, now like
          newLikes = (newLikes || 0) + 1;
          newDislikes = Math.max(0, (newDislikes || 0) - 1);
        } else {
          // Was like, now dislike
          newDislikes = (newDislikes || 0) + 1;
          newLikes = Math.max(0, (newLikes || 0) - 1);
        }
      }
    } else {
      // New vote: create interaction
      await supabase
        .from("quiz_interaction")
        .insert({
          quiz_id: replacementId,
          user_id: user.id,
          is_like: isLike,
          interaction_score: 10, // Max score for voting
        });
      
      if (isLike) {
        newLikes = (newLikes || 0) + 1;
      } else {
        newDislikes = (newDislikes || 0) + 1;
      }
    }

    // Use admin client to bypass RLS for quiz updates
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update quiz likes/dislikes
    console.log("[vote] Updating quiz with likes:", newLikes, "dislikes:", newDislikes);
    const { error: updateLikesError } = await supabaseAdmin
      .from("quiz")
      .update({
        likes: newLikes,
        dislikes: newDislikes,
      })
      .eq("id", replacementId);

    if (updateLikesError) {
      console.error("[vote] Error updating quiz likes/dislikes:", updateLikesError);
      return NextResponse.json(
        { error: "Failed to update vote counts" },
        { status: 500 }
      );
    }

    console.log("[vote] Successfully updated quiz likes/dislikes");

    // Check if threshold is met
    let newStatus = "pending";
    let changeSummary = quizData.content.change_summary || null;

    if (newLikes >= APPROVAL_THRESHOLD) {
      newStatus = "approved";
      
      // Generate change summary if there's an existing syllabus
      if (hasExistingSyllabus && course?.syllabus_url) {
        try {
          const geminiApiKey = process.env.GEMINI_API_KEY;
          if (geminiApiKey) {
            const oldPath = course.syllabus_url.split("/course-syllabi/")[1];
            const newPath = quizData.content.new_syllabus_url.split("/course-syllabi/")[1];

            const [oldPdfData, newPdfData] = await Promise.all([
              supabase.storage.from("course-syllabi").download(oldPath),
              supabase.storage.from("course-syllabi").download(newPath),
            ]);

            if (oldPdfData.data && newPdfData.data) {
              // Parse both PDFs
              const pdfParseModule = await import("pdf-parse");
              const pdfParse = (pdfParseModule as any).default || pdfParseModule;

              const oldArrayBuffer = await oldPdfData.data.arrayBuffer();
              const oldBuffer = Buffer.from(oldArrayBuffer);
              const oldPdf = await pdfParse(oldBuffer);

              const newArrayBuffer = await newPdfData.data.arrayBuffer();
              const newBuffer = Buffer.from(newArrayBuffer);
              const newPdf = await pdfParse(newBuffer);

              const genAI = new GoogleGenerativeAI(geminiApiKey);
              const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

              const comparisonPrompt = `Compare these two course syllabi and provide a concise summary of the key changes. Focus on:
1. Major changes to course structure, topics, or schedule
2. Changes to assignments, exams, or grading policies
3. Changes to prerequisites or course requirements
4. Any other significant modifications

Old Syllabus:
${oldPdf.text.substring(0, 8000)}${oldPdf.text.length > 8000 ? "..." : ""}

New Syllabus:
${newPdf.text.substring(0, 8000)}${newPdf.text.length > 8000 ? "..." : ""}

Provide a brief summary (2-3 sentences) of the key changes:`;

              const result = await model.generateContent(comparisonPrompt);
              const response = await result.response;
              const summary = response.text().trim();
              changeSummary = `Syllabus has been updated. ${summary}`;
            }
          }
        } catch (error) {
          console.error("Error generating change summary:", error);
        }
      }

      await supabaseAdmin
        .from("course")
        .update({ syllabus_url: quizData.content.new_syllabus_url })
        .eq("id", courseId);
    } else if (newDislikes >= REJECTION_THRESHOLD) {
      newStatus = "rejected";
    }

    // Update quiz data with new status (if status changed) - combine with likes/dislikes update
    if (newStatus !== "pending") {
      const updatedData = {
        ...quizData,
        content: {
          ...quizData.content,
          status: newStatus,
          change_summary: changeSummary,
        },
      };

      console.log("[vote] Updating quiz status to:", newStatus, "with likes:", newLikes, "dislikes:", newDislikes);
      const { error: updateStatusError } = await supabaseAdmin
        .from("quiz")
        .update({ 
          data: updatedData,
          likes: newLikes,
          dislikes: newDislikes,
        })
        .eq("id", replacementId);

      if (updateStatusError) {
        console.error("[vote] Error updating quiz status:", updateStatusError);
        return NextResponse.json(
          { error: "Failed to update proposal status" },
          { status: 500 }
        );
      }

      console.log("[vote] Successfully updated quiz status and counts");
    }

    // Verify the update was persisted by reading it back (using admin client)
    const { data: verifyQuiz, error: verifyError } = await supabaseAdmin
      .from("quiz")
      .select("likes, dislikes, data")
      .eq("id", replacementId)
      .single();

    if (verifyError) {
      console.error("[vote] Error verifying update:", verifyError);
    } else {
      console.log("[vote] Verified quiz state after update:", {
        likes: verifyQuiz.likes,
        dislikes: verifyQuiz.dislikes,
        status: (verifyQuiz.data as any)?.content?.status,
      });
    }

    return NextResponse.json({
      success: true,
      approvalCount: newLikes,
      rejectionCount: newDislikes,
      status: newStatus,
      change_summary: changeSummary,
    });
  } catch (error) {
    console.error("Error in POST /api/courses/[id]/syllabus-replacement/[replacementId]/vote:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
