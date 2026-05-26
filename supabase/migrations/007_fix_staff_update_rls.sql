-- ============================================================
-- E-Barangay Portal - Fix Staff UPDATE Permissions
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Drop ALL existing update policies on requests to start clean
drop policy if exists "requests: staff update" on requests;
drop policy if exists "requests: staff can update" on requests;
drop policy if exists "staff: update all requests" on requests;

-- 2. Create a robust UPDATE policy for staff/admin
-- Using both USING and WITH CHECK ensures the operation is allowed
create policy "staff_can_update_requests"
on requests for update
to authenticated
using (
  public.get_my_role() in ('staff', 'admin')
)
with check (
  public.get_my_role() in ('staff', 'admin')
);

-- 3. Just to be safe, also allow staff to view all profiles 
-- (if they can't see the profiles, the join in the Edge Function might fail for them)
-- (This should already be in 006, but repeating doesn't hurt)
drop policy if exists "staff_can_view_profiles" on profiles;
create policy "staff_can_view_profiles"
on profiles for select
using (
  auth.uid() = id
  or public.get_my_role() in ('staff', 'admin')
);
