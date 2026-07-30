import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, Loader2, Sparkles } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { aiApi, type AiChatMessage } from '@/api/ai'
import { useAuthStore } from '@/stores/authStore'

export function AiChatDrawer() {
  const branchId = useAuthStore(s => s.branchId ?? '')

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: 'assistant', content: 'مرحباً! أنا مساعدك الذكي. يمكنني مساعدتك في تحليل مبيعاتك والإجابة على أسئلتك عن عملك.' },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      aiApi.chat(branchId, {
        message,
        history: messages.slice(-6),
      }).then(r => r.data),
    onSuccess: (response: string) => {
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.',
      }])
    },
  })

  const sendMessage = () => {
    const text = input.trim()
    if (!text || chatMutation.isPending) { return }
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    chatMutation.mutate(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="فتح المساعد الذكي"
        className={`fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
          open
            ? 'bg-gray-700 text-white'
            : 'bg-[var(--accent)] text-white'
        }`}
        style={{ boxShadow: open ? undefined : '0 0 20px var(--glow)' }}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false) } }}
        >
          <div
            className="absolute bottom-0 left-0 flex h-[500px] w-full max-w-sm flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl md:bottom-24 md:left-6 md:h-[520px] md:rounded-2xl dark:border-gray-700 dark:bg-gray-900"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,white)]">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">مساعد نكسس</div>
                <div className="text-xs text-gray-400">مدعوم بالذكاء الاصطناعي</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm dark:bg-gray-800 dark:text-gray-100'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-end">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 dark:bg-gray-800">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">جاري التفكير...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 p-3 dark:border-gray-800">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اسأل عن مبيعاتك..."
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                  disabled={chatMutation.isPending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || chatMutation.isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-white transition-opacity disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5 -scale-x-100" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
