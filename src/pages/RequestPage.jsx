import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, CheckCircle, FileText, ChevronDown, AlertCircle, Building2, User } from 'lucide-react'
import { supabase, requests, DOCUMENT_TYPES } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { BottomNav } from '../lib/BottomNav'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const requestSchema = z.object({
  document_type: z.string().min(1, "Mamili ng uri ng dokumento"),
  purpose: z.string().min(10, "Dapat ay hindi bababa sa 10 characters ang layunin"),
  age: z.string().min(1, "Ilagay ang edad"),
  occupation: z.string().min(1, "Ilagay ang trabaho"),
})

export default function RequestPage({ navigate }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef()

  const [stream, setStream] = useState('personal') // 'personal' or 'business'
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [file, setFile] = useState(null)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(null)

  // Fetch businesses for the selector
  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('business_profiles').select('*').eq('owner_id', user.id)
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  const { register, handleSubmit, watch, setValue, formState: { errors: formErrors } } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { 
      document_type: '', 
      purpose: '', 
      age: user?.birth_date ? (new Date().getFullYear() - new Date(user.birth_date).getFullYear()).toString() : '',
      occupation: user?.occupation || ''
    }
  })
  const watchDocType = watch('document_type')
  const watchPurpose = watch('purpose')

  const mutation = useMutation({
    mutationFn: async ({ data, file }) => {
      if (!user?.id) throw new Error('Hindi ka naka-login.')

      // Check for active (unexpired) documents of the same type
      const { data: existing } = await supabase
        .from('requests')
        .select('*')
        .eq('resident_id', user.id)
        .eq('document_type', data.document_type)
        .eq('status', 'approved')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (existing) {
        throw new Error(`Mayroon ka pang aktibong ${data.document_type} hanggang ${new Date(existing.expires_at).toLocaleDateString()}. Maaari mong i-download ang dati mong kopya sa Track page.`)
      }

      let file_url = null
      if (file && supabase) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('valid-ids')
          .upload(fileName, file, { upsert: false })

        if (uploadError) throw uploadError
        file_url = fileName
      }

      return requests.submit({
        document_type: data.document_type,
        purpose: data.purpose,
        resident_id: user.id,
        business_id: stream === 'business' ? selectedBusiness : null,
        file_url,
        metadata: {
          age: data.age,
          occupation: data.occupation,
          is_business: stream === 'business'
        },
        step: 'submitted'
      })
    },
    onSuccess: (result) => {
      if (result?.error) {
        setErrors({ submit: result.error.message })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setSuccess(result.data)
    },
    onError: (err) => {
      setErrors({ submit: err?.message || 'Hindi naisumite ang hiling. Subukan muli.' })
    },
  })

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    // Validate file type (PNG/JPG/PDF only — enforced on server too)
    const allowed = ['image/png', 'image/jpeg', 'application/pdf']
    if (!allowed.includes(f.type)) {
      setErrors(prev => ({ ...prev, file: 'Tanging PNG, JPG, o PDF lamang.' }))
      return
    }
    // Max 5MB
    if (f.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, file: 'Ang file ay hindi dapat lumampas sa 5MB.' }))
      return
    }
    setFile(f)
    setErrors(prev => ({ ...prev, file: undefined }))
  }

  async function onFormSubmit(data) {
    if (!file) {
      setErrors(prev => ({ ...prev, file: 'Kinakailangan ang valid ID.' }))
      return
    }
    if (!consent) {
      setErrors(prev => ({ ...prev, consent: 'Kinakailangan ang pahintulot.' }))
      return
    }
    setErrors({})
    mutation.mutate({ data, file })
  }

  // ── Success state ──────────────────────────────────
  if (success) {
    return (
      <div className="min-h-dvh bg-stone-50 flex flex-col max-w-sm mx-auto">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-up">
          <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-brand-500" />
          </div>
          <h2 className="font-serif text-2xl text-stone-900 mb-2">Natanggap!</h2>
          <p className="text-stone-500 text-sm mb-2">
            Ang iyong hiling para sa <strong>{success.document_type}</strong> ay naisumite na.
          </p>
          <div className="bg-brand-50 border border-brand-200 rounded-2xl px-5 py-4 my-4 w-full text-left">
            <p className="text-xs text-brand-600 font-semibold mb-1">Reference Number</p>
            <p className="font-bold text-brand-900 text-lg font-mono tracking-wider">{success.reference_no}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 w-full text-left mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Makatanggap ka ng SMS update sa iyong mobile number kapag may pagbabago ang status ng iyong hiling.
              </p>
            </div>
          </div>
          <button onClick={() => navigate('home')} className="btn-primary">
            Bumalik sa Home
          </button>
          <button onClick={() => navigate('track')} className="btn-secondary mt-2">
            Subaybayan ang Hiling
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col max-w-sm mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('home')}
            className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
            aria-label="Bumalik"
          >
            <ArrowLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div>
            <h1 className="font-bold text-stone-900 text-base">Bagong Hiling</h1>
            <p className="text-xs text-stone-400">I-fill out ang form sa ibaba</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 flex flex-col">
        <div className="flex-1 px-4 py-5 space-y-5">
          {/* Stream Selector */}
          <div className="flex bg-stone-100 rounded-2xl p-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => { setStream('personal'); setSelectedBusiness(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                stream === 'personal' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'
              }`}
            >
              <User size={14} /> Personal
            </button>
            <button
              type="button"
              onClick={() => setStream('business')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                stream === 'business' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'
              }`}
            >
              <Building2 size={14} /> Business
            </button>
          </div>

          {stream === 'business' && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <p className="section-label mb-2">Select Registered Business</p>
              {businesses.length === 0 ? (
                <div 
                  onClick={() => navigate('business')}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center cursor-pointer group"
                >
                  <p className="text-xs text-amber-700 mb-1">Wala pang nakarehistrong negosyo.</p>
                  <p className="text-[10px] font-bold text-amber-600 group-hover:underline">I-rehistro ang negosyo dito →</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {businesses.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBusiness(b.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        selectedBusiness === b.id ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white'
                      }`}
                    >
                      <Building2 size={14} className={selectedBusiness === b.id ? 'text-brand-600' : 'text-stone-400'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-800 truncate">{b.name}</p>
                        <p className="text-[9px] text-stone-400">{b.tin || 'No TIN'}</p>
                      </div>
                      {selectedBusiness === b.id && <CheckCircle size={14} className="text-brand-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Document type selector */}
          <div>
            <p className="section-label">Uri ng Dokumento</p>
            <div className="space-y-2">
              {DOCUMENT_TYPES.map(dt => {
                const isActive = watchDocType === dt.value
                return (
                  <label
                    key={dt.value}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      isActive
                        ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-500/10'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="radio"
                      {...register('document_type')}
                      value={dt.value}
                      className="sr-only"
                    />
                    <span className="text-xl" aria-hidden>{dt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isActive ? 'text-brand-800' : 'text-stone-800'}`}>
                        {dt.label}
                      </p>
                      <p className="text-xs text-stone-400">{dt.days} araw na trabaho</p>
                    </div>
                    {isActive && (
                      <CheckCircle className="w-5 h-5 text-brand-500 flex-shrink-0" />
                    )}
                  </label>
                )
              })}
            </div>
            {formErrors.document_type && <FieldError msg={formErrors.document_type.message} />}
          </div>

          {/* Purpose */}
          <div>
            <p className="section-label">Layunin / Purpose</p>
            <textarea
              {...register('purpose')}
              className={`field h-24 resize-none transition-all duration-300 ${
                formErrors.purpose ? 'border-red-400 ring-2 ring-red-500/10' : 
                watchPurpose?.length >= 10 ? 'border-green-400 ring-2 ring-green-500/10' : ''
              }`}
              placeholder="Hal. Para sa bagong trabaho, scholarship, PhilHealth application..."
              maxLength={300}
            />
            <div className="flex justify-between items-center mt-1">
              {formErrors.purpose ? <FieldError msg={formErrors.purpose.message} /> : <span />}
              <span className="text-xs text-stone-300">{watchPurpose?.length || 0}/300</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="section-label">Edad (Age)</p>
              <input 
                type="number"
                {...register('age')}
                className={`field ${formErrors.age ? 'border-red-400' : ''}`}
                placeholder="Hal. 25"
              />
              {formErrors.age && <FieldError msg={formErrors.age.message} />}
            </div>
            <div>
              <p className="section-label">Trabaho</p>
              <input 
                type="text"
                {...register('occupation')}
                className={`field ${formErrors.occupation ? 'border-red-400' : ''}`}
                placeholder="Hal. Magsasaka"
              />
              {formErrors.occupation && <FieldError msg={formErrors.occupation.message} />}
            </div>
          </div>

          {/* Valid ID / Business Document upload */}
          <div>
            <p className="section-label">{stream === 'business' ? 'DTI / Business Permit Proof' : 'Valid ID'}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload document"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                file
                  ? 'border-brand-400 bg-brand-50'
                  : errors.file
                  ? 'border-red-300 bg-red-50'
                  : 'border-stone-300 bg-white hover:border-brand-400 hover:bg-brand-50'
              }`}
            >
              {file ? (
                <>
                  <CheckCircle className="w-8 h-8 text-brand-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-brand-700">{file.name}</p>
                  <p className="text-xs text-brand-500 mt-1">{(file.size / 1024).toFixed(0)} KB · I-replace</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-700">
                    {stream === 'business' ? 'Mag-upload ng DTI/Permit' : 'Mag-upload ng Valid ID'}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">PNG, JPG, o PDF · Max 5MB</p>
                  <p className="text-xs text-stone-400">i-tap para pumili ng file</p>
                </>
              )}
            </button>
            <p className="text-xs text-stone-400 mt-1.5 pl-1">
              {stream === 'business' 
                ? 'Tinatanggap: DTI Certificate, Mayor\'s Permit, o BIR Registration'
                : 'Tinatanggap: PhilSys ID, Driver\'s License, Passport, Voter\'s ID'
              }
            </p>
            {errors.file && <FieldError msg={errors.file} />}
          </div>

          {/* RA 10173 Consent */}
          <div className={`rounded-2xl border p-4 transition-all ${consent ? 'bg-brand-50 border-brand-200' : 'bg-amber-50 border-amber-200'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-brand-500 flex-shrink-0"
                aria-describedby="consent-text"
              />
              <span id="consent-text" className="text-xs text-stone-600 leading-relaxed">
                Sumasang-ayon ako na ang aking personal na impormasyon at ang na-upload na ID ay gagamitin lamang para sa proseso ng hiling na ito, alinsunod sa{' '}
                <strong>RA 10173 (Data Privacy Act of 2012)</strong>.
              </span>
            </label>
            {errors.consent && <FieldError msg={errors.consent} />}
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              ⚠️ {errors.submit}
            </div>
          )}
        </div>

        {/* Submit footer */}
        <div className="px-4 pb-6 pt-2 bg-white border-t border-stone-100">
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Isinusumite...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" /> Isumite ang Hiling
              </>
            )}
          </button>
          <p className="text-xs text-stone-400 text-center mt-2">
            Matatanggap mo ang SMS confirmation pagkatapos ng submission.
          </p>
        </div>
      </form>

      <BottomNav active="request" navigate={navigate} />
    </div>
  )
}

function FieldError({ msg }) {
  return (
    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  )
}
