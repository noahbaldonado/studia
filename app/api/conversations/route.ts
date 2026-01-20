import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatUsername } from "@/lib/utils";

// GET: Fetch all conversations for the current user
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

    // Fetch all conversations where user is user1 or user2
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversation")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    // Get the other user's ID and profile for each conversation
    const otherUserIds = conversations?.map((conv) =>
      conv.user1_id === user.id ? conv.user2_id : conv.user1_id
    ) || [];

    if (otherUserIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Fetch profiles for other users
    const { data: profiles, error: profilesError } = await supabase
      .from("profile")
      .select("id, username, profile_picture_url")
      .in("id", otherUserIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch profiles" },
        { status: 500 }
      );
    }

    const profileMap = new Map(
      profiles?.map((p) => [p.id, p]) || []
    );

    // Get the latest message and unread count for each conversation
    const conversationIds = conversations?.map((c) => c.id) || [];
    
    const { data: latestMessages, error: messagesError } = await supabase
      .from("message")
      .select("conversation_id, content, created_at, sender_id, read_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      console.error("Error fetching latest messages:", messagesError);
    }

    // Group messages by conversation and get the latest one
    const latestMessageMap = new Map<string, typeof latestMessages[0]>();
    latestMessages?.forEach((msg) => {
      if (!latestMessageMap.has(msg.conversation_id)) {
        latestMessageMap.set(msg.conversation_id, msg);
      }
    });

    // Count unread messages per conversation
    const { data: unreadMessages, error: unreadError } = await supabase
      .from("message")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .is("read_at", null)
      .neq("sender_id", user.id);

    if (unreadError) {
      console.error("Error fetching unread messages:", unreadError);
    }

    const unreadCountMap = new Map<string, number>();
    unreadMessages?.forEach((msg) => {
      unreadCountMap.set(
        msg.conversation_id,
        (unreadCountMap.get(msg.conversation_id) || 0) + 1
      );
    });

    // Build response with conversation details
    const conversationsWithDetails = conversations?.map((conv) => {
      const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const profile = profileMap.get(otherUserId);
      const latestMessage = latestMessageMap.get(conv.id);
      const unreadCount = unreadCountMap.get(conv.id) || 0;

      return {
        id: conv.id,
        otherUserId,
        otherUserName: profile?.username
          ? formatUsername(profile.username)
          : `User ${otherUserId.substring(0, 8)}`,
        otherUserProfilePictureUrl: profile?.profile_picture_url || null,
        latestMessage: latestMessage
          ? {
              content: latestMessage.content,
              createdAt: latestMessage.created_at,
              senderId: latestMessage.sender_id,
              isFromCurrentUser: latestMessage.sender_id === user.id,
            }
          : null,
        unreadCount,
        updatedAt: conv.updated_at,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      conversations: conversationsWithDetails,
    });
  } catch (error) {
    console.error("Error in GET /api/conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new conversation or get existing one
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

    const body = await request.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return NextResponse.json(
        { error: "otherUserId is required" },
        { status: 400 }
      );
    }

    if (otherUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot create conversation with yourself" },
        { status: 400 }
      );
    }

    // Ensure user1_id < user2_id for consistency
    const user1Id = user.id < otherUserId ? user.id : otherUserId;
    const user2Id = user.id < otherUserId ? otherUserId : user.id;

    // Check if conversation already exists
    const { data: existingConversation, error: checkError } = await supabase
      .from("conversation")
      .select("*")
      .eq("user1_id", user1Id)
      .eq("user2_id", user2Id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine
      console.error("Error checking existing conversation:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing conversation" },
        { status: 500 }
      );
    }

    if (existingConversation) {
      return NextResponse.json({
        success: true,
        conversationId: existingConversation.id,
        isNew: false,
      });
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabase
      .from("conversation")
      .insert({
        user1_id: user1Id,
        user2_id: user2Id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating conversation:", createError);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId: newConversation.id,
      isNew: true,
    });
  } catch (error) {
    console.error("Error in POST /api/conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
