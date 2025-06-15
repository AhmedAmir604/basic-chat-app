"use client";

import { useEffect, useRef, useState } from "react";
import { Message, chatHelpers } from "@/src/lib/supabase";
import { ChatMessage } from "@/src/components/chat/chat-message";

export function ChatHistory({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch messages from Supabase
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await chatHelpers.getMessages(roomId);
        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to real-time updates
    const subscription = chatHelpers.subscribeToMessages(roomId, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as Message;
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
        />
      ))}
      {messages.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No messages yet. Start the conversation!
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
} 