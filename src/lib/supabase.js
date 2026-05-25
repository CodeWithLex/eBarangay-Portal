import { createClient } from '@supabase/supabase-js'
import { toE164PH } from './utils'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Initialize Supabase Client (only if env vars exist)
export const supabase =
  supabaseUrl && supabaseUrl !== 'your_supabase_url_here'
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

if (!supabase) {
  console.warn('Supabase credentials missing. App is running in MOCK mode.')
}

// ─────────────────────────────────────────────────────────
// Mock Data (fallback when no Supabase credentials)
// ─────────────────────────────────────────────────────────

const DEMO_USER = {
  id: 'res-001',
  full_name: 'Juan dela Cruz',
  mobile: '09171234567',
  purok: 'Purok 4',
  barangay: 'Barangay Mabuhay',
  municipality: 'Tagum City',
  province: 'Davao del Norte',
  role: 'resident',
}

const INITIAL_REQUESTS = [
  {
    id: 'req-001',
    resident_id: 'res-001',
    document_type: 'Barangay Clearance',
    purpose: 'Para sa bagong trabaho',
    status: 'approved',
    created_at: '2026-05-20T09:14:00Z',
    updated_at: '2026-05-21T10:30:00Z',
    reference_no: 'REF-2026-00412',
    reviewed_by: 'staff-001',
    remarks: null,
    qr_hash: 'abc123xyz789',
  },
  {
    id: 'req-002',
    resident_id: 'res-001',
    document_type: 'Certificate of Indigency',
    purpose: 'Para sa PhilHealth application',
    status: 'pending',
    created_at: '2026-05-25T14:22:00Z',
    updated_at: '2026-05-25T14:22:00Z',
    reference_no: 'REF-2026-00431',
    reviewed_by: null,
    remarks: null,
    qr_hash: null,
  },
]

let _requests = [...INITIAL_REQUESTS]
let _session = null

// ── Auth helpers ────────────────────────────────────────
export const auth = {
  // Send OTP — uses Semaphore Edge Function in production, mock in dev
  async sendOTP(mobile) {
    if (!supabase) {
      await delay(800)
      console.log(`[Mock] OTP sent to ${mobile}`)
      return { error: null }
    }

    const phone = toE164PH(mobile)
    if (!phone) return { error: { message: 'Invalid mobile number (use 09XXXXXXXXX).' } }

    // Call Supabase Edge Function → Semaphore API
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { mobile: phone },
    })

    if (error) return { error }
    if (data?.error) return { error: { message: data.error } }
    return { error: null }
  },

  // Verify OTP — Edge Function validates and creates/fetches auth user
  async verifyOTP(mobile, otp) {
    if (!supabase) {
      await delay(600)
      if (otp.length === 6) {
        _session = { user: DEMO_USER }
        return { data: { session: _session, user: DEMO_USER }, error: null }
      }
      return { data: null, error: { message: 'Invalid OTP' } }
    }

    const phone = toE164PH(mobile)
    if (!phone) return { data: null, error: { message: 'Invalid mobile number.' } }

    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { mobile: phone, otp: String(otp) },
    })

    if (error) return { data: null, error }
    if (data?.error) return { data: null, error: { message: data.error } }

    // Return userId + isNewUser for the login page to determine next step
    return { data, error: null }
  },

  // Check if a profile already exists for the current auth user
  async getProfile(userId) {
    if (!supabase) return { data: DEMO_USER, error: null }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  // Save profile + consent log after registration
  async saveProfile({ userId, fullName, mobile, purok, barangay }) {
    if (!supabase) {
      console.log('[Mock] Profile saved:', { userId, fullName, mobile, purok, barangay })
      return { error: null }
    }

    const profile = {
      id: userId,
      full_name: fullName,
      mobile,
      purok,
      barangay,
      consented_at: new Date().toISOString(),
    }

    // Upsert profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert([profile])

    if (profileErr) return { error: profileErr }

    // Log consent (RA 10173)
    await supabase.from('consent_logs').insert([{
      user_id: userId,
      mobile,
      full_name: fullName,
      consented_at: new Date().toISOString(),
    }])

    return { error: null }
  },

  async getSession() {
    if (!supabase) return { data: { session: _session }, error: null }
    return await supabase.auth.getSession()
  },

  async signOut() {
    if (!supabase) { _session = null; return { error: null } }
    return await supabase.auth.signOut()
  }
}

// ── Document Requests ───────────────────────────────────
export const requests = {
  async list(residentId) {
    if (!supabase) {
      return { data: _requests.filter(r => r.resident_id === residentId), error: null }
    }
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('resident_id', residentId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async submit(payload) {
    if (!supabase) {
      const newReq = { ...payload, id: `req-${Date.now()}`, status: 'pending', created_at: new Date().toISOString() }
      _requests.push(newReq)
      return { data: newReq, error: null }
    }
    const { data, error } = await supabase
      .from('requests')
      .insert([payload])
      .select()
      .single()
    return { data, error }
  },

  async getOne(id) {
    if (!supabase) {
      const req = _requests.find(r => r.id === id)
      return { data: req ?? null, error: req ? null : { message: 'Not found' } }
    }
    const { data, error } = await supabase.from('requests').select('*').eq('id', id).single()
    return { data, error }
  }
}

// ── QR Verification ─────────────────────────────────────
export const verify = {
  async checkHash(hash) {
    if (!supabase) {
      const req = _requests.find(r => r.qr_hash === hash && r.status === 'approved')
      if (!req) return { data: null, error: { message: 'Document not found or not yet approved.' } }
      return {
        data: {
          reference_no: req.reference_no,
          document_type: req.document_type,
          status: req.status,
          issued_date: req.updated_at,
          barangay: DEMO_USER.barangay,
          municipality: DEMO_USER.municipality,
        },
        error: null,
      }
    }

    const { data, error } = await supabase
      .from('requests')
      .select('reference_no, document_type, status, updated_at, profiles(barangay, municipality)')
      .eq('qr_hash', hash)
      .eq('status', 'approved')
      .single()

    if (error) return { data: null, error }

    return {
      data: {
        reference_no: data.reference_no,
        document_type: data.document_type,
        status: data.status,
        issued_date: data.updated_at,
        barangay: data.profiles?.barangay ?? 'Barangay Mabuhay',
        municipality: data.profiles?.municipality ?? '',
      },
      error: null,
    }
  }
}

// ── Helpers ─────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export const DOCUMENT_TYPES = [
  { value: 'Barangay Clearance',       label: 'Barangay Clearance',       icon: '📋', days: '1–2' },
  { value: 'Certificate of Indigency', label: 'Certificate of Indigency', icon: '🏥', days: '1–3' },
  { value: 'Certificate of Residency', label: 'Certificate of Residency', icon: '🏠', days: '1–2' },
  { value: 'Business Clearance',       label: 'Business Clearance',       icon: '🏢', days: '3–5' },
]
