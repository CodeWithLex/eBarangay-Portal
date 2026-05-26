-- ============================================================
-- E-Barangay Portal - Phase 4 EBARANGAY Module & Business
-- ============================================================

-- 1. Business Profiles Table
create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  tin text,
  business_type text,
  address text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS for Business Profiles
alter table business_profiles enable row level security;

create policy "users_view_own_businesses"
on business_profiles for select
using (auth.uid() = owner_id);

create policy "users_manage_own_businesses"
on business_profiles for all
using (auth.uid() = owner_id);

create policy "staff_view_all_businesses"
on business_profiles for select
using (public.get_my_role() in ('staff', 'admin'));

-- 2. Requests Table Updates for Business Stream
do $$ 
begin 
  if not exists (select 1 from pg_type where typname = 'request_step') then
    create type request_step as enum ('submitted', 'reviewing', 'payment', 'ready');
  end if;
end $$;

alter table requests 
add column if not exists business_id uuid references business_profiles(id) on delete set null,
add column if not exists payment_status text default 'unpaid',
add column if not exists step request_step default 'submitted';

-- Ensure real-time is enabled for requests (usually enabled at project level, but good practice to note)
-- ALTER PUBLICATION supabase_realtime ADD TABLE requests;

-- 3. Historical Read-Only View (already handled by requests table, but we ensure it persists)

-- 4. Reload Schema cache
notify pgrst, 'reload schema';
