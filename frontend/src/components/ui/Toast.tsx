import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  message?: string
}

type ToastListener = (toast: Omit<Toast, 'id'>) => void

const listeners: ToastListener[] = []

export const toast = {
  success: (title: string, message?: string) =>
    listeners.forEach((l) => l({ variant: 'success', title, message })),
  error: (title: string, message?: string) =>
    listeners.forEach((l) => l({ variant: 'error', title, message })),
  warning: (title: string, message?: string) =>
    listeners.forEach((l) => l({ variant: 'warning', title, message })),
  info: (title: string, message?: string) =>
    listeners.forEach((l) => l({ variant: 'info', title, message })),
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-success" />,
  error: <XCircle className="h-5 w-5 text-danger" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" />,
  info: <Info className="h-5 w-5 text-info" />,
}

const variantBorder: Record<ToastVariant, string> = {
  success: 'border-success/30',
  error: 'border-danger/30',
  warning: 'border-warning/30',
  info: 'border-info/30',
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    listeners.push(addToast)
    return () => {
      const idx = listeners.indexOf(addToast)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [addToast])

  return (
    <div className="fixed bottom-4 end-4 z-[60] flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex min-w-72 max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-lg animate-float-up',
            variantBorder[t.variant],
          )}
        >
          <div className="mt-0.5 shrink-0">{icons[t.variant]}</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-fg">
              {t.title}
            </p>
            {t.message && (
              <p className="mt-0.5 text-xs text-muted">
                {t.message}
              </p>
            )}
          </div>
          <button
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            className="shrink-0 text-muted hover:text-fg" aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
