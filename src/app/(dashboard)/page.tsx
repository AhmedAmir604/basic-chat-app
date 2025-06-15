"use client";

import { useState, useEffect } from "react";
import { ChatSidebar } from "@/src/components/chat/chat-sidebar";
import { ChatHistory } from "@/src/components/chat/chat-history";
import { ChatInput } from "@/src/components/chat/chat-input";
import { ThemeToggle } from "@/src/components/theme/theme-toggle";
import { useAuth } from "@/src/lib/auth-context";
import { chatHelpers, Room } from "@/src/lib/supabase";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const { user, profile, signOut } = useAuth();
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRooms();
    }
  }, [user]);

  const loadRooms = async () => {
    try {
      const { data, error } = await chatHelpers.getRooms();
      if (error) throw error;
      
      setRooms(data || []);
      // Set the first room as active if available
      if (data && data.length > 0 && !activeRoom) {
        setActiveRoom(data[0]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!activeRoom || !message.trim() || !user) return;
    
    try {
      const { error } = await chatHelpers.sendMessage(message, activeRoom.id, user.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return null; // This will redirect via the main page
  }

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar 
        user={user} 
        profile={profile}
        rooms={rooms}
        activeRoom={activeRoom} 
        setActiveRoom={setActiveRoom} 
      />
      <div className="flex flex-col flex-1">
        <header className="border-b p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            {activeRoom ? activeRoom.name : "Select a room"}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {profile?.full_name || user?.email}
            </span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4">
          {activeRoom ? (
            <ChatHistory roomId={activeRoom.id} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a room to start messaging
            </div>
          )}
        </div>
        {activeRoom && (
          <div className="p-4 border-t">
            <ChatInput onSendMessage={handleSendMessage} />
          </div>
        )}
      </div>
    </div>
  );
}