import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  user_id: string;
  receiver_id: string;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  read_at?: string;
}

export interface TypingIndicator {
  user_id: string;
  conversation_partner_id: string;
  is_typing: boolean;
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

export class RealtimeChat {
  private messageChannel: RealtimeChannel | null = null;
  private typingChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;

  constructor(userId: string) {
    this.currentUserId = userId;
  }

  // 1. Subscribe to new messages for a specific conversation
  subscribeToMessages(
    partnerId: string, 
    onNewMessage: (message: Message) => void
  ) {
    // Unsubscribe from previous channel if exists
    if (this.messageChannel) {
      this.messageChannel.unsubscribe();
    }

    this.messageChannel = supabase
      .channel(`messages-${this.currentUserId}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(user_id.eq.${this.currentUserId},receiver_id.eq.${partnerId}),and(user_id.eq.${partnerId},receiver_id.eq.${this.currentUserId}))`
        },
        (payload) => {
          onNewMessage(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `or(and(user_id.eq.${this.currentUserId},receiver_id.eq.${partnerId}),and(user_id.eq.${partnerId},receiver_id.eq.${this.currentUserId}))`
        },
        (payload) => {
          onNewMessage(payload.new as Message);
        }
      )
      .subscribe();

    return this.messageChannel;
  }

  // 2. Subscribe to typing indicators for a conversation
  subscribeToTyping(
    partnerId: string,
    onTypingChange: (isTyping: boolean) => void
  ) {
    if (this.typingChannel) {
      this.typingChannel.unsubscribe();
    }

    this.typingChannel = supabase
      .channel(`typing-${this.currentUserId}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `and(user_id.eq.${partnerId},conversation_partner_id.eq.${this.currentUserId})`
        },
        (payload) => {
          if (payload.new) {
            onTypingChange((payload.new as TypingIndicator).is_typing);
          }
        }
      )
      .subscribe();

    return this.typingChannel;
  }

  // 3. Subscribe to user presence
  subscribeToPresence(onPresenceChange: (presence: UserPresence) => void) {
    if (this.presenceChannel) {
      this.presenceChannel.unsubscribe();
    }

    this.presenceChannel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          if (payload.new) {
            onPresenceChange(payload.new as UserPresence);
          }
        }
      )
      .subscribe();

    return this.presenceChannel;
  }

  // 4. Send message with optimistic update
  async sendMessage(receiverId: string, content: string): Promise<Message | null> {
    try {
        console.log("sending message")
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: this.currentUserId,
          receiver_id: receiverId,
          content: content.trim(),
          status: 'sent'
        })
        .select()
        .single();
      if (error) throw error;
      return data as Message;
    } catch (error) {
      return null;
    }
  }

  // 5. Update typing indicator
  async setTyping(partnerId: string, isTyping: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('typing_indicators')
        .upsert({
          user_id: this.currentUserId,
          conversation_partner_id: partnerId,
          is_typing: isTyping
        }, {
          onConflict: 'user_id,conversation_partner_id'
        });

      if (error) throw error;
    } catch (error) {
      // Handle silently
    }
  }

  // 6. Update user presence
  async setPresence(isOnline: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: this.currentUserId,
          is_online: isOnline,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      // Handle silently
    }
  }

  // 7. Mark message as read
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      // Handle silently
    }
  }

  // 8. Get user presence
  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data as UserPresence;
    } catch (error) {
      return null;
    }
  }

  // 9. Cleanup subscriptions
  unsubscribeAll() {
    if (this.messageChannel) {
      this.messageChannel.unsubscribe();
      this.messageChannel = null;
    }
    if (this.typingChannel) {
      this.typingChannel.unsubscribe();
      this.typingChannel = null;
    }
    if (this.presenceChannel) {
      this.presenceChannel.unsubscribe();
      this.presenceChannel = null;
    }
  }
}

// Helper function to create realtime chat instance
export const createRealtimeChat = (userId: string) => {
  return new RealtimeChat(userId);
}; 