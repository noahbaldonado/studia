import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error_description = searchParams.get("error_description");
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/protected";

  // Handle OAuth errors from the provider
  if (error) {
    const errorMessage = error_description || error || "Authentication failed";
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(errorMessage)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent("No authorization code provided")}`
    );
  }

  try {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      // Clean up error message to remove Supabase URLs
      let errorMessage = exchangeError.message || "Authentication failed";
      // Remove Supabase URLs from error messages
      errorMessage = errorMessage.replace(/https?:\/\/[^\s]+\.supabase\.co[^\s]*/g, "");
      errorMessage = errorMessage.trim() || "Authentication failed";
      
      return NextResponse.redirect(
        `${origin}/auth/error?error=${encodeURIComponent(errorMessage)}`
      );
    }

    // Get the user after successful session exchange
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=${encodeURIComponent("Failed to get user information")}`
      );
    }

    // Check if profile exists for this user UUID
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("profile")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileCheckError && profileCheckError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine, but other errors are real issues
      console.error("Error checking profile:", profileCheckError);
    }

    // If profile doesn't exist, create it (without username - user must set it)
    if (!existingProfile) {
      const userName = user.user_metadata?.full_name || user.email || "User";
      
      const { error: insertError } = await supabase
        .from("profile")
        .insert({
          id: user.id,
          rating: 7.5,
          username: null, // User must set username on first login
          metadata: {
            name: userName,
            email: user.email || "",
          },
        });

      if (insertError) {
        console.error("Error creating profile:", insertError);
        // Don't fail the auth flow if profile creation fails - user can still log in
      }
    } else {
      // Update email in metadata if it's missing
      const { data: currentProfile } = await supabase
        .from("profile")
        .select("metadata")
        .eq("id", user.id)
        .single();
      
      if (currentProfile) {
        const metadata = currentProfile.metadata as { email?: string; name?: string; [key: string]: unknown };
        if (!metadata?.email && user.email) {
          await supabase
            .from("profile")
            .update({
              metadata: {
                ...metadata,
                email: user.email,
              },
            })
            .eq("id", user.id);
        }
      }
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Unexpected error in auth callback:", error.message || err);
    const errorMessage = error.message || "An unexpected error occurred";
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(errorMessage)}`
    );
  }
}