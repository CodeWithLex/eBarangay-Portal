-- ============================================================
-- E-Barangay Portal - Fix Staff Permissions (RLS)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Allow staff/admin to view all resident profiles
-- (Needed to show the resident's name on the Staff Dashboard)
create policy "staff: select all profiles"
on profiles for select
using (
  role in ('staff', 'admin') or 
  auth.uid() = id
);

-- 2. Allow staff/admin to see all requests from all residents
create policy "staff: select all requests"
on requests for select
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() and role in ('staff', 'admin')
  ) or 
  auth.uid() = resident_id
);

-- 3. Allow staff/admin to update (approve/reject) all requests
create policy "staff: update all requests"
on requests for update
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() and role in ('staff', 'admin')
  )
);
