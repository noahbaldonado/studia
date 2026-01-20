import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatUsername } from "@/lib/utils";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ users: [] });
    }

    const searchTerm = `%${query.trim()}%`;

    // Search for users by username, name (from metadata), and email (from metadata)
    // We'll use separate queries and combine results since Supabase's .or() doesn't easily support JSONB fields
    const [usernameResults, allProfiles] = await Promise.all([
      // Search by username
      supabase
        .from("profile")
        .select("id, username, profile_picture_url, metadata")
        .neq("id", user.id)
        .ilike("username", searchTerm)
        .limit(20),
      // Get all profiles to filter by metadata (we'll filter in memory for metadata fields)
      supabase
        .from("profile")
        .select("id, username, profile_picture_url, metadata")
        .neq("id", user.id)
        .limit(100),
    ]);

    if (usernameResults.error) {
      console.error("Error searching users by username:", usernameResults.error);
      return NextResponse.json(
        { error: "Failed to search users" },
        { status: 500 }
      );
    }

    // Filter profiles by name in metadata
    const searchLower = query.trim().toLowerCase();
    const metadataMatches = (allProfiles.data || []).filter((profile) => {
      const metadata = profile.metadata as { name?: string; [key: string]: unknown } | null;
      const nameMatch = metadata?.name?.toLowerCase().includes(searchLower);
      return nameMatch;
    });

    // Combine results and remove duplicates
    const profileMap = new Map<string, typeof usernameResults.data[0]>();
    
    // Add username matches
    (usernameResults.data || []).forEach((profile) => {
      profileMap.set(profile.id, profile);
    });
    
    // Add metadata matches
    metadataMatches.forEach((profile) => {
      if (!profileMap.has(profile.id)) {
        profileMap.set(profile.id, profile);
      }
    });

    const profiles = Array.from(profileMap.values()).slice(0, 20);

    // Format results
    const users = (profiles || []).map((profile) => {
      const metadata = profile.metadata as { name?: string; [key: string]: unknown } | null;
      // Return the actual name from metadata, not the formatted username
      const actualName = metadata?.name || null;
      
      return {
        id: profile.id,
        name: actualName,
        username: profile.username || null,
        profilePictureUrl: profile.profile_picture_url || null,
      };
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error in GET /api/users/search:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
