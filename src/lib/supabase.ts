import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export type Profile = {
  id: string;
  updated_at?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  website?: string;
};

export type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  room_id?: string;
  profiles?: Profile;
};

export type Room = {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
};

// Helper functions for common operations
export const authHelpers = {
  signUp: async (email: string, password: string, fullName?: string) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        }
      }
    });
  },

  signIn: async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  signOut: async () => {
    return await supabase.auth.signOut();
  },

  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
};

export const chatHelpers = {
  // Get all messages for a room
  getMessages: async (roomId: string) => {
    return await supabase
      .from('messages')
      .select(`
        *,
        profiles (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
  },

  // Send a message
  sendMessage: async (content: string, roomId: string, userId: string) => {
    return await supabase
      .from('messages')
      .insert([
        {
          content,
          room_id: roomId,
          user_id: userId
        }
      ]);
  },

  // Get all rooms
  getRooms: async () => {
    return await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: true });
  },

  // Subscribe to messages in real-time
  subscribeToMessages: (roomId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        }, 
        callback
      )
      .subscribe();
  },

  // Get user profile
  getProfile: async (userId: string) => {
    return await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
  },

  // Update user profile
  updateProfile: async (userId: string, updates: Partial<Profile>) => {
    return await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
  }
}; 