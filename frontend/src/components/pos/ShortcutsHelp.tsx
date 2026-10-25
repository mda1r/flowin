import { Keyboard } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

export interface ShortcutHint {
  keys: string[]
  label: string
}

const KEY_LABELS: Record<string, string> = {
  'Ctrl+Enter': 'Ctrl + Enter',
  Enter: 'Enter',
  '+': '+',
  '-': '−',
}

export function ShortcutsHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg md:inline-flex"
      title="اختصارات لوحة المفاتيح (?)"
    >
      <Keyboard className="h-3.5 w-3.5" />
      اختصارات
      <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">?</kbd>
    </button>
  )
}

export function ShortcutsHelp({ open, onClose, hints }: { open: boolean; onClose: () => void; hints: ShortcutHint[] }) {
  return (
    <Modal open={open} onClose={onClose} title="اختصارات لوحة المفاتيح" size="md">
      <ul className="divide-y divide-border">
        {hints.map((h) => (
          <li key={h.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="text-fg">{h.label}</span>
            <span className="flex shrink-0 items-center gap-1" dir="ltr">
              {h.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span className="text-xs text-muted">/</span>}
                  <kbd className="min-w-7 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-center font-mono text-xs text-fg shadow-sm">
                    {KEY_LABELS[k] ?? k}
                  </kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">
        مفاتيح F تعمل حتى أثناء الكتابة. الرموز مثل / و + لا تعمل داخل حقول الإدخال.
      </p>
    </Modal>
  )
}
