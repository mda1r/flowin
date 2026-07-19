import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { ToastProvider } from '@/components/ui/Toast'
import { I18nContext, useI18nState } from '@/i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
    mutations: { retry: 0 },
  },
})

function App() {
  const i18n = useI18nState()
  return (
    <I18nContext.Provider value={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ToastProvider />
      </QueryClientProvider>
    </I18nContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
