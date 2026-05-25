# E-Barangay Portal

A digital document-request system for barangay residents in the Philippines.

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **SMS**: Semaphore API (via Supabase Edge Functions)
- **Deployment**: Vercel

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Database

Run `supabase/migrations/001_initial_schema.sql` in your **Supabase → SQL Editor**.

### 3. Supabase Storage

Create a private bucket named `valid-ids` in **Storage** and apply the RLS policies at the bottom of the migration file.

### 4. Edge Functions (Semaphore SMS)

Deploy the Edge Functions and set their secrets in **Supabase → Edge Functions → Secrets**:

```
SEMAPHORE_API_KEY=your_key_from_semaphore.co
SEMAPHORE_SENDER_NAME=eBarangay
```

Deploy functions:

```bash
npx supabase functions deploy send-otp
npx supabase functions deploy verify-otp
```

### 5. Vercel Deployment

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project → Settings → Environment Variables**.

## Local Development

```bash
npm install
npm run dev
```

The app automatically falls back to **Mock Mode** when Supabase env vars are missing.

## Key Features

- 📱 Mobile OTP login via Semaphore SMS
- 📋 Request Barangay Clearance, Indigency, Residency, Business Clearance
- 📊 Track request status with timeline
- 🔍 QR code document verification (public)
- 🔒 Row-Level Security — residents can only see their own data
- 🧾 RA 10173 (Data Privacy Act) consent logging
