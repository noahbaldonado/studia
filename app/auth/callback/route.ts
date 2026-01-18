import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/protected"; // Ti manda a /protected dopo il login

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Get the user after successful session exchange
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if profile exists for this user UUID
        const { data: existingProfile } = await supabase
          .from("profile")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        // If profile doesn't exist, create it
        if (!existingProfile) {
          const userName = user.user_metadata?.full_name || user.email || "User";
          
          await supabase
            .from("profile")
            .insert({
              id: user.id,
              rating: 7.5,
              metadata: {
                name: userName,
              },
            });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  
  return NextResponse.redirect(`${origin}/auth/error`);
}