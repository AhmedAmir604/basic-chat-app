import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Basic message structure - what each message looks like
export interface Message {
  id: string;
  user_id: string;        // who sent the message
  receiver_id: string;    // who receives the message
  content: string;        // the actual message text
  created_at: string;     // when it was sent
}

// Simple chat class that handles sending and receiving messages
export class RealtimeChat {
  private messageChannel: RealtimeChannel | null = null;  // connection for real-time messages
  private currentUserId: string | null = null;            // the logged-in user's ID

  constructor(userId: string) {
    this.currentUserId = userId;
  }

  // Listen for new messages in a specific conversation
  // This function will be called every time a new message arrives
  subscribeToMessages(
    partnerId: string,                           // the other person in the conversation
    onNewMessage: (message: Message) => void     // function to call when new message arrives
  ) {
    // If we already have a connection, close it first
    if (this.messageChannel) {
      this.messageChannel.unsubscribe();
      this.messageChannel = null;
    }

    // Create a new real-time connection
    this.messageChannel = supabase
      .channel(`chat-${this.currentUserId}-${partnerId}`)  // unique channel name
      .on(
        'postgres_changes',
        {
          event: 'INSERT',           // listen for new messages being added
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const message = payload.new as Message;
          
          // Check if this message belongs to our conversation
          const isOurMessage = 
            (message.user_id === this.currentUserId && message.receiver_id === partnerId) ||
            (message.user_id === partnerId && message.receiver_id === this.currentUserId);

          // If it's our message, call the function to handle it
          if (isOurMessage) {
            onNewMessage(message);
          }
        }
      )
      .subscribe();  // start listening

    return this.messageChannel;
  }

  // Send a new message to someone
  async sendMessage(receiverId: string, content: string): Promise<Message | null> {
    try {
      // Insert the message into the database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: this.currentUserId,       // who's sending
          receiver_id: receiverId,           // who's receiving
          content: content.trim(),           // the message (remove extra spaces)
        })
        .select()      // get the inserted message back
        .single();     // we expect only one message

      if (error) throw error;
      return data as Message;

    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  // Stop listening for messages (cleanup)
  unsubscribeFromMessages() {
    if (this.messageChannel) {
      this.messageChannel.unsubscribe();
      this.messageChannel = null;
    }
  }
}

// Helper function to create a new chat instance
export const createRealtimeChat = (userId: string) => {
  return new RealtimeChat(userId);
}; 