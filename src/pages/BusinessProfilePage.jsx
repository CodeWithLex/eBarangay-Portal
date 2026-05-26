import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Briefcase, MapPin, Hash, Plus, CheckCircle, Trash2, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { BottomNav } from '../lib/BottomNav'

export default function BusinessProfilePage({ navigate }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ name: '', tin: '', type: '', address: '' })

  // Fetch businesses
  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses', user?.id],
    queryFn: async () => {
      if (!supabase) return []
      // Select businesses and join with their latest approved request
      const { data, error } = await supabase
        .from('business_profiles')
        .select(`
          *,
          requests(
            id, status, expires_at, document_type
          )
        `)
        .eq('owner_id', user.id)
        .order('name')
      if (error) throw error
      
      // Post-process to find latest request for each business
      return data.map(b => {
        const latest = (b.requests || [])
          .filter(r => r.status === 'approved')
          .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0]
        
        let needs_renewal = false
        if (latest?.expires_at) {
          const exp = new Date(latest.expires_at)
          const now = new Date()
          const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
          needs_renewal = diffDays <= 30
        }
        
        return { ...b, latest_request: latest, needs_renewal }
      })
    },
    enabled: !!user?.id
  })

  // Add business mutation
  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('business_profiles')
        .insert([{ ...payload, owner_id: user.id }])
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      setIsAdding(false)
      setForm({ name: '', tin: '', type: '', address: '' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('business_profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
    }
  })

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col max-w-sm mx-auto">
      <header className="bg-white border-b border-stone-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('home')}
            className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div>
            <h1 className="font-bold text-stone-900 text-base">Business Profiles</h1>
            <p className="text-xs text-stone-400">Manage your business records</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 space-y-6 pb-24">
        {isAdding ? (
          <div className="card animate-fade-up">
            <h3 className="font-bold text-stone-900 mb-4">Register New Business</h3>
            <div className="space-y-4">
              <div>
                <label className="section-label">Business Name</label>
                <input 
                  className="field" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Ex. Juan's Sari-Sari Store"
                />
              </div>
              <div>
                <label className="section-label">TIN (Optional)</label>
                <input 
                  className="field font-mono" 
                  value={form.tin} 
                  onChange={e => setForm({...form, tin: e.target.value})}
                  placeholder="000-000-000-000"
                />
              </div>
              <div>
                <label className="section-label">Business Type</label>
                <select 
                  className="field bg-white"
                  value={form.type}
                  onChange={e => setForm({...form, type: e.target.value})}
                >
                  <option value="">Select Type</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Corporation">Corporation</option>
                  <option value="Small Vendor">Small Vendor / Sari-Sari</option>
                </select>
              </div>
              <div>
                <label className="section-label">Address</label>
                <textarea 
                  className="field h-20 py-2" 
                  value={form.address} 
                  onChange={e => setForm({...form, address: e.target.value})}
                  placeholder="Street, Purok..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 text-stone-500 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => addMutation.mutate(form)}
                  disabled={!form.name || addMutation.isPending}
                  className="flex-2 btn-primary"
                >
                  {addMutation.isPending ? 'Saving...' : 'Register Business'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl flex items-center justify-center gap-2 text-stone-500 hover:border-brand-400 hover:text-brand-600 transition-all"
            >
              <Plus size={20} />
              <span className="font-bold text-sm">Add Business Profile</span>
            </button>

            <div className="space-y-4">
              {isLoading ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"/></div>
              ) : businesses.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-stone-200" />
                  <p className="text-sm text-stone-400">No businesses registered yet.</p>
                </div>
              ) : (
                businesses.map(b => (
                  <div key={b.id} className="card relative group animate-fade-up">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">
                        <Building2 size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-stone-900 truncate">{b.name}</h4>
                        <p className="text-xs text-stone-400 capitalize mb-2">{b.business_type || 'N/A'}</p>
                        
                        {b.needs_renewal && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[9px] font-bold text-amber-700 mb-3 animate-pulse">
                            <AlertTriangle size={10} /> Renewal Due: Expiring Soon
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                            <Hash size={10} /> <span>TIN: {b.tin || 'Not set'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                            <MapPin size={10} /> <span className="truncate">{b.address}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteMutation.mutate(b.id)}
                        className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav active="home" navigate={navigate} />
    </div>
  )
}
