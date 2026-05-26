-- ============================================================
-- E-Barangay Portal - COMPLETE Staff RLS Fix (v3 FINAL)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================
-- SELECT ALL → RUN
-- ============================================================

-- STEP 1: Confirm your role is set correctly
-- (If this returns empty or role='resident', Step 2 fixes it)
select id, full_name, mobile, role from profiles order by created_at;

-- STEP 2: Force set your number to 'staff'
-- Replace 09910856227 with YOUR login number if different
update profiles set role = 'staff' where mobile = '09910856227';
-- Also try with the +63 format just in case
update profiles set role = 'staff' where mobile = '+639910856227';

-- STEP 3: Create the role helper function (avoids infinite recursion)
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- STEP 4: Drop ALL existing select policies on requests and profiles
drop policy if exists "requests: resident sees own" on requests;
drop policy if exists "staff: select all requests" on requests;
drop policy if exists "staff: update all requests" on requests;
drop policy if exists "requests: staff can update" on requests;
drop policy if exists "requests: resident inserts own" on requests;
drop policy if exists "staff: select all profiles" on profiles;
drop policy if exists "profiles: own row" on profiles;

-- STEP 5: Recreate ALL policies cleanly
-- Profiles: own row OR staff can see all
create policy "profiles: own row or staff"
on profiles for select
using (
  auth.uid() = id
  or get_my_role() in ('staff', 'admin')
);

-- Requests: resident inserts own
create policy "requests: resident inserts own"
on requests for insert
with check (auth.uid() = resident_id);

-- Requests: resident sees own requests + staff sees all
create policy "requests: select"
on requests for select
using (
  auth.uid() = resident_id
  or get_my_role() in ('staff', 'admin')
);

-- Requests: staff can update (approve/reject)
create policy "requests: staff update"
on requests for update
using (
  get_my_role() in ('staff', 'admin')
);

-- STEP 6: Verify everything is correct
select 'Role check' as check_name, role from profiles where mobile in ('09910856227', '+639910856227')
union all
select 'Total requests', count(*)::text from requests;
