-- Basic Realtime Chat Schema Updates
-- Add these to your existing Supabase database

-- 1. Add message status to existing messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
-- Possible values: 'sent', 'delivered', 'read'

-- 2. Add read timestamp
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 3. Create typing indicators table (basic)
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, conversation_partner_id)
);

-- 4. Create user presence table (basic online/offline)
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS on new tables
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for typing indicators
CREATE POLICY "Users can view typing indicators in their conversations" ON public.typing_indicators
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = conversation_partner_id
  );

CREATE POLICY "Users can manage their own typing indicators" ON public.typing_indicators
  FOR ALL USING (auth.uid() = user_id);

-- 7. Create policies for user presence
CREATE POLICY "Users can view all user presence" ON public.user_presence
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own presence" ON public.user_presence
  FOR ALL USING (auth.uid() = user_id);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation ON public.typing_indicators(user_id, conversation_partner_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON public.user_presence(is_online);

-- 9. Create function to auto-update typing indicator timestamp
CREATE OR REPLACE FUNCTION update_typing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger for typing indicators
DROP TRIGGER IF EXISTS update_typing_timestamp_trigger ON public.typing_indicators;
CREATE TRIGGER update_typing_timestamp_trigger
  BEFORE UPDATE ON public.typing_indicators
  FOR EACH ROW EXECUTE FUNCTION update_typing_timestamp();

-- 11. Create function to auto-update user presence timestamp
CREATE OR REPLACE FUNCTION update_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create trigger for user presence
DROP TRIGGER IF EXISTS update_presence_timestamp_trigger ON public.user_presence;
CREATE TRIGGER update_presence_timestamp_trigger
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION update_presence_timestamp(); 