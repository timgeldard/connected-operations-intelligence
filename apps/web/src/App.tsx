import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthScopeProvider } from '@connectio/auth-scope'
import type { UserIdentity } from '@connectio/auth-scope'
import { ShellLayout } from './shell/ShellLayout.js'
import { useManifestHydration } from './registry/useManifestHydration.js'
import { FeedbackProvider } from './feedback/FeedbackContext.js'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
})

interface SessionResponse {
  email: string
  displayName: string
  groups: string[]
  plant?: string | null
}

/** Inner tree — consumes providers already mounted above. */
function AppInner() {
  useManifestHydration()
  return <ShellLayout />
}

/** Fetches /api/auth/session and wires real user identity into AuthScopeProvider. */
function AppWithAuth() {
  const { data: session } = useQuery<SessionResponse>({
    queryKey: ['auth-session'],
    queryFn: () => fetch('/api/auth/session').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const user: UserIdentity | undefined = session
    ? {
        userId: session.email,
        email: session.email,
        displayName: session.displayName,
        groups: session.groups ?? [],
        isAuthenticated: true,
      }
    : undefined

  return (
    <AuthScopeProvider user={user}>
      <FeedbackProvider>
        <AppInner />
      </FeedbackProvider>
    </AuthScopeProvider>
  )
}

/** Root application component. Mounts all top-level providers in dependency order. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppWithAuth />
    </QueryClientProvider>
  )
}