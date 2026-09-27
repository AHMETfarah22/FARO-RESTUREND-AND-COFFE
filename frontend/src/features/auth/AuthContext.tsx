import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '@/lib/api'
import { hasPermission, workspaceFor, type Permission, type Workspace } from '@/lib/permissions'
import type { AuthResponse, User } from '@/types/api'

interface AuthState {
  user: User | null
  /** True until the stored token has been checked against /auth/me. */
  initializing: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: { fullName: string; email: string; phone?: string; password: string }) => Promise<User>
  logout: () => void
  updateUser: (user: User) => void
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(() => !!tokenStore.get())

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
  }, [])

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokenStore.get()) return
    const controller = new AbortController()
    api
      .get<User>('/auth/me', { signal: controller.signal })
      .then((r) => setUser(r.data))
      .catch(() => {
        if (!controller.signal.aborted) tokenStore.set(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setInitializing(false)
      })
    return () => controller.abort()
  }, [])

  // Expired or revoked token → back to login.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const accept = useCallback((response: AuthResponse) => {
    tokenStore.set(response.accessToken)
    setUser(response.user)
    return response.user
  }, [])

  const login = useCallback(
    async (email: string, password: string) => accept((await api.post<AuthResponse>('/auth/login', { email, password })).data),
    [accept],
  )

  const register = useCallback(
    async (input: { fullName: string; email: string; phone?: string; password: string }) =>
      accept((await api.post<AuthResponse>('/auth/register', input)).data),
    [accept],
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      login,
      register,
      logout,
      updateUser: setUser,
      can: (permission) => hasPermission(user?.roles, permission),
    }),
    [user, initializing, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** The signed-in user's workspace (admin, manager, waiter, cashier, kitchen or customer). */
export function useWorkspace(): Workspace {
  const { user } = useAuth()
  return user ? workspaceFor(user.roles) : 'customer'
}
