import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export function useAuthStatus() {
  const me = useQuery(api.users.me)
  return {
    me,
    isLoading: me === undefined,
    isAuthenticated: Boolean(me),
  }
}
