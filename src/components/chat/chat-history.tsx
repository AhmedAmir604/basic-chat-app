"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/src/lib/supabase";
import { useSocket } from "@/src/lib/socket";
import { ChatMessage } from "@/src/components/chat/chat-message";

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function ChatHistory({ chatId, userId }: { chatId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  useEffect(() => {
    // Fetch messages from Supabase
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at");
      
      if (data) {
        setMessages(data);
      }
    };

    fetchMessages();

    // Listen for new messages via socket
    const handleNewMessage = (message: Message) => {
      if (message.chat_id === chatId) {
        setMessages((prev: Message[]) => [...prev, message]);
      }
    };

    if (socket) {
      socket.on("new_message", handleNewMessage);
    }

    return () => {
      if (socket) {
        socket.off("new_message", handleNewMessage);
      }
    };
  }, [chatId, socket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          isOwn={message.sender_id === userId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
} 