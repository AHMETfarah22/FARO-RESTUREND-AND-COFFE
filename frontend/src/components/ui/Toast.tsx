import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Bell, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { translate } from '@/lib/i18n'

type ToastKind = 'success' | 'error' | 'info' | 'notification'

interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  notify: (title: string, message?: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const icons = { success: CheckCircle2, error: AlertCircle, info: Info, notification: Bell }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string, action?: Toast['action']) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t.slice(-3), { id, kind, title, message, action }])
      setTimeout(() => dismiss(id), kind === 'error' || kind === 'notification' ? 7000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, m) => push('success', t, m),
      error: (t, m) => push('error', t, m),
      info: (t, m) => push('info', t, m),
      notify: (t, m, a) => push('notification', t, m, a),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end" aria-live="polite">
          {toasts.map((toast) => {
            const Icon = icons[toast.kind]
            return (
              <div
                key={toast.id}
                role={toast.kind === 'error' ? 'alert' : 'status'}
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg',
                  toast.kind === 'notification' ? 'border-brand bg-brand text-brand-fg' : 'border-line bg-paper text-ink',
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 size-5 shrink-0',
                    toast.kind === 'success' && 'text-success',
                    toast.kind === 'error' && 'text-danger',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.message && (
                    <p className={cn('mt-0.5 text-sm', toast.kind === 'notification' ? 'text-paper/70' : 'text-muted')}>{toast.message}</p>
                  )}
                  {toast.action && (
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold underline underline-offset-4"
                      onClick={() => {
                        toast.action!.onClick()
                        dismiss(toast.id)
                      }}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => dismiss(toast.id)} className="opacity-60 hover:opacity-100" aria-label={translate('Dismiss')}>
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
