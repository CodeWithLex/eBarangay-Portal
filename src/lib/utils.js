import { clsx } from 'clsx'

export const cn = (...args) => clsx(...args)

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fil-PH', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('fil-PH', {
    hour: '2-digit', minute: '2-digit'
  })
}

export function statusLabel(status) {
  const map = {
    pending:    'Pending',
    approved:   'Approved',
    rejected:   'Rejected',
    processing: 'Processing',
  }
  return map[status] ?? status
}

/** Convert PH mobile (09XXXXXXXXX) to E.164 (+639XXXXXXXXX) for Supabase Auth */
export function toE164PH(mobile) {
  const digits = String(mobile).replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+63${digits.slice(1)}`
  if (digits.length === 10 && digits.startsWith('9')) return `+63${digits}`
  if (mobile.startsWith('+')) return mobile
  return null
}

export function statusPillClass(status) {
  const map = {
    pending:    'pill-pending',
    approved:   'pill-approved',
    rejected:   'pill-rejected',
    processing: 'pill-processing',
  }
  return `pill ${map[status] ?? 'pill-pending'}`
}
