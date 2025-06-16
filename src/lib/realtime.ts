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

  // 1. Subscribe to messages WHERE CURRENT USER IS RECEIVER (efficient + reliable)
  subscribeToIncomingMessages(
    onNewMessage: (message: Message) => void
  ) {
    const incomingChannel = supabase
      .channel(`incoming-${this.currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id.eq.${this.currentUserId}` // Simple filter - very reliable
        },
        (payload) => {
          onNewMessage(payload.new as Message);
        }
      )
      .subscribe();

    return incomingChannel;
  }

  // 2. Subscribe to messages WHERE CURRENT USER IS SENDER (for status updates)
  subscribeToSentMessages(
    onMessageUpdate: (message: Message) => void
  ) {
    const sentChannel = supabase
      .channel(`sent-${this.currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `user_id.eq.${this.currentUserId}` // Simple filter - very reliable
        },
        (payload) => {
          onMessageUpdate(payload.new as Message);
        }
      )
      .subscribe();

    return sentChannel;
  }

  // 2. Subscribe to new messages for a specific conversation
  subscribeToMessages(
    partnerId: string,
    onNewMessage: (message: Message) => void
  ) {
    // Clean up any previous subscription
    if (this.messageChannel) {
      this.messageChannel.unsubscribe();
      this.messageChannel = null;
    }
  
    // Use a single subscription and filter in JS
    this.messageChannel = supabase
      .channel(`messages-${this.currentUserId}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const message = payload.new as Message;
  
          const isForThisConversation =
            (message.user_id === this.currentUserId && message.receiver_id === partnerId) ||
            (message.user_id === partnerId && message.receiver_id === this.currentUserId);
  
          if (isForThisConversation) {
            onNewMessage(message);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const message = payload.new as Message;
  
          const isForThisConversation =
            (message.user_id === this.currentUserId && message.receiver_id === partnerId) ||
            (message.user_id === partnerId && message.receiver_id === this.currentUserId);
  
          if (isForThisConversation) {
            onNewMessage(message);
          }
        }
      )
      .subscribe();
  
    return this.messageChannel;
  }
  

  // 4. Subscribe to typing indicators - TARGET SPECIFIC USER
  subscribeToTyping(
    partnerId: string,
    onTypingChange: (isTyping: boolean) => void
  ) {
    if (this.typingChannel) {
      this.typingChannel.unsubscribe();
      this.typingChannel = null;
    }

    this.typingChannel = supabase
      .channel(`typing-${this.currentUserId}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `user_id.eq.${partnerId}` // Simple filter targeting specific user
        },
        (payload) => {
          const typingData = payload.new as TypingIndicator;
          
          // Only need to check conversation partner (user_id already filtered)
          if (typingData.conversation_partner_id === this.currentUserId) {
            onTypingChange(typingData.is_typing);
          }
        }
      )
      .subscribe();

    return this.typingChannel;
  }

  // 3. Subscribe to user presence - GLOBAL approach
  subscribeToPresence(onPresenceChange: (presence: UserPresence) => void) {
    if (this.presenceChannel) {
      this.presenceChannel.unsubscribe();
      this.presenceChannel = null;
    }

    this.presenceChannel = supabase
      .channel('user-presence-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          if (payload.new) {
            const presenceData = payload.new as UserPresence;
            // Let the client decide what to do with all presence updates
            onPresenceChange(presenceData);
          }
        }
      )
      .subscribe();

    return this.presenceChannel;
  }

  // 4. Send message with optimistic update
  async sendMessage(receiverId: string, content: string): Promise<Message | null> {
    try {
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
      console.log(data, error);
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