-- COMPLETE RESET AND FIX FOR CHAT APPLICATION RLS POLICIES
-- This script will clean up all existing policies and create a working bidirectional chat system

-- =====================================
-- STEP 1: CLEAN UP ALL EXISTING POLICIES
-- =====================================

-- Disable RLS temporarily for cleanup
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.messages;

DROP POLICY IF EXISTS "Rooms are viewable by authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room creators can update their rooms" ON public.rooms;

DROP POLICY IF EXISTS "Room members are viewable by authenticated users" ON public.room_members;
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_members;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_members;

-- Clean up typing indicators and user presence tables
DROP TABLE IF EXISTS public.typing_indicators CASCADE;
DROP TABLE IF EXISTS public.user_presence CASCADE;

-- =====================================
-- STEP 2: ENSURE PROPER SCHEMA
-- =====================================

-- Ensure messages table has all required columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Add foreign key constraints safely
DO $$ 
BEGIN
    -- Drop existing constraints if they exist to avoid conflicts
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
    
    -- Add fresh constraints
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- Create typing indicators table
CREATE TABLE public.typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, conversation_partner_id)
);

-- Create user presence table
CREATE TABLE public.user_presence (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- STEP 3: CREATE SIMPLE, RELIABLE RLS POLICIES
-- =====================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES (Simple and clear)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- MESSAGES POLICIES (Bidirectional messaging)
CREATE POLICY "messages_select_conversation" ON public.messages
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = receiver_id
  );

CREATE POLICY "messages_insert_as_sender" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    user_id IS NOT NULL AND 
    receiver_id IS NOT NULL AND
    user_id != receiver_id
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- TYPING INDICATORS POLICIES
CREATE POLICY "typing_select_conversation" ON public.typing_indicators
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = conversation_partner_id
  );

CREATE POLICY "typing_manage_own" ON public.typing_indicators
  FOR ALL USING (auth.uid() = user_id);

-- USER PRESENCE POLICIES
CREATE POLICY "presence_select_all" ON public.user_presence
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "presence_manage_own" ON public.user_presence
  FOR ALL USING (auth.uid() = user_id);

-- ROOM POLICIES (if you need them later)
CREATE POLICY "rooms_select_authenticated" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rooms_insert_authenticated" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "rooms_update_creator" ON public.rooms
  FOR UPDATE USING (auth.uid() = created_by);

-- ROOM MEMBERS POLICIES
CREATE POLICY "room_members_select_authenticated" ON public.room_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "room_members_insert_self" ON public.room_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "room_members_delete_self" ON public.room_members
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================
-- STEP 4: CREATE PERFORMANCE INDEXES
-- =====================================

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON public.messages(user_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_reverse_conversation 
ON public.messages(receiver_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_status 
ON public.messages(status);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_lookup 
ON public.typing_indicators(user_id, conversation_partner_id);

CREATE INDEX IF NOT EXISTS idx_user_presence_online 
ON public.user_presence(is_online, last_seen);

-- =====================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- =====================================

-- Function to update typing indicator timestamp
CREATE OR REPLACE FUNCTION update_typing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update presence timestamp  
CREATE OR REPLACE FUNCTION update_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS update_typing_timestamp_trigger ON public.typing_indicators;
CREATE TRIGGER update_typing_timestamp_trigger
  BEFORE UPDATE ON public.typing_indicators
  FOR EACH ROW EXECUTE FUNCTION update_typing_timestamp();

DROP TRIGGER IF EXISTS update_presence_timestamp_trigger ON public.user_presence;
CREATE TRIGGER update_presence_timestamp_trigger
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION update_presence_timestamp();

-- =====================================
-- STEP 6: TEST THE POLICIES
-- =====================================

-- These should work after running the script:
-- 1. Users can see their own profiles and others' profiles
-- 2. Users can send messages to other users
-- 3. Users can see messages in conversations they're part of
-- 4. Users cannot see messages from conversations they're not in
-- 5. Users can update their typing status
-- 6. Users can see when others are typing to them

-- =====================================
-- COMPLETION MESSAGE
-- =====================================

DO $$
BEGIN
  RAISE NOTICE 'RLS policies have been reset and configured for bidirectional messaging!';
  RAISE NOTICE 'You can now:';
  RAISE NOTICE '1. Send messages between users';
  RAISE NOTICE '2. Receive messages in real-time';
  RAISE NOTICE '3. See typing indicators';
  RAISE NOTICE '4. Track user presence';
  RAISE NOTICE 'All policies are clean and optimized for performance.';
END $$; 