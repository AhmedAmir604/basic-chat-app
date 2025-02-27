"use client";

import { useState, useEffect } from "react";
import { ChatSidebar } from "@/src/components/chat/chat-sidebar";
import { ChatHistory } from "@/src/components/chat/chat-history";
import { ChatInput } from "@/src/components/chat/chat-input";
import { ThemeToggle } from "@/src/components/theme/theme-toggle";
import { useSocket } from "@/src/lib/socket";
import { supabase } from "@/src/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Chat {
  id: string;
  name: string;
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    // Check if user is authenticated
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      }
      setLoading(false);
    };
    
    getUser();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  const handleSendMessage = async (message: string) => {
    if (!activeChat || !message.trim()) return;
    
    // Save message to Supabase
    const { data, error } = await supabase
      .from("messages")
      .insert({
        chat_id: activeChat.id,
        sender_id: user.id,
        content: message,
      });
      
    // Emit via socket
    if(socket){
      socket.emit("send_message", {
        chat_id: activeChat.id,
        sender_id: user.id,
        content: message,
        created_at: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar 
        user={user} 
        activeChat={activeChat} 
        setActiveChat={setActiveChat} 
      />
      <div className="flex flex-col flex-1">
        <header className="border-b p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            {activeChat ? activeChat.name : "Select a chat"}
          </h1>
          <ThemeToggle />
        </header>
        <div className="flex-1 overflow-auto p-4">
          {activeChat ? (
            <ChatHistory chatId={activeChat.id} userId={user.id} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a chat to start messaging
            </div>
          )}
        </div>
        {activeChat && (
          <div className="p-4 border-t">
            <ChatInput onSendMessage={handleSendMessage} />
          </div>
        )}
      </div>
    </div>
  );
}