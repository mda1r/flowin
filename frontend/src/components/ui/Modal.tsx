import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { useI18n } from '@/i18n'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// open dialogs, innermost last: only the top one reacts to Escape/Tab when they are nested
const openDialogs: symbol[] = []

/**
 * Dialog behaviour shared by Modal, OverlayDialog and custom sheets (the phone cart): initial focus,
 * Escape to close, Tab trapped inside the panel, background scroll locked, focus handed back to the
 * opener on close.
 */
export function useDialogBehavior<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, initialFocus: 'field' | 'panel') {
  const panelRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // remember the opener while rendering: autoFocus fields inside the panel take focus before effects run
  const openerRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  if (open !== wasOpenRef.current) {
    wasOpenRef.current = open
    if (open) openerRef.current = document.activeElement as HTMLElement | null
  }

  useEffect(() => {
    if (!open) return
    const token = Symbol('dialog')
    openDialogs.push(token)
    const previouslyFocused = openerRef.current
    const panel = panelRef.current
    if (!panel?.contains(document.activeElement)) {
      const first =
        panel?.querySelector<HTMLElement>('[data-autofocus]') ??
        (initialFocus === 'field' ? panel?.querySelector<HTMLElement>('input, select, textarea') : null)
      ;(first ?? panel)?.focus()
    }

    const handleKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement
      const outside = !active || active === panel || !panel.contains(active)
      if (e.shiftKey && (active === firstEl || outside)) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (active === lastEl || outside)) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
      const idx = openDialogs.indexOf(token)
      if (idx !== -1) openDialogs.splice(idx, 1)
      previouslyFocused?.focus?.()
    }
  }, [open, initialFocus])

  return panelRef
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const { t } = useI18n()
  const panelRef = useDialogBehavior(open, onClose, 'field')
  const titleId = useId()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-[2px] animate-float-up" onMouseDown={onClose}>
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            'flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-lg outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl',
            sizeClasses[size],
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
            <h2 id={titleId} className="text-base font-semibold text-fg">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {footer && <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-surface-2/50 px-6 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

interface OverlayDialogProps {
  /** defaults to true, for overlays that are mounted only while shown */
  open?: boolean
  onClose: () => void
  /** id of the visible heading that names the dialog, or a plain label when there is none */
  labelledBy?: string
  label?: string
  children: React.ReactNode
  /** the panel's own look (glass-panel, width, padding…); height and phone width are capped for you */
  panelClassName?: string
  panelStyle?: React.CSSProperties
  /** marks the panel as the region printElement prints */
  printArea?: boolean
  backdropClassName?: string
  /** extra classes/style for the full-screen layer, e.g. a page's accent scene */
  className?: string
  style?: React.CSSProperties
  /** some overlays must only close through their own buttons */
  closeOnBackdrop?: boolean
  /** keep the page's useShortcuts keys live while open, e.g. the POS payment step (F5–F9) */
  allowPageShortcuts?: boolean
}

/**
 * Accessible shell for POS-style overlays that keep their own panel design: same keyboard,
 * focus and scroll handling as Modal, the panel scrolls instead of running off short screens.
 */
export function OverlayDialog({
  open = true,
  onClose,
  labelledBy,
  label,
  children,
  panelClassName,
  panelStyle,
  printArea,
  backdropClassName = 'bg-black/60',
  className,
  style,
  closeOnBackdrop = true,
  allowPageShortcuts,
}: OverlayDialogProps) {
  const panelRef = useDialogBehavior(open, onClose, 'panel')
  if (!open) return null
  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', className)} style={style}>
      <div
        className={cn('absolute inset-0', backdropClassName)}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        data-print-area={printArea ? '' : undefined}
        data-page-shortcuts={allowPageShortcuts ? '' : undefined}
        style={panelStyle}
        className={cn('relative max-h-full w-full min-w-0 max-w-sm overflow-y-auto outline-none', panelClassName)}
      >
        {children}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger'
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t.common.cancel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel ?? t.common.confirm}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{message}</p>
    </Modal>
  )
}
