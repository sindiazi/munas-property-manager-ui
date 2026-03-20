import axios from 'axios'

export const TOKEN_KEY = 'pm_auth_token'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
