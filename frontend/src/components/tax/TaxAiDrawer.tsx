import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Send, Loader2, Sparkles, Bot, FileText, AlertTriangle, Calculator, RefreshCw } from 'lucide-react'
import { taxApi } from '@/api/tax'
import { useI18n } from '@/i18n'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface QuickPrompt {
  key: 'summary' | 'violations' | 'filing' | 'readiness'
  icon: React.ReactNode
}

// Labels and prompt text come from t.ai.tax.quickPrompts / t.ai.tax.prompts.
const QUICK_PROMPTS: QuickPrompt[] = [
  { key: 'summary',    icon: <Calculator className="h-3.5 w-3.5" /> },
  { key: 'violations', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { key: 'filing',     icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'readiness',  icon: <RefreshCw className="h-3.5 w-3.5" /> },
]

interface TaxAiDrawerProps {
  open: boolean
  onClose: () => void
  periodId: string | null
}

export function TaxAiDrawer({ open, onClose, periodId }: TaxAiDrawerProps) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (message: string) => taxApi.aiChat(message, periodId),
    onSuccess: (response) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t.ai.tax.error },
      ])
    },
  })

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || chatMutation.isPending) return
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    chatMutation.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div
        className="relative flex h-full w-full max-w-md flex-col border-s shadow-2xl"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.ai.tax.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.ai.tax.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/10"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6 text-center">
                <div
                  className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}
                >
                  <Bot className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.ai.tax.greeting}
                </p>
                <p className="mt-1 text-xs max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.ai.tax.intro}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.key}
                    onClick={() => send(t.ai.tax.prompts[q.key])}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-xs font-medium transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{q.icon}</span>
                    {t.ai.tax.quickPrompts[q.key]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  dir="auto"
                  style={
                    msg.role === 'user'
                      ? { background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--text-primary)' }
                      : { background: 'var(--sidebar-bg, var(--card-bg))', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {chatMutation.isPending && (
            <div className="flex justify-end">
              <div
                className="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t.ai.tax.thinking}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t p-3" style={{ borderColor: 'var(--card-border)' }}>
          <div
            className="flex items-end gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.ai.tax.placeholder}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || chatMutation.isPending}
              className="bg-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-fg transition-opacity disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t.ai.tax.hint}
          </p>
        </div>
      </div>
    </div>
  )
}
