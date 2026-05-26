-- ============================================================
-- E-Barangay Portal - Full Database Setup
-- Run this entire file in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. OTP Store (free in-app OTP — no SMS) ───────────────
create table if not exists otp_store (
  mobile      text primary key,
  code        text        not null,
  expires_at  timestamptz not null,
  attempts    int         default 0,
  created_at  timestamptz default now()
);
-- No RLS needed — only Edge Functions (service_role) access this table

-- ── 2. Profiles ────────────────────────────────────────────
create table if not exists profiles (
  id            uuid references auth.users on delete cascade primary key,
  full_name     text        not null,
  mobile        text unique not null,
  purok         text,
  barangay      text        default 'Barangay Mabuhay',
  municipality  text        default 'Tagum City',
  province      text        default 'Davao del Norte',
  role          text        default 'resident'
                  check (role in ('resident', 'staff', 'admin')),
  consented_at  timestamptz,
  created_at    timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles: own row"
  on profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Allow service_role (Edge Functions) full access
create policy "profiles: service_role"
  on profiles for all
  to service_role
  using (true) with check (true);

-- ── 3. Requests ────────────────────────────────────────────
create table if not exists requests (
  id            uuid        primary key default gen_random_uuid(),
  resident_id   uuid        references auth.users(id) on delete cascade not null,
  document_type text        not null,
  purpose       text        not null,
  status        text        default 'pending'
                  check (status in ('pending','approved','rejected')),
  reference_no  text        unique,
  remarks       text,
  qr_hash       text        unique,
  file_url      text,
  reviewed_by   uuid        references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table requests enable row level security;

create policy "requests: resident sees own"
  on requests for select
  using (auth.uid() = resident_id);

create policy "requests: resident inserts own"
  on requests for insert
  with check (auth.uid() = resident_id);

create policy "requests: staff can update"
  on requests for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('staff','admin')
    )
  );

-- Auto-generate reference_no on insert
create or replace function set_reference_no()
returns trigger language plpgsql as $$
begin
  new.reference_no :=
    'REF-' ||
    to_char(now(), 'YYYY') || '-' ||
    lpad((floor(random() * 89999) + 10000)::text, 5, '0');
  
  -- Generate unique qr_hash (short random string)
  new.qr_hash := encode(gen_random_bytes(6), 'hex');
  
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_reference_no on requests;
create trigger trg_reference_no
  before insert on requests
  for each row execute function set_reference_no();

-- Auto-update updated_at on any update
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at on requests;
create trigger trg_touch_updated_at
  before update on requests
  for each row execute function touch_updated_at();

-- ── 4. Consent Logs ─────────────────────────────────────────
create table if not exists consent_logs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id),
  mobile       text,
  full_name    text,
  consented_at timestamptz default now()
);

alter table consent_logs enable row level security;

create policy "consent_logs: own insert"
  on consent_logs for insert
  with check (auth.uid() = user_id);

create policy "consent_logs: service_role full"
  on consent_logs for all
  to service_role
  using (true) with check (true);

-- ============================================================
-- Run this in Supabase → Storage → Create bucket "valid-ids"
-- Then set it to PRIVATE and add this policy:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('valid-ids', 'valid-ids', false);
-- create policy "storage: own upload" on storage.objects for insert
--   with check (bucket_id = 'valid-ids' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "storage: own read" on storage.objects for select
--   using (bucket_id = 'valid-ids' and auth.uid()::text = (storage.foldername(name))[1]);
