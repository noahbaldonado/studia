"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface MessageButtonProps {
  targetUserId: string;
}

export function MessageButton({ targetUserId }: MessageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleMessage = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      // Create or get existing conversation
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: targetUserId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to messages page with conversation selected
        router.push(`/protected/messages?conversation=${data.conversationId}`);
      } else {
        console.error("Error creating conversation");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleMessage}
      disabled={isLoading}
      variant="outline"
      className="w-full sm:w-auto"
    >
      <MessageSquare className="w-4 h-4 mr-2" />
      {isLoading ? "Loading..." : "Message"}
    </Button>
  );
}
