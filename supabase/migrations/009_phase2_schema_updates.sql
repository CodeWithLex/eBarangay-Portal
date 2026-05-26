-- ============================================================
-- E-Barangay Portal - Phase 2 Schema Updates
-- ============================================================

-- 1. Update Profiles with extended fields
alter table profiles 
add column if not exists birth_date date,
add column if not exists occupation text;

-- 2. Update Requests with releasing date and flexible metadata
alter table requests
add column if not exists releasing_date timestamp with time zone,
add column if not exists metadata jsonb default '{}'::jsonb;

-- 3. Add a check to prevent duplicate pending requests of the same type for the same resident
-- We use a partial unique index for this
create unique index if not exists requests_single_pending_type_idx 
on requests (resident_id, document_type) 
where (status = 'pending');

-- 4. Force refresh the schema cache
notify pgrst, 'reload schema';
