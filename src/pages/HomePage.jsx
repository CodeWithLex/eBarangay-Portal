import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Bell, Plus, ChevronRight, FileText, Clock, CheckCircle, XCircle, Download, QrCode } from 'lucide-react'
import { requests } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatDate, statusPillClass, statusLabel } from '../lib/utils'
import { BottomNav } from '../lib/BottomNav'

export default function HomePage({ navigate }) {
  const { user, signOut } = useAuth()
  const [showNotif, setShowNotif] = useState(false)

  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ['requests', user?.id],
    queryFn: () => requests.list(user.id).then(r => r.data),
    enabled: !!user,
  })

  const pendingCount = reqs.filter(r => r.status === 'pending').length
  const approvedCount = reqs.filter(r => r.status === 'approved').length

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col max-w-sm mx-auto">
      {/* Top bar */}
      <header className="bg-white border-b border-stone-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={user?.full_name} size="md" />
            <div>
              <p className="font-bold text-stone-900 text-sm leading-tight">{user?.full_name}</p>
              <p className="text-xs text-stone-400">{user?.purok} · {user?.barangay}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotif(v => !v)}
              className="relative w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-stone-600" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notification dropdown */}
        {showNotif && (
          <div className="mt-3 bg-stone-50 rounded-2xl border border-stone-200 p-3 animate-fade-in">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Mga Abiso</p>
            {pendingCount > 0
              ? <p className="text-sm text-stone-700">Mayroon kang <strong>{pendingCount}</strong> pending na hiling.</p>
              : <p className="text-sm text-stone-500">Walang bagong abiso.</p>
            }
          </div>
        )}
      </header>

      {/* Summary stats */}
      <div className="px-4 pt-5 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pending" value={pendingCount} color="amber" icon={<Clock className="w-5 h-5" />} />
          <StatCard label="Approved" value={approvedCount} color="brand" icon={<CheckCircle className="w-5 h-5" />} />
        </div>
      </div>

      {/* Quick action */}
      <div className="px-4 py-3">
        <button
          onClick={() => navigate('request')}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" /> Mag-request ng Dokumento
        </button>
      </div>

      {/* Request list */}
      <div className="px-4 pb-6 flex-1">
        <p className="section-label mt-2">Aking mga hiling</p>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-stone-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && reqs.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Wala pang mga hiling.</p>
            <button onClick={() => navigate('request')} className="mt-3 text-sm text-brand-600 font-semibold">
              Mag-request ngayon →
            </button>
          </div>
        )}

        <div className="space-y-3">
          {reqs.map((req, i) => (
            <RequestCard
              key={req.id}
              req={req}
              delay={i * 80}
              onResubmit={() => navigate('request')}
            />
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <BottomNav active="home" navigate={navigate} onSignOut={signOut} />
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    brand: 'bg-brand-50 text-brand-600 border-brand-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  )
}

function RequestCard({ req, delay, onResubmit }) {
  return (
    <div
      className="card animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-stone-900 text-sm leading-snug flex-1">{req.document_type}</p>
        <span className={statusPillClass(req.status)}>{statusLabel(req.status)}</span>
      </div>

      <p className="text-xs text-stone-400 mb-1">{req.reference_no} · {formatDate(req.created_at)}</p>

      {req.status === 'pending' && (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-dot inline-block" />
          Naghihintay ng pag-apruba ng staff
        </p>
      )}

      {req.status === 'rejected' && req.remarks && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-xl px-3 py-2">{req.remarks}</p>
      )}

      {req.status === 'approved' && (
        <div className="flex gap-2 mt-3">
          <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-brand-50 text-brand-700 border border-brand-100 active:scale-95 transition-transform">
            <Download className="w-3.5 h-3.5" /> I-download
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-stone-50 text-stone-600 border border-stone-200 active:scale-95 transition-transform">
            <QrCode className="w-3.5 h-3.5" /> QR Code
          </button>
        </div>
      )}

      {req.status === 'rejected' && (
        <button
          onClick={onResubmit}
          className="mt-3 w-full text-xs font-semibold py-2 rounded-xl bg-stone-100 text-stone-700 active:scale-95 transition-transform"
        >
          Mag-resubmit →
        </button>
      )}
    </div>
  )
}

export function Avatar({ name = '', size = 'md' }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const sz = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sz} rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

