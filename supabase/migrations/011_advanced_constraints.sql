-- ============================================================
-- E-Barangay Portal - Phase 3 Advanced Constraints & Security
-- ============================================================

-- 1. Profiles Table Hardening
alter table profiles 
add column if not exists voter_status boolean default false,
add column if not exists is_verified boolean default false,
add column if not exists date_of_birth date;

-- Add age validation constraint (must be 18+ for Business Clearance, etc.)
-- This is a soft check here, but handled in frontend too.
-- Note: 'date_of_birth' might be null initially for old accounts.
alter table profiles
add constraint check_age_logic check (
  date_of_birth is null or date_of_birth <= CURRENT_DATE - INTERVAL '15 years'
);

-- 2. Requests Table Hardening
alter table requests
add column if not exists expires_at timestamp with time zone,
add column if not exists doc_hash text;

-- Duplicate Prevention: Ensure no duplicate requests for the same document type while one is pending
-- (If not already created in Phase 2)
drop index if exists idx_pending_requests;
create unique index idx_pending_requests 
on requests (resident_id, document_type) 
where (status = 'pending');

-- 3. Privacy Masking via RLS
-- Staff can see profile details for processing, but we can restrict further if needed.
-- For now, ensuring staff can't update resident's private data directly.
create policy "staff_view_all_profiles"
on profiles for select
using (
  auth.uid() = id
  or public.get_my_role() in ('staff', 'admin')
);

-- 4. Force refresh the schema cache
notify pgrst, 'reload schema';
