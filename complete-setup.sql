-- =====================================================
-- COMPLETE BASIC CHAT APPLICATION SETUP
-- Run this script in your fresh Supabase SQL Editor
-- =====================================================

-- =====================================
-- STEP 1: CREATE PROFILES TABLE
-- =====================================

-- Create profiles table to store user information
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles policies (everyone can see profiles, users can update their own)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================
-- STEP 2: CREATE MESSAGES TABLE
-- =====================================

-- Create messages table for chat messages
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure users can't message themselves
  CONSTRAINT different_users CHECK (user_id != receiver_id)
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create messages policies
-- Users can see messages where they are either sender or receiver
CREATE POLICY "messages_select_conversation" ON public.messages
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = receiver_id
  );

-- Users can send messages (insert) as themselves
CREATE POLICY "messages_insert_as_sender" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    user_id IS NOT NULL AND 
    receiver_id IS NOT NULL
  );

-- Users can update their own sent messages
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own sent messages
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- =====================================

-- Index for fast conversation lookups
CREATE INDEX idx_messages_conversation 
ON public.messages(user_id, receiver_id, created_at DESC);

-- Index for reverse conversation lookups
CREATE INDEX idx_messages_reverse_conversation 
ON public.messages(receiver_id, user_id, created_at DESC);

-- Index for profile email lookups
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- =====================================
-- STEP 4: CREATE AUTO-PROFILE FUNCTION
-- =====================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run the function when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================
-- STEP 5: ENABLE REAL-TIME
-- =====================================

-- Enable real-time for messages table (this is crucial!)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- =====================================
-- STEP 7: VERIFICATION QUERIES
-- =====================================

-- Check if everything was created correctly
DO $$
BEGIN
  RAISE NOTICE '✅ SETUP COMPLETE! Here is what was created:';
  RAISE NOTICE '📋 Tables: profiles, messages';
  RAISE NOTICE '🔒 RLS: Enabled with proper policies';
  RAISE NOTICE '⚡ Real-time: Enabled for messages';
  RAISE NOTICE '🔧 Triggers: Auto-create profiles on signup';
  RAISE NOTICE '📊 Indexes: Optimized for chat performance';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your chat app should now work!';
  RAISE NOTICE '📝 Next steps:';
  RAISE NOTICE '   1. Test user signup/login';
  RAISE NOTICE '   2. Try sending messages';
  RAISE NOTICE '   3. Check real-time message delivery';
END $$;

-- Show current table structure (simplified)
SELECT 
  'profiles' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'

UNION ALL

SELECT 
  'messages' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' AND table_schema = 'public'
ORDER BY table_name, column_name; 