"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Chat {
  id: string;
  name: string;
}

interface ChatSidebarProps {
  user: User;
  activeChat: Chat | null;
  setActiveChat: (chat: Chat | null) => void;
}

export function ChatSidebar({ user, activeChat, setActiveChat }: ChatSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    const fetchChats = async () => {
      const { data } = await supabase
        .from("chats")
        .select("*")
        .order("created_at");
      
      if (data) {
        setChats(data);
      }
    };

    fetchChats();
  }, []);

  return (
    <div className="w-64 border-r bg-muted/40 p-4">
      <h2 className="font-semibold mb-4">Your Chats</h2>
      <div className="space-y-2">
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setActiveChat(chat)}
            className={`w-full text-left px-4 py-2 rounded-lg ${
              activeChat?.id === chat.id 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted"
            }`}
          >
            {chat.name}
          </button>
        ))}
      </div>
    </div>
  );
} 