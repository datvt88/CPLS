-- Supabase schema for CPLS

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text default 'user' check (role in ('user','vip')),
  created_at timestamptz default now()
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  signal text check (signal in ('BUY','SELL','HOLD')),
  confidence numeric,
  created_at timestamptz default now()
);
