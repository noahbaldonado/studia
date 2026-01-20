import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env.local file.");
      console.error("Get it from: Supabase Dashboard → Settings → API → Service Role Key");
      return NextResponse.json(
        { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your environment variables." },
        { status: 500 }
      );
    }

    // Create admin client with service role key for hard delete
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Delete user from auth.users - this will cascade delete all related data:
    // - profile (ON DELETE CASCADE)
    // - course_subscription (ON DELETE CASCADE)
    // - course_pdfs (ON DELETE CASCADE)
    // - quiz (ON DELETE CASCADE, which cascades to quiz_tag, comment, quiz_interaction)
    // - comment (ON DELETE CASCADE, which cascades to comment_like and child comments)
    // - quiz_interaction (ON DELETE CASCADE)
    // - follow (ON DELETE CASCADE for both follower_id and following_id)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete user account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/users/delete:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
