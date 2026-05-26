import { useState } from 'react'
import { useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import RequestPage from './pages/RequestPage'
import TrackPage from './pages/TrackPage'
import VerifyPage from './pages/VerifyPage'
import StaffDashboard from './pages/StaffDashboard'

// Simple in-app navigation (replace with React Router in production)
export default function App() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('home')
  const needsProfile = Boolean(user && (!user.full_name || !user.purok || !user.barangay))

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-brand-900">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl">⚑</span>
          </div>
          <p className="text-brand-200 text-sm">Naglo-load...</p>
        </div>
      </div>
    )
  }

  if (!user || needsProfile) return <LoginPage />

  const navigate = (p) => setPage(p)

  const pages = {
    home:    user.role === 'resident' ? <HomePage navigate={navigate} /> : <StaffDashboard />,
    request: <RequestPage navigate={navigate} />,
    track:   <TrackPage   navigate={navigate} />,
    verify:  <VerifyPage  navigate={navigate} />,
    staff:   <StaffDashboard />
  }

  return pages[page] ?? pages.home
}
