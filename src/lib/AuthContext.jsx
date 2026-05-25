import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch the profile from `profiles` table and merge with auth user
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser || !supabase) {
      setUser(authUser)
      return
    }
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      setUser(profile ? { ...authUser, ...profile } : authUser)
    } catch {
      setUser(authUser)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      // Mock mode — use whatever is in local state
      setLoading(false)
      return
    }

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      const authUser = data.session?.user ?? null
      loadProfile(authUser).finally(() => setLoading(false))
    })

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      loadProfile(authUser)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // Called after OTP verified + profile saved — manually set user state
  const signIn = (userData) => setUser(userData)

  // Reload profile from DB (e.g., after registration completes)
  const refreshProfile = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) await loadProfile(data.session.user)
  }, [loadProfile])

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
