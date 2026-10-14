import { Component, StrictMode } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth'
import { Router } from './app/router'
import './styles.css'
import './booking.css'
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000 },
    mutations: { retry: 0 },
  },
})
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      'Application rendering failed',
      error.name,
      info.componentStack,
    )
  }
  render() {
    return this.state.error ? (
      <main className="maintenance-screen">
        <h1>Something needs a little care.</h1>
        <p>
          Please return home and try again. Contact our team if this keeps
          happening.
        </p>
        <a className="button" href="/">
          Return home
        </a>
      </main>
    ) : (
      this.props.children
    )
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
