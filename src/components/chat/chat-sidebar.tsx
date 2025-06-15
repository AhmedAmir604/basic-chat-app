"use client";

import { User } from "@supabase/supabase-js";
import { Room, Profile } from "@/src/lib/supabase";

interface ChatSidebarProps {
  user: User | null;
  profile: Profile | null;
  rooms: Room[];
  activeRoom: Room | null;
  setActiveRoom: (room: Room | null) => void;
}

export function ChatSidebar({ user, profile, rooms, activeRoom, setActiveRoom }: ChatSidebarProps) {
  if (!user) return null;

  return (
    <div className="w-64 border-r bg-muted/40 p-4">
      <div className="mb-4">
        <h2 className="font-semibold mb-2">Chat Rooms</h2>
        <div className="text-sm text-muted-foreground">
          Welcome, {profile?.full_name || user.email}
        </div>
      </div>
      <div className="space-y-2">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setActiveRoom(room)}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
              activeRoom?.id === room.id 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted"
            }`}
          >
            <div className="font-medium">{room.name}</div>
            {room.description && (
              <div className="text-sm opacity-75 truncate">
                {room.description}
              </div>
            )}
          </button>
        ))}
        {rooms.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No rooms available
          </div>
        )}
      </div>
    </div>
  );
} 