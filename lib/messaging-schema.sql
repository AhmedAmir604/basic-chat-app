-- Update messages table for direct messaging
-- Add receiver_id column if it doesn't exist
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id uuid;

-- Safely add foreign key constraints only if they don't exist
DO $$ 
BEGIN
    -- Add receiver_id foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_receiver_id_fkey' 
        AND table_name = 'messages'
    ) THEN
        ALTER TABLE public.messages 
        ADD CONSTRAINT messages_receiver_id_fkey 
        FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Ensure sender constraint exists (user_id -> auth.users)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_user_id_fkey' 
        AND table_name = 'messages'
    ) THEN
        ALTER TABLE public.messages 
        ADD CONSTRAINT messages_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update policies for direct messaging
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.messages;

-- New policies for direct messaging
CREATE POLICY "Users can view their own messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sent messages" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sent messages" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- Add email column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Update the trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Update existing profiles with email from auth.users
UPDATE public.profiles 
SET email = auth_users.email
FROM auth.users AS auth_users
WHERE public.profiles.id = auth_users.id 
AND public.profiles.email IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver 
ON public.messages(user_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender 
ON public.messages(receiver_id, user_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
ON public.messages(created_at DESC);

-- Update profiles to ensure email is accessible
UPDATE public.profiles SET full_name = COALESCE(full_name, '') WHERE full_name IS NULL; 