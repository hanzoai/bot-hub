import { useAuthContext } from './AuthContext'

/** Drop-in replacement for the old Convex-based useAuthStatus */
export function useAuthStatus() {
  const { user, loading, isAuthenticated } = useAuthContext()
  return {
    me: user,
    isLoading: loading,
    isAuthenticated,
  }
}
