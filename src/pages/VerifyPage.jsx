import { useState } from 'react'
import { ArrowLeft, QrCode, CheckCircle, XCircle, Search, Shield } from 'lucide-react'
import { verify } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { BottomNav } from '../lib/BottomNav'

// Public route: /verify/:hash — anyone can verify document authenticity.
// SECURITY: This endpoint returns ONLY public-safe fields.
// No mobile numbers, no full addresses, no sensitive data.

export default function VerifyPage({ navigate }) {
  const [hash, setHash] = useState('') 
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  async function handleVerify(e) {
    e.preventDefault()
    if (!hash.trim()) return
    setLoading(true)
    setChecked(false)
    const { data, error } = await verify.checkHash(hash.trim())
    setResult(error ? { error: error.message } : data)
    setChecked(true)
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col max-w-sm mx-auto">
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
            <h1 className="font-bold text-stone-900 text-base">I-verify ang QR</h1>
            <p className="text-xs text-stone-400">I-check ang katotohanan ng dokumento</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 space-y-5">
        {/* Security notice */}
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex gap-3">
          <Shield className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-800 mb-0.5">Secure Verification</p>
            <p className="text-xs text-brand-600 leading-relaxed">
              Ang page na ito ay nagpapakita lamang ng pampublikong impormasyon.
              Walang pribadong datos (mobile, address) ang ipinapakita.
            </p>
          </div>
        </div>

        {/* QR Scanner placeholder */}
        <div className="bg-stone-900 rounded-2xl aspect-square flex flex-col items-center justify-center gap-3">
          <QrCode className="w-16 h-16 text-stone-600" />
          <p className="text-stone-500 text-sm">QR Scanner Placeholder</p>
          <p className="text-stone-600 text-xs text-center px-8">
            Para sa production, i-install ang <code className="text-brand-400">html5-qrcode</code>.
          </p>
          <button 
            type="button"
            onClick={() => alert('Mangyaring ilagay ang code sa ibaba para sa demo.')}
            className="mt-1 text-xs text-brand-400 font-semibold border border-brand-700 px-4 py-2 rounded-xl"
          >
            I-activate ang Camera
          </button>
        </div>

        {/* Manual hash input */}
        <div>
          <p className="section-label">O ilagay ang verification code</p>
          <form onSubmit={handleVerify} className="flex gap-2">
            <input
              className="field flex-1"
              value={hash}
              onChange={e => setHash(e.target.value)}
              placeholder="Hal. abc123xyz789"
              aria-label="Verification hash"
            />
            <button
              type="submit"
              className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0"
              disabled={loading}
              aria-label="I-verify"
            >
              {loading
                ? <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <Search className="w-5 h-5 text-white" />
              }
            </button>
          </form>
          <p className="text-xs text-stone-400 mt-1.5 pl-1">
            Demo hash: <code className="font-mono text-brand-600">abc123xyz789</code>
          </p>
        </div>

        {/* Result */}
        {checked && result && !result.error && (
          <div className="card border-2 border-brand-300 animate-fade-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-brand-600" />
              </div>
              <div>
                <p className="font-bold text-brand-800">Authenticated</p>
                <p className="text-xs text-brand-600">Legítimong dokumento</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <VerifyRow label="Document Type" value={result.document_type} />
              <VerifyRow label="Reference No." value={result.reference_no} mono />
              <VerifyRow label="Status" value="Approved ✓" highlight />
              <VerifyRow label="Issued" value={formatDate(result.issued_date)} />
              <VerifyRow label="Barangay" value={result.barangay} />
              <VerifyRow label="Municipality" value={result.municipality} />
            </div>
            <div className="mt-4 pt-3 border-t border-stone-100">
              <p className="text-[10px] text-stone-400 text-center">
                Verified by E-Barangay Digital Platform · {new Date().toLocaleString('fil-PH')}
              </p>
            </div>
          </div>
        )}

        {checked && result?.error && (
          <div className="card border-2 border-red-200 animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-red-700">Hindi Nahanap</p>
                <p className="text-xs text-red-500">{result.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav active="verify" navigate={navigate} />
    </div>
  )
}

function VerifyRow({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-xs text-stone-400 flex-shrink-0">{label}</span>
      <span className={`text-sm text-right ${
        mono ? 'font-mono text-stone-700' :
        highlight ? 'font-bold text-brand-600' :
        'font-medium text-stone-800'
      }`}>
        {value}
      </span>
    </div>
  )
}
