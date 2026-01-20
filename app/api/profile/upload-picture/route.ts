import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate unique filename: {userId}/profile.{ext}
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/profile.${fileExt}`;

    // Delete old profile picture if it exists
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_picture_url")
      .eq("id", user.id)
      .single();

    if (profile?.profile_picture_url) {
      // Extract the path from the URL
      const oldPath = profile.profile_picture_url.split("/").slice(-2).join("/"); // Get userId/filename
      await supabase.storage.from("profile-pictures").remove([oldPath]);
    }

    // Upload new file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Update profile with new picture URL
    const { error: updateError } = await supabase
      .from("profile")
      .update({ profile_picture_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      // Try to clean up uploaded file
      await supabase.storage.from("profile-pictures").remove([fileName]);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error) {
    console.error("Error in upload-picture route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
