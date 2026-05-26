import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Users, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  ChevronRight, 
  MoreVertical,
  LogOut,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { supabase, requests } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatDate, formatTime } from '../lib/utils'

async function generateDocHash(req) {
  const data = `${req.reference_no}|${req.resident_id}|${req.document_type}|${req.created_at}`
  const encoder = new TextEncoder()
  const d = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', d)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function getExpiryDate(docType) {
  const date = new Date()
  if (docType.includes('Clearance')) {
    date.setMonth(date.getMonth() + 6)
  } else if (docType.includes('Indigency')) {
    date.setMonth(date.getMonth() + 3)
  } else {
    date.setMonth(date.getMonth() + 6)
  }
  return date.toISOString()
}

export default function StaffDashboard() {
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)

  // Fetch all requests via Edge Function (bypasses RLS for staff)
  const { data: allRequests = [], isLoading, error: queryError } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      if (!supabase) return []
      
      try {
        const { data, error } = await supabase.functions.invoke('get-staff-requests')
        
        if (error) {
          // Supabase invoke errors often hide the body. Let's try to parse it if possible
          console.error('[StaffDashboard] Edge Invoke Error:', error)
          throw new Error(data?.error || error.message || 'Access Denied')
        }
        
        if (data?.error) {
          console.error('[StaffDashboard] Edge Logic Error:', data.error)
          throw new Error(data.error)
        }
        
        console.log('[StaffDashboard] Success:', data?.count, 'requests')
        return data?.data ?? []
      } catch (err) {
        console.error('[StaffDashboard] Catching Error:', err)
        throw err
      }
    }
  })

  // Update status mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, remarks, releasing_date, doc_hash, expires_at }) => {
      const { data, error } = await requests.updateStatus(id, { 
        status, 
        remarks, 
        reviewed_by: user.id,
        releasing_date,
        doc_hash,
        expires_at
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] })
      setSelectedRequest(null)
    },
    onError: (err) => {
      console.error('[StaffDashboard] update error:', err)
      alert('Error updating request: ' + (err.message || 'Unknown error'))
    }
  })

  const filtered = allRequests.filter(r => {
    const matchesFilter = filter === 'all' || r.status === filter
    const matchesSearch = search === '' || 
      r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reference_no?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const stats = {
    total: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending').length,
    approved: allRequests.filter(r => r.status === 'approved').length,
  }

  return (
    <div className="min-h-dvh bg-stone-100 flex flex-col md:flex-row">
      {/* Sidebar (Mobile Top Bar / Desktop Side) */}
      <aside className="bg-brand-900 text-white w-full md:w-64 flex-shrink-0 flex flex-col pt-8 md:pt-12">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-none">E-Barangay</h1>
            <p className="text-[10px] text-brand-300 uppercase tracking-widest mt-1">Staff Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem active icon={<FileText size={18}/>} label="Requests" count={stats.pending}/>
          <NavItem icon={<Users size={18}/>} label="Residents" />
        </nav>

        <div className="p-4 mt-auto border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold">
              {user?.full_name?.split(' ').map(n=>n[0]).join('')}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{user?.full_name}</p>
              <p className="text-[10px] text-brand-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-stone-900">Document Requests</h2>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                className="w-full bg-stone-100 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-brand-500/20"
                placeholder="Search name or ref..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex bg-stone-100 rounded-xl p-1 shadow-inner">
              <FilterBtn active={filter === 'all'} label="All" onClick={() => setFilter('all')} />
              <FilterBtn active={filter === 'pending'} label="Pending" count={stats.pending} onClick={() => setFilter('pending')} />
            </div>
          </div>
        </header>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto p-6">
          {queryError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
              <p className="font-bold mb-1">⚠️ Database Error</p>
              <p className="font-mono text-xs">{queryError.message}</p>
              <p className="text-xs mt-2 text-red-600">Run <strong>006_staff_rls_fix.sql</strong> in Supabase SQL Editor to fix this.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              [1,2,3,4,5,6].map(i => <div key={i} className="h-40 rounded-2xl bg-white animate-pulse border border-stone-200" />)
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-20 text-center text-stone-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No requests found matching your filters.</p>
              </div>
            ) : (
              filtered.map(req => (
                <RequestCard 
                  key={req.id} 
                  req={req} 
                  onClick={() => setSelectedRequest(req)} 
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Review Modal */}
      {selectedRequest && (
        <ReviewModal 
          req={selectedRequest} 
          onClose={() => setSelectedRequest(null)}
          onUpdate={(data) => updateMutation.mutate({ id: selectedRequest.id, ...data })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  )
}

function NavItem({ icon, label, active, count }) {
  return (
    <button className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
      active ? 'bg-white text-brand-900 font-bold shadow-lg' : 'text-brand-300 hover:text-white hover:bg-white/5'
    }`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${active ? 'bg-brand-900 text-white' : 'bg-white/20 text-white'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function FilterBtn({ active, label, count, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] px-1 rounded-full ${active ? 'bg-brand-100 text-brand-700' : 'bg-stone-200 text-stone-500'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function RequestCard({ req, onClick }) {
  const statusStyles = {
    pending:  { icon: <Clock size={16}/>, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    approved: { icon: <CheckCircle size={16}/>, color: 'text-brand-600 bg-brand-50 border-brand-100' },
    rejected: { icon: <XCircle size={16}/>, color: 'text-red-600 bg-red-50 border-red-100' },
  }
  const s = statusStyles[req.status]
  
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl border border-stone-200 p-5 cursor-pointer hover:border-brand-400 hover:shadow-xl transition-all flex flex-col group animate-fade-up"
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${s.color}`}>
          {s.icon} {req.status}
        </span>
        <button className="text-stone-300 group-hover:text-stone-900 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <p className="font-bold text-stone-900 leading-tight mb-1">{req.document_type}</p>
      <p className="text-[10px] font-mono text-stone-400 mb-4">{req.reference_no}</p>

      <div className="mt-auto pt-4 border-t border-stone-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-500">
          {req.profiles?.full_name?.split(' ').map(n=>n[0]).join('')}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-stone-800 truncate">{req.profiles?.full_name}</p>
          <p className="text-[10px] text-stone-400">{formatDate(req.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({ req, onClose, onUpdate, isPending }) {
  const [remarks, setRemarks] = useState(req.remarks || '')
  const [releasingDate, setReleasingDate] = useState(req.releasing_date ? req.releasing_date.split('T')[0] : '')
  const [releasingTime, setReleasingTime] = useState(req.releasing_date ? new Date(req.releasing_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '09:00')
  
  const handleAction = async (status) => {
    if (status === 'rejected' && !remarks.trim()) {
      alert('Paki-input ang dahilan ng pag-reject.')
      return
    }

    let finalReleasingDate = null
    let doc_hash = null
    let expires_at = null

    if (status === 'approved') {
      if (releasingDate) {
        finalReleasingDate = `${releasingDate}T${releasingTime}:00Z`
      }
      // Generate security hash for tamper-proofing
      doc_hash = await generateDocHash(req)
      // Set validity period
      expires_at = getExpiryDate(req.document_type)
    }

    onUpdate({ 
      status, 
      remarks, 
      releasing_date: finalReleasingDate,
      doc_hash,
      expires_at
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-500">
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-900">Review Request</h3>
            <p className="text-[10px] text-stone-400 font-mono">{req.reference_no}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-xl transition-colors">
            <XCircle className="text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-8">
          {/* Details */}
          <div className="space-y-6">
            <section>
              <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-3">Resident Info</h4>
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 space-y-3">
                <DetailRow label="Full Name" value={req.profiles?.full_name} />
                <DetailRow label="Mobile" value={req.profiles?.mobile} />
                <DetailRow label="Address" value={`${req.profiles?.purok}, Barangay Mabuhay`} />
              </div>
            </section>

            <section>
              <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-3">Document Info</h4>
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 space-y-3">
                <DetailRow label="Type" value={req.document_type} />
                <DetailRow label="Purpose" value={req.purpose} />
                <DetailRow label="Applied" value={`${formatDate(req.created_at)} at ${formatTime(req.created_at)}`} />
              </div>
            </section>
          </div>

          {/* Evidence / ID */}
          <div className="flex flex-col">
            <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-3">Supporting Document (Valid ID)</h4>
            {req.file_url ? (
              <div className="relative flex-1 bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 group">
                {/* Fallback to text link if not image or for privacy */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-stone-300 mb-3" />
                  <p className="text-sm font-semibold text-stone-600 mb-1">Uploaded ID File</p>
                  <p className="text-xs text-stone-400 mb-4">{req.file_url}</p>
                  <a 
                    href={req.signed_id_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn-primary py-2 px-4 inline-flex items-center gap-2 text-xs"
                  >
                    View Full Document <ExternalLink size={14}/>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-sm font-bold text-red-700">No ID Uploaded</p>
                <p className="text-xs text-red-500 mt-1">Naisumite ang hiling nang walang kalakip na dokumento.</p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 tracking-widest block mb-2 px-1">Releasing Date & Time</label>
                <div className="flex gap-2">
                  <input 
                    type="date"
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-brand-500/20"
                    value={releasingDate}
                    onChange={e => setReleasingDate(e.target.value)}
                  />
                  <input 
                    type="time"
                    className="w-32 bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-brand-500/20"
                    value={releasingTime}
                    onChange={e => setReleasingTime(e.target.value)}
                  />
                </div>
                <p className="text-[9px] text-stone-400 mt-1 px-1">Petsa at oras kung kailan maaaring kunin ang dokumento.</p>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 tracking-widest block mb-2 px-1">Admin Remarks</label>
                <textarea 
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand-500/20 h-24 resize-none"
                  placeholder="Ex. Please bring original for verification, Approved for pickup on..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex gap-3">
          <button 
            disabled={isPending}
            onClick={() => handleAction('rejected')}
            className={`flex-1 py-3 px-4 rounded-xl border-2 border-red-100 text-red-700 text-xs font-bold hover:bg-red-50 transition-colors ${isPending ? 'opacity-50' : ''}`}
          >
            Reject Request
          </button>
          <button 
            disabled={isPending}
            onClick={() => handleAction('approved')}
            className={`flex-2 py-3 px-8 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 ${isPending ? 'opacity-50' : ''}`}
          >
            {isPending ? 'Processing...' : <><CheckCircle size={14}/> Approve Document</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-stone-400 font-medium">{label}</p>
      <p className="text-xs font-bold text-stone-800">{value || 'N/A'}</p>
    </div>
  )
}
