import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'info'

interface ToastItem {
  id: number
  variant: ToastVariant
  title: string
  detail?: string
  leaving: boolean
}

interface ToastContextValue {
  showToast: (variant: ToastVariant, title: string, detail?: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

const ICONS: Record<ToastVariant, string> = { success: '✓', info: '⤺' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((variant: ToastVariant, title: string, detail?: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, variant, title, detail, leaving: false }])

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    }, 2600)

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2900)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}${t.leaving ? ' leaving' : ''}`}>
            <span className="toast-icon">{ICONS[t.variant]}</span>
            <div>
              <div className="toast-title">{t.title}</div>
              {t.detail && <div className="toast-detail">{t.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
