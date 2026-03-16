'use client'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { authApi } from '@/lib/api/auth.api'
import { TOKEN_KEY } from '@/lib/api/client'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  initialize: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null }, false, 'auth/login/pending')
        try {
          const response = await authApi.login(username, password)
          const { token, user } = response
          localStorage.setItem(TOKEN_KEY, token)
          document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; samesite=lax`
          set({ user, token, isAuthenticated: true, isLoading: false }, false, 'auth/login/success')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Login failed'
          set({ isLoading: false, error: message }, false, 'auth/login/error')
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
        set({ user: null, token: null, isAuthenticated: false, error: null }, false, 'auth/logout')
        window.location.href = '/login'
      },

      initialize: async () => {
        if (typeof window === 'undefined') return
        const token = localStorage.getItem(TOKEN_KEY)
        if (!token) {
          // Ensure stale cookies are cleared so middleware doesn't redirect /login → /
          document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
          set({ isLoading: false }, false, 'auth/initialize/no-token')
          return
        }
        set({ isLoading: true }, false, 'auth/initialize/pending')
        try {
          const user = await authApi.getMe()
          set({ user, token, isAuthenticated: true, isLoading: false }, false, 'auth/initialize/success')
        } catch {
          localStorage.removeItem(TOKEN_KEY)
          document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
          set({ user: null, token: null, isAuthenticated: false, isLoading: false }, false, 'auth/initialize/invalid')
        }
      },

      clearError: () => set({ error: null }, false, 'auth/clearError'),
    }),
    { name: 'auth-store' }
  )
)
