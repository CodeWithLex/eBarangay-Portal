import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, CheckCircle, XCircle, FileText, Download, QrCode, RefreshCw } from 'lucide-react'
import { requests } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatDate, formatTime, statusLabel } from '../lib/utils'
import { BottomNav } from '../lib/BottomNav'

export default function TrackPage({ navigate }) {
  const { user } = useAuth()

  const { data: reqs = [], isLoading, refetch } = useQuery({
    queryKey: ['requests', user?.id],
    queryFn: () => requests.list(user.id).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30_000, // poll every 30s for status updates
  })

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col max-w-sm mx-auto">
      <header className="bg-white border-b border-stone-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('home')}
              className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
              aria-label="Bumalik"
            >
              <ArrowLeft className="w-4 h-4 text-stone-600" />
            </button>
            <div>
              <h1 className="font-bold text-stone-900 text-base">Subaybayan</h1>
              <p className="text-xs text-stone-400">Kasaysayan ng mga hiling</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
            aria-label="I-refresh"
          >
            <RefreshCw className="w-4 h-4 text-stone-500" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 py-5">
        {isLoading && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="card animate-pulse space-y-3">
                <div className="h-4 bg-stone-100 rounded w-3/4" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
                <div className="h-20 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && reqs.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-stone-200 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Walang mga hiling pa.</p>
            <button onClick={() => navigate('request')} className="mt-3 text-sm text-brand-600 font-semibold">
              Mag-request ngayon →
            </button>
          </div>
        )}

        <div className="space-y-4">
          {reqs.map((req, i) => (
            <TrackCard
              key={req.id}
              req={req}
              delay={i * 60}
              navigate={navigate}
            />
          ))}
        </div>
      </div>

      <BottomNav active="track" navigate={navigate} />
    </div>
  )
}

function TrackCard({ req, delay, navigate }) {
  const timeline = buildTimeline(req)

  return (
    <div
      className="card animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-stone-900 text-sm">{req.document_type}</p>
          <p className="text-xs text-stone-400 font-mono mt-0.5">{req.reference_no}</p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* Timeline */}
      <div className="border-l-2 border-stone-100 ml-2 pl-4 space-y-3 mb-3">
        {timeline.map((step, i) => (
          <div key={i} className="relative">
            <div className={`absolute -left-[21px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              step.done
                ? 'bg-brand-500 border-brand-500'
                : step.current
                ? 'bg-white border-amber-400'
                : 'bg-white border-stone-200'
            }`}>
              {step.done && <span className="text-white text-[8px]">✓</span>}
              {step.current && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-dot block" />}
            </div>
            <p className={`text-xs font-semibold ${step.done ? 'text-stone-700' : step.current ? 'text-amber-600' : 'text-stone-300'}`}>
              {step.label}
            </p>
            {step.time && (
              <p className="text-[10px] text-stone-400 mt-0.5">{step.time}</p>
            )}
          </div>
        ))}
      </div>

      {/* Rejection remarks or Uploaded ID */}
      {req.status === 'rejected' && req.remarks && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-xs font-semibold text-red-600 mb-0.5">Dahilan ng pagtanggi:</p>
          <p className="text-xs text-red-700">{req.remarks}</p>
        </div>
      )}

      {req.file_url && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <FileText className="w-3.5 h-3.5 text-stone-400" />
          <p className="text-[10px] text-stone-500 truncate">Uploaded ID: {req.file_url.split('/').pop()}</p>
        </div>
      )}

      {/* Actions */}
      {req.status === 'approved' && (
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-brand-500 text-white active:scale-95 transition-transform">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={() => navigate('verify')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl border border-brand-200 text-brand-700 bg-brand-50 active:scale-95 transition-transform"
          >
            <QrCode className="w-3.5 h-3.5" /> QR Verify
          </button>
        </div>
      )}

      {req.status === 'rejected' && (
        <button
          onClick={() => navigate('request')}
          className="w-full text-xs font-bold py-2.5 rounded-xl bg-stone-100 text-stone-700 active:scale-95 transition-transform"
        >
          Mag-resubmit →
        </button>
      )}

      {/* SMS reminder badge for pending */}
      {req.status === 'pending' && (
        <div className="mt-2 flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2 border border-stone-100">
          <span className="text-base">📱</span>
          <p className="text-xs text-stone-500">Aabisuhan ka via SMS kapag may update.</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const config = {
    pending:  { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" /> },
    approved: { bg: 'bg-brand-100', text: 'text-brand-700', icon: <CheckCircle className="w-3 h-3" /> },
    rejected: { bg: 'bg-red-100',   text: 'text-red-700',   icon: <XCircle className="w-3 h-3" /> },
  }
  const c = config[status] ?? config.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.icon} {statusLabel(status)}
    </span>
  )
}

function buildTimeline(req) {
  const submitted  = { label: 'Naisumite', time: formatDate(req.created_at) + ' · ' + formatTime(req.created_at), done: true }
  const reviewing  = { label: 'Sinusuri ng staff', time: null, done: ['approved','rejected'].includes(req.status), current: req.status === 'pending' }
  const approved   = {
    label: req.status === 'rejected' ? 'Tinanggihan' : 'Naaprubahan',
    time: req.updated_at !== req.created_at ? formatDate(req.updated_at) : null,
    done: ['approved','rejected'].includes(req.status),
    current: false
  }
  const ready = { label: 'Dokumento ay handa', time: null, done: req.status === 'approved', current: false }
  return [submitted, reviewing, approved, ready]
}
