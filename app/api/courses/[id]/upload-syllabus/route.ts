import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Calculate dynamic approval threshold based on class size and existing syllabus
// TEMPORARY FOR TESTING: Changed minimum from 0 to 1 to test approval workflow
// TO REVERT: Change the two "return 1;" statements below back to "return 0;"
function calculateApprovalThreshold(
  hasExistingSyllabus: boolean,
  classSize: number
): number {
  if (!hasExistingSyllabus) {
    // No existing syllabus: 0 approvals needed
    return 0;
  } else if (classSize <= 3) {
    // 1-3 subscribers: 0 approvals
    return 0;
  } else if (classSize <= 5) {
    // 4-5 subscribers: 1 approval
    return 1;
  } else if (classSize <= 10) {
    // 6-10 subscribers: 2 approvals
    return 2;
  } else if (classSize <= 20) {
    // 11-20 subscribers: 3 approvals
    return 3;
  } else {
    // 20+ subscribers: min(ceil(class_size/5), 10)
    return Math.min(Math.ceil(classSize / 5), 10);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: courseId } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is subscribed to the course
    const { data: subscription } = await supabase
      .from("course_subscription")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: "You must be subscribed to the course to upload a syllabus" },
        { status: 403 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (PDF only)
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Upload file to storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${courseId}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("course-syllabi")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading syllabus:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("course-syllabi").getPublicUrl(fileName);

    // Get course and subscriber count to calculate threshold
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
    const approvalThreshold = calculateApprovalThreshold(hasExistingSyllabus, classSize);

    console.log("[upload-syllabus] Threshold calculation:", {
      hasExistingSyllabus,
      classSize,
      approvalThreshold,
    });

    // If threshold is 0, directly replace the syllabus without creating a proposal
    if (approvalThreshold === 0) {
      console.log("[upload-syllabus] Threshold is 0, auto-approving");
      let changeSummary = "Syllabus has been updated.";
      
      // Generate change summary if there's an existing syllabus
      if (hasExistingSyllabus && course?.syllabus_url) {
        try {
          const geminiApiKey = process.env.GEMINI_API_KEY;
          if (geminiApiKey) {
            // Extract file paths from URLs
            const oldPath = course.syllabus_url.split("/course-syllabi/")[1];
            const newPath = publicUrl.split("/course-syllabi/")[1];

            // Download both PDFs
            const [oldPdfData, newPdfData] = await Promise.all([
              supabase.storage.from("course-syllabi").download(oldPath),
              supabase.storage.from("course-syllabi").download(newPath),
            ]);

            if (oldPdfData.data && newPdfData.data) {
              // Parse both PDFs
              const pdfParseModule = await import("pdf-parse");
              const pdfParse = pdfParseModule.default || pdfParseModule;

              const oldArrayBuffer = await oldPdfData.data.arrayBuffer();
              const oldBuffer = Buffer.from(oldArrayBuffer);
              const oldPdf = await pdfParse(oldBuffer);

              const newArrayBuffer = await newPdfData.data.arrayBuffer();
              const newBuffer = Buffer.from(newArrayBuffer);
              const newPdf = await pdfParse(newBuffer);

              // Use Gemini to compare and summarize changes
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
          // Keep default summary if comparison fails
        }
      }

      // Update course syllabus URL directly using admin client to bypass RLS
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

      const { error: updateCourseError } = await supabaseAdmin
        .from("course")
        .update({ syllabus_url: publicUrl })
        .eq("id", courseId);

      if (updateCourseError) {
        console.error("Error updating course:", updateCourseError);
        return NextResponse.json(
          { error: "Failed to update syllabus" },
          { status: 500 }
        );
      }

      // Verify the update was successful
      const { data: verifiedCourse } = await supabaseAdmin
        .from("course")
        .select("syllabus_url")
        .eq("id", courseId)
        .single();

      // Create quiz entry for approved syllabus replacement
      const syllabusReplacementData = {
        type: "syllabus_replacement",
        content: {
          course_name: course?.name || "Unknown Course",
          new_syllabus_url: publicUrl,
          status: "approved",
          change_summary: changeSummary,
        },
      };

      const { data: quizEntry, error: quizError } = await supabase
        .from("quiz")
        .insert({
          data: syllabusReplacementData,
          course_id: courseId,
          user_id: user.id,
          likes: 0,
          dislikes: 0,
        })
        .select("id")
        .single();

      if (quizError) {
        console.error("Error creating quiz entry:", quizError);
      }

      return NextResponse.json({
        success: true,
        message: "Syllabus updated successfully",
        syllabus_url: verifiedCourse?.syllabus_url,
      });
    }

    // Threshold > 0: Create or update replacement proposal as quiz entry
    console.log("[upload-syllabus] Threshold > 0, creating/updating proposal");
    
    // Check if there's already a pending replacement quiz for this course
    const { data: existingQuizzes, error: existingQuizzesError } = await supabase
      .from("quiz")
      .select("id, data")
      .eq("course_id", courseId)
      .eq("user_id", user.id);

    if (existingQuizzesError) {
      console.error("[upload-syllabus] Error fetching existing quizzes:", existingQuizzesError);
    }

    console.log("[upload-syllabus] Found existing quizzes:", existingQuizzes?.length || 0);

    // Find existing pending syllabus replacement
    const existingReplacement = existingQuizzes?.find((q: any) => {
      const data = q.data;
      return data?.type === "syllabus_replacement" && data?.content?.status === "pending";
    });

    console.log("[upload-syllabus] Existing replacement found:", !!existingReplacement);

    // If user has an active pending replacement, delete it first
    if (existingReplacement) {
      console.log("[upload-syllabus] Deleting existing pending replacement:", existingReplacement.id);
      
      // Delete old votes (quiz_interaction records) for this replacement
      const { error: deleteVotesError } = await supabase
        .from("quiz_interaction")
        .delete()
        .eq("quiz_id", existingReplacement.id);

      if (deleteVotesError) {
        console.error("[upload-syllabus] Error deleting old votes:", deleteVotesError);
      }

      // Delete the old quiz entry
      const { error: deleteQuizError } = await supabase
        .from("quiz")
        .delete()
        .eq("id", existingReplacement.id);

      if (deleteQuizError) {
        console.error("[upload-syllabus] Error deleting old replacement:", deleteQuizError);
        return NextResponse.json(
          { error: "Failed to delete existing replacement" },
          { status: 500 }
        );
      }

      console.log("[upload-syllabus] Successfully deleted existing replacement");
    }

    // Calculate thresholds (reuse classSize and hasExistingSyllabus from earlier)
    // approvalThreshold is already calculated above, but we need to recalculate for the rejection threshold
    const rejectionThreshold = approvalThreshold === 0 ? 1 : approvalThreshold;

    const syllabusReplacementData = {
      type: "syllabus_replacement",
      content: {
        course_name: course?.name || "Unknown Course",
        new_syllabus_url: publicUrl,
        status: "pending",
        approval_threshold: approvalThreshold,
        rejection_threshold: rejectionThreshold,
      },
    };

    // Create new replacement proposal as quiz entry
    const { data: quizEntry, error: quizError } = await supabase
      .from("quiz")
      .insert({
        data: syllabusReplacementData,
        course_id: courseId,
        user_id: user.id,
        likes: 0,
        dislikes: 0,
      })
      .select("id, data, created_at")
      .single();

    if (quizError) {
      console.error("Error creating replacement:", quizError);
      return NextResponse.json(
        { error: "Failed to create replacement proposal" },
        { status: 500 }
      );
    }

    console.log("[upload-syllabus] Created syllabus replacement quiz entry:", {
      id: quizEntry.id,
      course_id: courseId,
      data: quizEntry.data,
      created_at: quizEntry.created_at,
    });

    return NextResponse.json({
      success: true,
      quizId: quizEntry.id,
      message: "Syllabus replacement proposal created",
    });
  } catch (error) {
    console.error("Error in POST /api/courses/[id]/upload-syllabus:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
