"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/src/lib/auth-context";
import { supabase } from "@/src/lib/supabase";
import { createRealtimeChat, RealtimeChat, Message } from "@/src/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/src/components/theme/theme-toggle";
import { Plus, MessageCircle } from "lucide-react";

// What each conversation looks like in the sidebar
interface Conversation {
  id: string;                    // the other person's user ID
  participant_email: string;     // their email address
  participant_name?: string;     // their display name (optional)
  last_message?: string;         // the most recent message
  last_message_time?: string;    // when the last message was sent
}

export default function DashboardPage() {
  // Get the current logged-in user information
  const { user, profile, signOut } = useAuth();
  
  // State variables - these hold our app's data
  const [conversations, setConversations] = useState<Conversation[]>([]);     // list of all conversations
  const [activeConversation, setActiveConversation] = useState<string | null>(null);  // which conversation is open
  const [messages, setMessages] = useState<Message[]>([]);                   // messages in the current conversation
  const [newMessage, setNewMessage] = useState("");                          // what the user is typing
  const [searchEmail, setSearchEmail] = useState("");                        // email to start new chat with
  const [showNewChat, setShowNewChat] = useState(false);                     // whether to show new chat form
  const [loading, setLoading] = useState(true);                              // whether we're still loading data
  
  // References for real-time chat and auto-scrolling
  const realtimeChat = useRef<RealtimeChat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom of messages (so new messages are visible)
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load all conversations when the app starts
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Get all messages where current user is involved (either sending or receiving)
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`user_id.eq.${user.id},receiver_id.eq.${user.id}`)  // messages I sent OR received
        .order('created_at', { ascending: false });              // newest first

      if (error) throw error;

      // Find all unique people I've chatted with
      const partnerIds = new Set<string>();
      messagesData?.forEach((msg) => {
        // If I sent the message, the partner is the receiver
        // If I received the message, the partner is the sender
        const partnerId = msg.user_id === user.id ? msg.receiver_id : msg.user_id;
        if (partnerId) {
          partnerIds.add(partnerId);
        }
      });

      // If no conversations, just show empty state
      if (partnerIds.size === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get profile information for all conversation partners
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(partnerIds));

      if (profilesError) throw profilesError;

      // Create conversation list with last message info
      const conversationMap = new Map<string, Conversation>();
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Go through all messages to build conversation summaries
      messagesData?.forEach((msg) => {
        const isFromMe = msg.user_id === user.id;
        const partnerId = isFromMe ? msg.receiver_id : msg.user_id;
        const partnerProfile = profileMap.get(partnerId);

        // Only create conversation entry if we haven't seen this partner yet
        if (partnerId && !conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            id: partnerId,
            participant_email: partnerProfile?.email || '',
            participant_name: partnerProfile?.full_name || '',
            last_message: msg.content,
            last_message_time: msg.created_at
          });
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load all messages for a specific conversation
  const loadMessages = useCallback(async (partnerId: string) => {
    if (!user?.id) return;
    
    try {
      // Get all messages between me and this partner
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(user_id.eq.${user.id},receiver_id.eq.${partnerId}),and(user_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });  // oldest first for chat display

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [user?.id]);

  // Set up real-time message listening for the current conversation
  const subscribeToRealtimeMessages = useCallback(() => {
    if (!realtimeChat.current || !activeConversation) return;

    // Listen for new messages in this conversation
    realtimeChat.current.subscribeToMessages(activeConversation, (message: Message) => {
      setMessages(prev => {
        // Check if we already have this message (avoid duplicates)
        const exists = prev.find(m => m.id === message.id);
        if (exists) return prev;
        
        // Add the new message to our list
        return [...prev, message];
      });
      
      // Update the conversation list to show this as the latest message
      setConversations(prev => 
        prev.map(conv => 
          conv.id === message.user_id || conv.id === message.receiver_id
            ? { ...conv, last_message: message.content, last_message_time: message.created_at }
            : conv
        )
      );
    });
  }, [activeConversation]);

  // Set up real-time chat when user logs in
  useEffect(() => {
    if (user?.id) {
      // Create the chat instance
      realtimeChat.current = createRealtimeChat(user.id);
      
      // Cleanup when component unmounts
      return () => {
        if (realtimeChat.current) {
          realtimeChat.current.unsubscribeFromMessages();
        }
      };
    }
  }, [user?.id]);

  // Load conversations when user is ready
  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user?.id, loadConversations]);

  // When user selects a conversation, load its messages and start listening
  useEffect(() => {
    if (activeConversation && user?.id) {
      loadMessages(activeConversation);
      subscribeToRealtimeMessages();
    }
    
    // Cleanup when switching conversations
    return () => {
      if (realtimeChat.current) {
        realtimeChat.current.unsubscribeFromMessages();
      }
    };
  }, [activeConversation, user?.id, loadMessages, subscribeToRealtimeMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send a message to the current conversation partner
  const sendMessage = async () => {
    // Make sure we have everything needed to send a message
    if (!newMessage.trim() || !activeConversation || !user?.id || !realtimeChat.current) return;

    const messageContent = newMessage.trim();
    setNewMessage("");  // Clear the input box

    // Send the message through our real-time chat system
    console.log("sending message to : ", activeConversation)
    const sentMessage = await realtimeChat.current.sendMessage(activeConversation, messageContent);
    console.log("send message to : ", activeConversation)

    if (sentMessage) {
      // Add the message to our local list (it will also come through the real-time subscription)
      setMessages(prev => [...prev, sentMessage]);
    }
  };

  // Start a new conversation with someone by their email
  const startNewConversation = async () => {
    if (!searchEmail.trim()) return;

    try {
      // Find the user by their email
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', searchEmail.trim())
        .maybeSingle();

      if (error || !userData) {
        alert('User not found with that email address');
        return;
      }

      if (userData.id === user?.id) {
        alert('You cannot message yourself');
        return;
      }

      // Switch to this conversation
      setActiveConversation(userData.id);
      setShowNewChat(false);
      setSearchEmail("");
      
      // Add to conversations if not already there
      const existingConv = conversations.find(c => c.id === userData.id);
      if (!existingConv) {
        setConversations(prev => [{
          id: userData.id,
          participant_email: userData.email,
          participant_name: userData.full_name || '',
          last_message: '',
          last_message_time: ''
        }, ...prev]);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Show loading spinner while we load data
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Find the current conversation details for the header
  const activeConversationData = conversations.find(c => c.id === activeConversation);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 border-r bg-muted/40 flex flex-col">
        {/* Header with Messages title and + button */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-semibold">Messages</h1>
            <Button
              size="sm"
              onClick={() => setShowNewChat(!showNewChat)}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* New Chat Form (shown when + is clicked) */}
          {showNewChat && (
            <div className="space-y-2">
              <Input
                placeholder="Enter email address..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && startNewConversation()}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={startNewConversation} className="flex-1">
                  Start Chat
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewChat(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-auto">
          {conversations.length === 0 ? (
            // Empty state when no conversations
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Click + to start a new chat</p>
            </div>
          ) : (
            // List each conversation
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${
                  activeConversation === conv.id ? 'bg-muted' : ''
                }`}
              >
                <div className="font-medium text-sm">
                  {conv.participant_name || conv.participant_email}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conv.participant_email}
                </div>
                {conv.last_message && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {conv.last_message}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Bottom section with user info and sign out */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">{profile?.full_name || 'User'}</div>
              <div className="text-muted-foreground">{user?.email}</div>
            </div>
            <div className="flex gap-1">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversationData ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b">
              <h2 className="font-semibold">
                {activeConversationData.participant_name || activeConversationData.participant_email}
              </h2>
              <p className="text-sm text-muted-foreground">
                {activeConversationData.participant_email}
              </p>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.map((message) => {
                const isFromMe = message.user_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        isFromMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="break-words">{message.content}</div>
                      <div className="text-xs opacity-60 mt-1">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* This invisible div helps us scroll to the bottom */}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Area */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Empty state when no conversation is selected
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the sidebar or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}