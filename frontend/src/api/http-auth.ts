import type {
  AuthTransport,
  AuthenticatedUser,
  RegistrationInput,
} from './auth-contract'
import { ApiError, apiRequest } from './client'

export const httpAuthTransport: AuthTransport = {
  async signup(input: RegistrationInput): Promise<void> {
    await apiRequest<void>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async login(input: { loginId: string; password: string }): Promise<AuthenticatedUser> {
    return apiRequest<AuthenticatedUser>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async currentUser(): Promise<AuthenticatedUser | null> {
    try {
      return await apiRequest<AuthenticatedUser>('/api/v1/auth/me', {
        method: 'GET',
      })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return null
      }
      throw error
    }
  },

  async logout(): Promise<void> {
    await apiRequest<void>('/api/v1/auth/logout', {
      method: 'POST',
    })
  },
}