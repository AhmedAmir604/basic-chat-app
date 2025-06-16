"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/src/lib/auth-context";
import { supabase } from "@/src/lib/supabase";
import { createRealtimeChat, RealtimeChat, Message as RealtimeMessage } from "@/src/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/src/components/theme/theme-toggle";
import { Search, Plus, MessageCircle, Circle } from "lucide-react";

interface Conversation {
  id: string;
  participant_email: string;
  participant_name?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  is_online?: boolean;
}

interface Message {
  id: string;
  user_id: string;
  receiver_id: string;
  content: string;
  status?: 'sent' | 'delivered' | 'read';
  created_at: string;
  read_at?: string;
  sender_email?: string;
  receiver_email?: string;
}

export default function DashboardPage() {
  const { user, profile, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  // Realtime chat instance
  const realtimeChat = useRef<RealtimeChat | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize realtime chat
  useEffect(() => {
    if (user?.id) {
      realtimeChat.current = createRealtimeChat(user.id);
      console.log(realtimeChat.current)
      // Set user online when component mounts
      realtimeChat.current.setPresence(true);
      
      // Set user offline when component unmounts
      return () => {
        if (realtimeChat.current) {
          realtimeChat.current.setPresence(false);
          realtimeChat.current.unsubscribeAll();
        }
      };
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversation && user?.id) {
      loadMessages(activeConversation);
      subscribeToRealtimeMessages();
      subscribeToTypingIndicators();
    }
    
    return () => {
      if (realtimeChat.current) {
        realtimeChat.current.unsubscribeAll();
      }
    };
  }, [activeConversation, user?.id]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const subscribeToRealtimeMessages = () => {
    if (!realtimeChat.current || !activeConversation) return;

    realtimeChat.current.subscribeToMessages(activeConversation, (message: RealtimeMessage) => {
      setMessages(prev => {
        // Check if message already exists (avoid duplicates)
        const exists = prev.find(m => m.id === message.id);
        if (exists) {
          // Update existing message (for status updates)
          return prev.map(m => m.id === message.id ? { ...m, ...message } : m);
        }
        // Add new message
        return [...prev, message];
      });
      
      // Update conversations list with latest message
      loadConversations();
    });
  };

  const subscribeToTypingIndicators = () => {
    if (!realtimeChat.current || !activeConversation) return;

    realtimeChat.current.subscribeToTyping(activeConversation, (typing: boolean) => {
      setPartnerTyping(typing);
    });
  };

  const loadConversations = async () => {
    try {
      // Get all messages where user is sender or receiver
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`user_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique user IDs that this user has conversations with
      const partnerIds = new Set<string>();
      messagesData?.forEach((msg: any) => {
        const partnerId = msg.user_id === user?.id ? msg.receiver_id : msg.user_id;
        if (partnerId) {
          partnerIds.add(partnerId);
        }
      });

      // Get profiles for all conversation partners
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(partnerIds));

      if (profilesError) throw profilesError;

      // Get presence data for all partners
      const { data: presenceData, error: presenceError } = await supabase
        .from('user_presence')
        .select('user_id, is_online, last_seen')
        .in('user_id', Array.from(partnerIds));

      if (presenceError) {
        // Handle presence error silently - not critical for basic functionality
      }

      // Create conversation map
      const conversationMap = new Map<string, Conversation>();
      
      // Create a map of user profiles for quick lookup
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const presenceMap = new Map(presenceData?.map(p => [p.user_id, p]) || []);

      messagesData?.forEach((msg: any) => {
        const isFromMe = msg.user_id === user?.id;
        const partnerId = isFromMe ? msg.receiver_id : msg.user_id;
        const partnerProfile = profileMap.get(partnerId);
        const partnerPresence = presenceMap.get(partnerId);

        if (partnerId && !conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            id: partnerId,
            participant_email: partnerProfile?.email || '',
            participant_name: partnerProfile?.full_name || '',
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: 0,
            is_online: partnerPresence?.is_online || false
          });
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      // Handle conversation loading error silently
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (partnerId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(user_id.eq.${user?.id},receiver_id.eq.${partnerId}),and(user_id.eq.${partnerId},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      // Handle message loading error silently
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !user?.id || !realtimeChat.current) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    // Optimistic UI update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      receiver_id: activeConversation,
      content: messageContent,
      status: 'sent',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Send through realtime chat
    

    const sentMessage = await realtimeChat.current.sendMessage(activeConversation, messageContent);
    if (sentMessage) {
      // Replace optimistic message with real one
      setMessages(prev => 
        prev.map(m => 
          m.id === optimisticMessage.id ? sentMessage : m
        )
      );
    } else {
      // Remove optimistic message if failed
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    }

    // Stop typing indicator
    handleTyping(false);
    loadConversations();
  };

  const handleTyping = (typing: boolean) => {
    if (!realtimeChat.current || !activeConversation) return;

    if (typing) {
      // Clear existing timeout
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      
      // Set typing indicator
      if (!isTyping) {
        setIsTyping(true);
        realtimeChat.current.setTyping(activeConversation, true);
      }
      
      // Auto-stop typing after 3 seconds
      typingTimeout.current = setTimeout(() => {
        setIsTyping(false);
        realtimeChat.current?.setTyping(activeConversation, false);
      }, 3000);
    } else {
      // Stop typing immediately
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      setIsTyping(false);
      realtimeChat.current.setTyping(activeConversation, false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Trigger typing indicator
    if (e.target.value.trim()) {
      handleTyping(true);
    } else {
      handleTyping(false);
    }
  };

  const startNewConversation = async () => {
    if (!searchEmail.trim()) return;

    try {
      // Find user by email
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

      // Get user's online status
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('is_online')
        .eq('user_id', userData.id)
        .single();

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
          last_message_time: '',
          unread_count: 0,
          is_online: presenceData?.is_online || false
        }, ...prev]);
      }
    } catch (error) {
      // Handle conversation start error silently
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const activeConversationData = conversations.find(c => c.id === activeConversation);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/40 flex flex-col">
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

        {/* Conversations List */}
        <div className="flex-1 overflow-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Click + to start a new chat</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${
                  activeConversation === conv.id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">
                    {conv.participant_name || conv.participant_email}
                  </div>
                  {conv.is_online && (
                    <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  )}
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

        {/* User Info */}
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

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversationData ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">
                  {activeConversationData.participant_name || activeConversationData.participant_email}
                </h2>
                {activeConversationData.is_online && (
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {activeConversationData.participant_email}
                {activeConversationData.is_online && (
                  <span className="ml-2 text-green-600">Online</span>
                )}
              </p>
            </div>

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
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs opacity-60">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {isFromMe && message.status && (
                          <div className="text-xs opacity-60 ml-2">
                            {message.status === 'sent' && '✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'read' && '✓✓'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {partnerTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-sm opacity-60">Typing...</div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleInputChange}
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