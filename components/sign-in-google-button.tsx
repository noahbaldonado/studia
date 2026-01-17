"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";

export function GoogleSignInButton() {
  const signInWithGoogle = async () => {
    const supabase = createClient();
    
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <Button onClick={signInWithGoogle} variant="outline" size="sm">
      Sign in with Google
    </Button>
  );
}