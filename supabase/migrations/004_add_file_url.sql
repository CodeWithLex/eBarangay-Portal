-- Fix: requests table created before file_url was added
-- Run in Supabase → SQL Editor if you see:
-- "Could not find the 'file_url' column of 'requests'"

alter table public.requests
  add column if not exists file_url text;

notify pgrst, 'reload schema';
