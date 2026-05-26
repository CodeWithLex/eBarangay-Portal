-- Fix: profiles table created before consented_at was added
-- Run in Supabase → SQL Editor if you see:
-- "Could not find the 'consented_at' column of 'profiles'"

alter table public.profiles
  add column if not exists consented_at timestamptz;

-- Refresh PostgREST schema cache (Supabase picks this up automatically; run if still stale)
notify pgrst, 'reload schema';
