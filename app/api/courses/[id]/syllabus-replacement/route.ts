import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

    // Get current syllabus from course table
    const { data: course } = await supabase
      .from("course")
      .select("syllabus_url, name")
      .eq("id", courseId)
      .single();

    // Get approval threshold for display purposes
    const { count: subscriberCount } = await supabase
      .from("course_subscription")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId);

    const classSize = subscriberCount || 0;
    const hasExistingSyllabus = !!course?.syllabus_url;
    
    // Calculate approval threshold (same logic as upload route)
    let approvalThreshold = 0;
    if (!hasExistingSyllabus) {
      approvalThreshold = 0;
    } else if (classSize <= 3) {
      approvalThreshold = 0;
    } else if (classSize <= 5) {
      approvalThreshold = 1;
    } else if (classSize <= 10) {
      approvalThreshold = 2;
    } else if (classSize <= 20) {
      approvalThreshold = 3;
    } else {
      approvalThreshold = Math.min(Math.ceil(classSize / 5), 10);
    }

    return NextResponse.json({
      success: true,
      currentSyllabusUrl: course?.syllabus_url || null,
      approvalThreshold,
    });
  } catch (error) {
    console.error("Error in GET /api/courses/[id]/syllabus-replacement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
