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

export function statusPillClass(status) {
  const map = {
    pending:    'pill-pending',
    approved:   'pill-approved',
    rejected:   'pill-rejected',
    processing: 'pill-processing',
  }
  return `pill ${map[status] ?? 'pill-pending'}`
}
