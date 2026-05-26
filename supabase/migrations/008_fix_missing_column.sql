-- ============================================================
-- E-Barangay Portal - Fix Missing Column 
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add the missing reviewed_by column if it doesn't exist
alter table requests 
add column if not exists reviewed_by uuid references auth.users(id);

-- 2. Force refresh the schema cache
notify pgrst, 'reload schema';

-- 3. Verify the column exists now
select column_name, data_type 
from information_schema.columns 
where table_name = 'requests' 
and column_name = 'reviewed_by';
