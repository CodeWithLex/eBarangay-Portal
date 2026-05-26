import { auth } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const STEP_MOBILE   = 'mobile'
const STEP_OTP      = 'otp'
const STEP_REGISTER = 'register'
const STEP_CONSENT  = 'consent'

const PUROKS = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6','Purok 7','Purok 8']

const registrationSchema = z.object({
  full_name: z.string().min(3, "Masyadong maikli ang pangalan."),
  purok: z.string().min(1, "Pumili ng Purok."),
  date_of_birth: z.string().min(1, "Ilagay ang iyong kaarawan."),
  voter_status: z.boolean().default(false),
})

export default function LoginPage() {
  const { refreshProfile } = useAuth()
  const [step, setStep]       = useState(STEP_MOBILE)
  const [mobile, setMobile]   = useState('')
  const [otp, setOtp]         = useState(['','','','','',''])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [displayOtp, setDisplayOtp] = useState(null)
  const [verifiedData, setVerifiedData] = useState(null) // { userId, phone, isNewUser }

  // React Hook Form for Registration
  const { register, handleSubmit, watch, formState: { errors: formErrors } } = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: { full_name: '', purok: '', date_of_birth: '', voter_status: false }
  })

  // Watch for visual feedback
  const watchAll = watch()

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
      // Existing user — session is set; AuthContext loads profile from DB
      await refreshProfile?.()
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
  const [tempRegData, setTempRegData] = useState(null)
  function handleRegisterNext(data) {
    setTempRegData(data)
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
      fullName: tempRegData.full_name,
      mobile: `+63${mobile.slice(1)}`,
      purok: tempRegData.purok,
      birth_date: tempRegData.date_of_birth,
      voter_status: tempRegData.voter_status,
      is_verified: false, // Residents claiming to be voters must be verified by staff
      barangay: 'Barangay Mabuhay',
    })

    setLoading(false)

    if (saveErr) { setError(saveErr.message); return }

    // Session already set after OTP — reload profile from DB
    await refreshProfile?.()
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
            <form onSubmit={handleSubmit(handleRegisterNext)} className="space-y-4 animate-fade-up">
              <div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">Ikumpleto ang iyong profile</h2>
                <p className="text-sm text-stone-500">Unang pagkakataon mong mag-login.</p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-tight">Buong pangalan *</label>
                <input
                  {...register('full_name')}
                  className={`field transition-all duration-300 ${
                    formErrors.full_name ? 'border-red-400 focus:ring-red-100 ring-2 ring-red-500/10' : 
                    watchAll.full_name?.length >= 3 ? 'border-green-400 focus:ring-green-100 ring-2 ring-green-500/10' : ''
                  }`}
                  placeholder="Hal. Juan dela Cruz"
                />
                {formErrors.full_name && <p className="text-[10px] text-red-500 mt-1">{formErrors.full_name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-tight">Purok *</label>
                  <select
                    {...register('purok')}
                    className={`field ${formErrors.purok ? 'border-red-400' : ''}`}
                  >
                    <option value="">-- Pumili --</option>
                    {PUROKS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {formErrors.purok && <p className="text-[10px] text-red-500 mt-1">{formErrors.purok.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-tight">Birth Date *</label>
                  <input
                    type="date"
                    {...register('date_of_birth')}
                    className={`field ${formErrors.date_of_birth ? 'border-red-400' : ''}`}
                  />
                  {formErrors.date_of_birth && <p className="text-[10px] text-red-500 mt-1">{formErrors.date_of_birth.message}</p>}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${watchAll.voter_status ? 'bg-brand-50 border-brand-200' : 'bg-stone-50 border-stone-100'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('voter_status')}
                    className="w-5 h-5 rounded accent-brand-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-800">Rehistradong Voter?</p>
                    <p className="text-[10px] text-stone-400">Markahan kung ikaw ay residente at voter ng barangay.</p>
                  </div>
                </label>
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
