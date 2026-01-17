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
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;

    if (!file || !courseId) {
      return NextResponse.json(
        { error: "File e courseId sono richiesti" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Solo file PDF sono supportati" },
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
          { error: "Il bucket 'course-pdfs' non esiste. Crea il bucket in Supabase Storage." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Errore durante l'upload del file: ${uploadError.message || "Errore sconosciuto"}` },
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
        { error: "Errore nel salvataggio dei metadati" },
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
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
