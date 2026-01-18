import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const searchLower = query.toLowerCase();

    // Get all profiles and filter by name or email
    const { data: profiles, error: profileError } = await supabase
      .from("profile")
      .select("id, metadata");

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
    }

    // Filter profiles by name or email
    const matchingProfiles = (profiles || []).filter((profile) => {
      const metadata = profile.metadata as any;
      const name = (metadata?.name || "").toLowerCase();
      const email = (metadata?.email || "").toLowerCase();
      
      // Check if name matches
      if (name.includes(searchLower)) return true;
      
      // Check if email matches (including just the prefix before @)
      // For UCSC emails like "username@ucsc.edu", match "username"
      if (email) {
        const emailPrefix = email.split("@")[0].toLowerCase();
        if (emailPrefix.includes(searchLower) || searchLower.includes(emailPrefix)) return true;
        if (email.includes(searchLower)) return true;
      }
      
      return false;
    });

    // Build results with profile data
    const results = matchingProfiles
      .map((profile) => {
        const metadata = profile.metadata as any;
        const name = metadata?.name || "";
        const email = metadata?.email || "";
        
        return {
          id: profile.id,
          name: name || `User ${profile.id.substring(0, 8)}`,
          email: email || null,
        };
      })
      .filter((u) => u.id !== user.id) // Exclude current user
      .slice(0, 20); // Limit to 20 results

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
