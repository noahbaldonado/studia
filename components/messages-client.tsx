"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Send, User, Search, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserProfilePictureUrl: string | null;
  latestMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    isFromCurrentUser: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface SearchUser {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
}

export function MessagesClient() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const supabase = createClient();

  // Get current user ID
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    }
    getCurrentUser();
  }, [supabase]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    // Check for conversation ID in URL params
    const conversationParam = searchParams.get("conversation");
    if (conversationParam) {
      setSelectedConversationId(conversationParam);
    }
  }, [loadConversations, searchParams]);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  // Start conversation with a user
  const startConversation = async (userId: string) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedConversationId(data.conversationId);
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
        // Reload conversations
        await loadConversations();
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }, []);

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
      // Refresh conversations to update unread counts
      loadConversations();
    }
  }, [selectedConversationId, loadMessages, loadConversations]);

  // Send message
  const sendMessage = async () => {
    if (!selectedConversationId || !messageContent.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedConversationId,
          content: messageContent.trim(),
        }),
      });

      if (response.ok) {
        setMessageContent("");
        // Reload messages
        await loadMessages(selectedConversationId);
        // Refresh conversations to update latest message
        await loadConversations();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  if (selectedConversationId && selectedConversation) {
    // Show conversation view
    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <button
            onClick={() => setSelectedConversationId(null)}
            className="text-foreground hover:text-[hsl(var(--primary))]"
          >
            ← Back
          </button>
          <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
            {selectedConversation.otherUserProfilePictureUrl ? (
              <Image
                src={selectedConversation.otherUserProfilePictureUrl}
                alt={selectedConversation.otherUserName}
                fill
                className="object-cover"
                sizes="32px"
              />
            ) : (
              <User className="w-5 h-5 h-full w-full p-1.5 text-[hsl(var(--muted-foreground))]" />
            )}
          </div>
          <Link
            href={`/protected/profile/${selectedConversation.otherUserId}`}
            className="font-semibold text-foreground hover:text-[hsl(var(--primary))] hover:underline"
          >
            {selectedConversation.otherUserName}
          </Link>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((message) => {
            const isFromCurrentUser = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isFromCurrentUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    isFromCurrentUser
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--background))]"
                      : "bg-[hsl(var(--secondary))] text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    isFromCurrentUser
                      ? "text-[hsl(var(--background))]/70"
                      : "text-[hsl(var(--muted-foreground))]"
                  }`}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message input */}
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
          <div className="flex gap-2">
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 p-2 bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--border))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] placeholder:text-[hsl(var(--muted-foreground))] text-sm rounded-lg"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!messageContent.trim() || isSending}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--background))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show conversations list
  return (
    <div>
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search for a user..."
            className="w-full pl-10 pr-10 py-2 bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] placeholder:text-[hsl(var(--muted-foreground))] text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSearch(false);
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results */}
        {showSearch && (searchQuery || searchResults.length > 0) && (
          <div className="mt-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] max-h-64 overflow-y-auto">
            {isSearching ? (
              <div className="px-4 py-3 text-center text-[hsl(var(--muted-foreground))] text-sm">
                Searching...
              </div>
            ) : searchResults.length === 0 && searchQuery ? (
              <div className="px-4 py-3 text-center text-[hsl(var(--muted-foreground))] text-sm">
                No users found
              </div>
            ) : (
              searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => startConversation(user.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                >
                  {/* Profile picture */}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
                    {user.profilePictureUrl ? (
                      <Image
                        src={user.profilePictureUrl}
                        alt={user.username}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <User className="w-6 h-6 h-full w-full p-2 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {user.username ? (
                      <>
                        <p className="font-medium text-foreground text-sm truncate">
                          @{user.username}
                        </p>
                        {user.name && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                            {user.name}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="font-medium text-foreground text-sm truncate">
                        {user.name || `User ${user.id.substring(0, 8)}`}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-sm">
          Loading conversations...
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 px-4">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            No conversations yet. Search for a user to start chatting!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedConversationId(conversation.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--secondary))] transition-colors text-left"
            >
              {/* Profile picture */}
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
                {conversation.otherUserProfilePictureUrl ? (
                  <Image
                    src={conversation.otherUserProfilePictureUrl}
                    alt={conversation.otherUserName}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <User className="w-7 h-7 h-full w-full p-2 text-[hsl(var(--muted-foreground))]" />
                )}
              </div>

              {/* Conversation info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Link
                    href={`/protected/profile/${conversation.otherUserId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-foreground hover:text-[hsl(var(--primary))] hover:underline text-sm"
                  >
                    {conversation.otherUserName}
                  </Link>
                  {conversation.latestMessage && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">
                      {formatTime(conversation.latestMessage.createdAt)}
                    </span>
                  )}
                </div>
                {conversation.latestMessage && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                    {conversation.latestMessage.isFromCurrentUser ? "You: " : ""}
                    {conversation.latestMessage.content}
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {conversation.unreadCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--background))] text-xs font-bold">
                  {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
