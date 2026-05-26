# E-Barangay Portal

A digital document-request system for barangay residents in the Philippines.

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **OTP**: Free in-app codes (mobile number login, no SMS cost)
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

### 4. Edge Functions (free OTP)

Deploy the Edge Functions (no SMS API keys required):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-otp
npx supabase functions deploy verify-otp
```

**How OTP works:** User enters `09XXXXXXXXX` → server generates a 6-digit code → code is shown on the next screen (and stored in `otp_store` for 5 minutes). No Semaphore/Twilio needed.

### 5. Vercel Deployment

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project → Settings → Environment Variables**, then redeploy.

## Local Development

```bash
npm install
npm run dev
```

Without Supabase env vars, the app uses **Mock Mode** (random OTP shown in the UI).

## Key Features

- 📱 Mobile number login with free in-app OTP
- 📋 Request Barangay Clearance, Indigency, Residency, Business Clearance
- 📊 Track request status with timeline
- 🔍 QR code document verification (public)
- 🔒 Row-Level Security — residents can only see their own data
- 🧾 RA 10173 (Data Privacy Act) consent logging

## OTP troubleshooting

1. Run `001_initial_schema.sql` (creates `otp_store` table).
2. Deploy `send-otp` and `verify-otp`.
3. Enter a valid `09XXXXXXXXX` number — the OTP appears on the verify step.
