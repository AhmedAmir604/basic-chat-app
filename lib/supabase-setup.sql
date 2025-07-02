-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- Create messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create rooms table (for different chat rooms/channels)
create table if not exists public.rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create room_members table (for managing who's in which room)
create table if not exists public.room_members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, user_id)
);

-- Add room_id to messages table if it doesn't exist
do $$ 
begin
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'messages' and column_name = 'room_id') then
    alter table public.messages add column room_id uuid references public.rooms on delete cascade default null;
  end if;
end $$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- Drop existing policies if they exist (now that tables exist)
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

drop policy if exists "Messages are viewable by authenticated users" on public.messages;
drop policy if exists "Users can insert their own messages" on public.messages;
drop policy if exists "Users can update their own messages" on public.messages;
drop policy if exists "Users can delete their own messages" on public.messages;

drop policy if exists "Rooms are viewable by authenticated users" on public.rooms;
drop policy if exists "Authenticated users can create rooms" on public.rooms;
drop policy if exists "Room creators can update their rooms" on public.rooms;

drop policy if exists "Room members are viewable by authenticated users" on public.room_members;
drop policy if exists "Users can join rooms" on public.room_members;
drop policy if exists "Users can leave rooms" on public.room_members;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Create policies for messages
create policy "Messages are viewable by authenticated users" on public.messages
  for select using (auth.role() = 'authenticated');

create policy "Users can insert their own messages" on public.messages
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own messages" on public.messages
  for update using (auth.uid() = user_id);

create policy "Users can delete their own messages" on public.messages
  for delete using (auth.uid() = user_id);

-- Create policies for rooms
create policy "Rooms are viewable by authenticated users" on public.rooms
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create rooms" on public.rooms
  for insert with check (auth.uid() = created_by);

create policy "Room creators can update their rooms" on public.rooms
  for update using (auth.uid() = created_by);

-- Create policies for room_members
create policy "Room members are viewable by authenticated users" on public.room_members
  for select using (auth.role() = 'authenticated');

create policy "Users can join rooms" on public.room_members
  for insert with check (auth.uid() = user_id);

create policy "Users can leave rooms" on public.room_members
  for delete using (auth.uid() = user_id);

-- Create a function to handle new user registration
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user registration
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create a default "General" room (we'll create it manually after you sign up)
-- This will be created after the first user signs up 