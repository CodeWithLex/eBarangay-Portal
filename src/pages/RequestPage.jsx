import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, CheckCircle, FileText, ChevronDown, AlertCircle } from 'lucide-react'
import { supabase, requests, DOCUMENT_TYPES } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { BottomNav } from '../lib/BottomNav'

export default function RequestPage({ navigate }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef()

  const [form, setForm] = useState({ document_type: '', purpose: '' })
  const [file, setFile] = useState(null)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(null)

  const mutation = useMutation({
    mutationFn: async ({ form, file }) => {
      let file_url = null
      if (file && supabase) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('valid-ids')
          .upload(fileName, file)

        if (uploadError) throw uploadError
        file_url = fileName
      }

      return requests.submit({
        ...form,
        resident_id: user.id,
        file_url
      })
    },
    onSuccess: ({ data, error }) => {
      if (error) { setErrors({ submit: error.message }); return }
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setSuccess(data)
    }
  })

  function validate() {
    const errs = {}
    if (!form.document_type)  errs.document_type = 'Pumili ng uri ng dokumento.'
    if (!form.purpose.trim()) errs.purpose = 'Ilagay ang layunin ng hiling.'
    if (!file)                errs.file = 'Kinakailangan ang valid ID.'
    if (!consent)             errs.consent = 'Kinakailangan ang pahintulot.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setErrors({})
    mutation.mutate({ form, file })
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

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 px-4 py-5 space-y-5">

          {/* Document type selector */}
          <div>
            <p className="section-label">Uri ng Dokumento</p>
            <div className="space-y-2">
              {DOCUMENT_TYPES.map(dt => (
                <label
                  key={dt.value}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    form.document_type === dt.value
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="doc_type"
                    value={dt.value}
                    checked={form.document_type === dt.value}
                    onChange={() => setForm(f => ({ ...f, document_type: dt.value }))}
                    className="sr-only"
                  />
                  <span className="text-xl" aria-hidden>{dt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${form.document_type === dt.value ? 'text-brand-800' : 'text-stone-800'}`}>
                      {dt.label}
                    </p>
                    <p className="text-xs text-stone-400">{dt.days} araw na trabaho</p>
                  </div>
                  {form.document_type === dt.value && (
                    <CheckCircle className="w-5 h-5 text-brand-500 flex-shrink-0" />
                  )}
                </label>
              ))}
            </div>
            {errors.document_type && <FieldError msg={errors.document_type} />}
          </div>

          {/* Purpose */}
          <div>
            <p className="section-label">Layunin / Purpose</p>
            <textarea
              className={`field h-24 resize-none ${errors.purpose ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              placeholder="Hal. Para sa bagong trabaho, scholarship, PhilHealth application..."
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              maxLength={300}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.purpose ? <FieldError msg={errors.purpose} /> : <span />}
              <span className="text-xs text-stone-300">{form.purpose.length}/300</span>
            </div>
          </div>

          {/* Valid ID upload */}
          <div>
            <p className="section-label">Valid ID</p>
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload valid ID"
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
                  <p className="text-sm font-semibold text-stone-700">Mag-upload ng Valid ID</p>
                  <p className="text-xs text-stone-400 mt-1">PNG, JPG, o PDF · Max 5MB</p>
                  <p className="text-xs text-stone-400">i-tap para pumili ng file</p>
                </>
              )}
            </button>
            <p className="text-xs text-stone-400 mt-1.5 pl-1">
              Tinatanggap: PhilSys ID, Driver's License, Passport, Voter's ID, SSS/GSIS ID
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
