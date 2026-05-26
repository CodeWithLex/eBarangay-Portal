import { useAuth } from './AuthContext'

export function BottomNav({ active, navigate }) {
  const { signOut } = useAuth()
  const items = [
    { id: 'home',    label: 'Home',      icon: '⌂' },
    { id: 'request', label: 'Hiling',    icon: '+' },
    { id: 'track',   label: 'Subaybayan', icon: '☰' },
    { id: 'verify',  label: 'Verify QR', icon: '◫' },
    { id: 'logout',  label: 'Logout',    icon: '⎘' },
  ]
  
  return (
    <nav className="bg-white border-t border-stone-100 px-2 pb-safe sticky bottom-0" aria-label="Main navigation">
      <div className="flex">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'logout') signOut()
              else navigate(item.id)
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-semibold transition-colors ${
              active === item.id ? 'text-brand-600' : 'text-stone-400'
            } ${item.id === 'logout' ? 'hover:text-red-500' : ''}`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
        {/* Optional: Add Sign Out button help if needed */}
      </div>
    </nav>
  )
}
