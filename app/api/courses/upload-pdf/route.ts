import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json(
      { success: true, data: dbData },
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
