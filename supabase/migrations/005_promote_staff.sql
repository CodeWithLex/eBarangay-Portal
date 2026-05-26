-- ============================================================
-- E-Barangay Portal - Promote a user to STAFF or ADMIN
-- ============================================================

-- 1. Find the user by mobile number and set role to 'staff'
update profiles 
set role = 'staff' 
where mobile = '09XXXXXXXXX'; -- <-- CHANGE THIS to your login mobile number

-- 2. Verify the change
select id, full_name, mobile, role 
from profiles 
where mobile = '09XXXXXXXXX'; -- <-- CHANGE THIS to your login mobile number
