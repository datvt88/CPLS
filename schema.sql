-- Supabase schema for CPLS

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  nickname text,  -- Display name for chat rooms and real-time messaging
  phone_number text,
  stock_account_number text,
  avatar_url text,
  zalo_id text unique,
  membership text default 'free' check (membership in ('free','premium')),
  membership_expires_at timestamptz,
  tcbs_api_key text,
  tcbs_connected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint nickname_length_check check (nickname is null or (char_length(nickname) >= 2 and char_length(nickname) <= 50))
);

-- Index for faster lookup by zalo_id
create index if not exists idx_profiles_zalo_id on profiles(zalo_id);

-- Index for faster lookup by phone_number
create index if not exists idx_profiles_phone_number on profiles(phone_number);

-- Index for faster lookup by nickname (useful for chat rooms)
create index if not exists idx_profiles_nickname on profiles(nickname);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_profiles_updated_at
  before update on profiles
  for each row
  execute function update_updated_at_column();

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  signal text check (signal in ('BUY','SELL','HOLD')),
  confidence numeric,
  created_at timestamptz default now()
);
