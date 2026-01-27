import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Get all conversations where user is user1 or user2
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversation")
      .select("id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    const conversationIds = conversations?.map((c) => c.id) || [];

    if (conversationIds.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    // Count unread messages (read_at IS NULL and not sent by current user)
    const { count, error: countError } = await supabase
      .from("message")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .is("read_at", null)
      .neq("sender_id", user.id);

    if (countError) {
      console.error("Error counting unread messages:", countError);
      return NextResponse.json(
        { error: "Failed to count unread messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ unreadCount: count || 0 });
  } catch (error) {
    console.error("Error in GET /api/messages/unread-count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
