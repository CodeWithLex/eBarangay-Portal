import { useState } from 'react'
import { Shield, Phone, Lock, CheckCircle, ChevronRight, ArrowLeft } from 'lucide-react'
import { auth } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STEP_MOBILE   = 'mobile'
const STEP_OTP      = 'otp'
const STEP_REGISTER = 'register'
const STEP_CONSENT  = 'consent'

const PUROKS = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6','Purok 7','Purok 8']

export default function LoginPage() {
  const { signIn, refreshProfile } = useAuth()
  const [step, setStep]       = useState(STEP_MOBILE)
  const [mobile, setMobile]   = useState('')
  const [otp, setOtp]         = useState(['','','','','',''])
  const [form, setForm]       = useState({ full_name: '', purok: '', barangay: 'Barangay Mabuhay' })
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [displayOtp, setDisplayOtp] = useState(null)
  const [verifiedData, setVerifiedData] = useState(null) // { userId, phone, isNewUser }

  // ── Step 1: Send OTP ───────────────────────────────
  async function handleSendOTP(e) {
    e.preventDefault()
    setError('')

    if (!/^09\d{9}$/.test(mobile)) {
      setError('Mangyaring maglagay ng tamang mobile number (09XXXXXXXXX).')
      return
    }

    setLoading(true)
    setDisplayOtp(null)
    const { error: err, displayOtp: code } = await auth.sendOTP(mobile)
    setLoading(false)

    if (err) { setError(err.message); return }
    setDisplayOtp(code)
    setOtp(['', '', '', '', '', ''])
    setStep(STEP_OTP)
  }

  // ── Step 2: Verify OTP ─────────────────────────────
  async function handleVerifyOTP(e) {
    e.preventDefault()
    setError('')
    const code = otp.join('')
    if (code.length < 6) { setError('Ilagay ang 6-digit OTP.'); return }

    setLoading(true)
    const { data, error: err } = await auth.verifyOTP(mobile, code)
    setLoading(false)

    if (err) { setError(err.message); return }

    setVerifiedData(data)

    if (data?.isNewUser || !data?.hasProfile) {
      // New user — collect registration info
      setStep(STEP_REGISTER)
    } else {
      // Existing user — load profile and go to dashboard
      await refreshProfile?.()
      signIn({ id: data.userId, mobile, role: 'resident' })
    }
  }

  // ── OTP input handling ─────────────────────────────
  function handleOtpChange(val, idx) {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[idx] = val
    setOtp(next)
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus()
  }

  function handleOtpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus()
    }
  }

  // ── Step 3: Registration form ──────────────────────
  function handleRegisterNext(e) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Ilagay ang iyong buong pangalan.'); return }
    if (!form.purok) { setError('Pumili ng Purok.'); return }
    setError('')
    setStep(STEP_CONSENT)
  }

  // ── Step 4: Consent → save profile + sign in ──────
  async function handleConsentSubmit(e) {
    e.preventDefault()
    if (!consent) { setError('Kinakailangan ang iyong pahintulot bago magpatuloy.'); return }
    setLoading(true)

    const userId   = verifiedData?.userId
    const { error: saveErr } = await auth.saveProfile({
      userId,
      fullName: form.full_name,
      mobile: `+63${mobile.slice(1)}`,
      purok: form.purok,
      barangay: form.barangay,
    })

    setLoading(false)

    if (saveErr) { setError(saveErr.message); return }

    // Refresh auth context so profile fields populate
    await refreshProfile?.()
    signIn({
      id: userId,
      full_name: form.full_name,
      mobile,
      purok: form.purok,
      barangay: form.barangay,
      role: 'resident',
    })
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 flex items-end md:items-center justify-center p-0 md:p-6">
      {/* Decorative top pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-white/10" />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-white/10" />
        <div className="absolute top-12 left-6 w-2 h-2 rounded-full bg-white/20" />
        <div className="absolute top-24 left-16 w-1 h-1 rounded-full bg-white/30" />
        <div className="absolute top-8 right-24 w-1.5 h-1.5 rounded-full bg-gold-400/40" />
      </div>

      <div className="w-full max-w-sm md:rounded-3xl bg-white overflow-hidden animate-fade-up">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-brand-800 to-brand-600 px-6 py-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-brand-200">E-Barangay</p>
              <h1 className="font-serif text-xl leading-tight">Resident Portal</h1>
            </div>
          </div>
          <p className="text-sm text-brand-100 leading-relaxed">
            Mag-request ng barangay documents nang mabilis, ligtas, at walang pila.
          </p>

          {/* Progress indicator */}
          <div className="flex gap-1.5 mt-5">
            {[STEP_MOBILE, STEP_OTP, STEP_REGISTER, STEP_CONSENT].map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-500 ${
                  [STEP_MOBILE, STEP_OTP, STEP_REGISTER, STEP_CONSENT].indexOf(step) >= i
                    ? 'bg-white flex-[2]'
                    : 'bg-white/30 flex-1'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form area */}
        <div className="px-6 py-6">
          {/* ── STEP: Mobile ── */}
          {step === STEP_MOBILE && (
            <form onSubmit={handleSendOTP} className="space-y-4 animate-fade-up">
              <div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">Ilagay ang iyong mobile number</h2>
                <p className="text-sm text-stone-500">Gagawa kami ng one-time password (OTP) para sa iyong numero.</p>
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  className="field pl-10"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  maxLength={11}
                  inputMode="numeric"
                  required
                />
              </div>
              {error && <ErrorMsg msg={error} />}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <>Magpadala ng OTP <ChevronRight className="w-4 h-4" /></>}
              </button>
              <p className="text-xs text-stone-400 text-center">
                Libre ang OTP (ipapakita sa susunod na screen, walang SMS). Protektado ng RA 10173 ang iyong numero.
              </p>
            </form>
          )}

          {/* ── STEP: OTP ── */}
          {step === STEP_OTP && (
            <form onSubmit={handleVerifyOTP} className="space-y-5 animate-fade-up">
              <div>
                <button type="button" onClick={() => setStep(STEP_MOBILE)} className="flex items-center gap-1 text-sm text-stone-400 mb-4 hover:text-stone-600">
                  <ArrowLeft className="w-4 h-4" /> Bumalik
                </button>
                <h2 className="text-lg font-bold text-stone-900 mb-1">I-verify ang OTP</h2>
                <p className="text-sm text-stone-500">
                  Ilagay ang 6-digit code para sa <strong>{mobile}</strong>.
                </p>
              </div>
              {displayOtp && (
                <div className="bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 text-center">
                  <p className="text-xs font-semibold text-brand-700 mb-1">Iyong OTP (libre — walang SMS)</p>
                  <p className="text-2xl font-bold font-mono tracking-[0.3em] text-brand-900">{displayOtp}</p>
                  <p className="text-xs text-brand-600 mt-1">Mag-e-expire sa 5 minuto</p>
                </div>
              )}
              <div className="flex gap-2 justify-between">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(e.target.value, i)}
                    onKeyDown={e => handleOtpKeyDown(e, i)}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-stone-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all bg-stone-50 focus:bg-white"
                  />
                ))}
              </div>
              {error && <ErrorMsg msg={error} />}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <>I-verify <Lock className="w-4 h-4" /></>}
              </button>
              <button type="button" onClick={handleSendOTP} className="w-full text-sm text-brand-600 font-medium">
                Hindi natanggap? Magpadala ulit
              </button>
            </form>
          )}

          {/* ── STEP: Register ── */}
          {step === STEP_REGISTER && (
            <form onSubmit={handleRegisterNext} className="space-y-4 animate-fade-up">
              <div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">Ikumpleto ang iyong profile</h2>
                <p className="text-sm text-stone-500">Unang pagkakataon mong mag-login.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Buong pangalan *</label>
                <input
                  className="field"
                  placeholder="Hal. Juan dela Cruz"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Purok *</label>
                <select
                  className="field"
                  value={form.purok}
                  onChange={e => setForm(f => ({ ...f, purok: e.target.value }))}
                  required
                >
                  <option value="">-- Pumili ng Purok --</option>
                  {PUROKS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Barangay</label>
                <input className="field bg-stone-100 cursor-not-allowed" value={form.barangay} readOnly />
              </div>
              {error && <ErrorMsg msg={error} />}
              <button type="submit" className="btn-primary">
                Susunod <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ── STEP: Consent ── */}
          {step === STEP_CONSENT && (
            <form onSubmit={handleConsentSubmit} className="space-y-4 animate-fade-up">
              <div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">Data Privacy Consent</h2>
                <p className="text-sm text-stone-500">Ayon sa RA 10173 — Data Privacy Act of 2012</p>
              </div>

              <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 space-y-2 text-sm text-brand-800">
                <p className="font-semibold text-brand-900">Ang iyong personal na impormasyon ay:</p>
                {[
                  'Kokolekyonin para sa proseso ng barangay documents',
                  'Itatago nang ligtas sa aming encrypted database',
                  'Hindi ibebenta o ibabahagi sa third parties',
                  'Maaaring suriin o burahin sa iyong kahilingan',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-brand-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded accent-brand-500 flex-shrink-0"
                />
                <span className="text-sm text-stone-600 group-hover:text-stone-900 transition-colors">
                  Sumasang-ayon ako na kolektahin at gamitin ang aking personal na impormasyon alinsunod sa{' '}
                  <strong>RA 10173 (Data Privacy Act of 2012)</strong> at ang patakaran ng barangay.
                </span>
              </label>

              {error && <ErrorMsg msg={error} />}
              <button type="submit" className="btn-primary" disabled={loading || !consent}>
                {loading ? <Spinner /> : <>Magsimula na <ChevronRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorMsg({ msg }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
      <span className="text-base">⚠️</span> {msg}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}
