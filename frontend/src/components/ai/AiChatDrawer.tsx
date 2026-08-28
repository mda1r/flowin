import { useState, useRef, useEffect } from 'react'
import {
  X, Send, Loader2, Sparkles, TrendingUp, Package,
  DollarSign, BarChart2, RefreshCw, Lightbulb, Bot,
} from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { aiApi, type AiChatMessage } from '@/api/ai'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

// ── Quick prompts for each "agent" role ───────────────────────────────────────

interface QuickPrompt { label: string; icon: React.ReactNode; prompt: string; color: string }

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: 'تحليل المبيعات',
    icon: <TrendingUp className="h-4 w-4" />,
    prompt: 'حلّل مبيعات اليوم وأعطني ملخصاً عن الأداء مقارنة بالمعدل المعتاد.',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  {
    label: 'مراقبة المخزون',
    icon: <Package className="h-4 w-4" />,
    prompt: 'راجع حالة المخزون وأخبرني بالمنتجات التي تحتاج إعادة طلب أو قريبة من النفاد.',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  {
    label: 'تقرير الأرباح',
    icon: <DollarSign className="h-4 w-4" />,
    prompt: 'اعمل لي تقريراً مالياً مختصراً عن إيرادات الشهر الحالي والضريبة المستحقة.',
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    label: 'أفضل المنتجات',
    icon: <BarChart2 className="h-4 w-4" />,
    prompt: 'أخبرني بالمنتجات الأكثر مبيعاً هذا الشهر ونصائح لزيادة الإيرادات.',
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'insights' | 'chat'

// ── Insights panel ────────────────────────────────────────────────────────────

function InsightsPanel({ branchId }: { branchId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ai-insights', branchId],
    queryFn: () => aiApi.getInsights(branchId).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-1.5 h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="h-8 w-8 text-gray-200 dark:text-gray-700" />
        <p className="text-sm text-gray-400">تعذّر تحميل التحليلات</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <RefreshCw className="h-3 w-3" />
          إعادة المحاولة
        </button>
      </div>
    )
  }

  const cards = [
    { icon: <TrendingUp className="h-4 w-4 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'تحليل المبيعات', body: data.salesInsight },
    { icon: <BarChart2  className="h-4 w-4 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'الاتجاهات', body: data.trendInsight },
    { icon: <Lightbulb className="h-4 w-4 text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'التوصيات', body: data.recommendation },
  ]

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">تحليلات تلقائية</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--accent)] disabled:opacity-40"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          تحديث
        </button>
      </div>
      {cards.map((card) => (
        <div key={card.title} className={cn('rounded-xl p-4', card.bg)}>
          <div className="flex items-center gap-2 mb-2">
            {card.icon}
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{card.title}</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{card.body}</p>
        </div>
      ))}
      {data.generatedAt && (
        <p className="text-center text-xs text-gray-300 dark:text-gray-600">
          آخر تحديث: {new Date(data.generatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

interface AiChatDrawerProps {
  open: boolean
  onClose: () => void
}

export function AiChatDrawer({ open, onClose }: AiChatDrawerProps) {
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(open) : v
    if (!next) onClose()
  }
  const branchId = useAuthStore(s => s.branchId ?? '')
  const [tab, setTab] = useState<Tab>('insights')
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      content: 'مرحباً! أنا سعد، مساعدك المالي الذكي. يمكنني تحليل مبيعاتك، مراقبة المخزون، وتقديم تقارير محاسبية. استخدم الأزرار السريعة أو اسألني مباشرة.',
    },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && tab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open, tab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      aiApi.chat(branchId, {
        message,
        history: messages.slice(-8),
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

  const sendMessage = (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || chatMutation.isPending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    chatMutation.mutate(msg)
    if (tab !== 'chat') setTab('chat')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="absolute bottom-0 left-0 flex h-[600px] w-full max-w-sm flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl md:bottom-24 md:left-6 md:h-[580px] md:rounded-2xl dark:border-gray-700 dark:bg-gray-900"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--accent) 15%, white)' }}
              >
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">سعد</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  محاسب · مبيعات · مخزون
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800">
              {([
                { key: 'insights', label: 'تحليلات', icon: <BarChart2 className="h-3.5 w-3.5" /> },
                { key: 'chat',     label: 'محادثة',  icon: <Bot       className="h-3.5 w-3.5" /> },
              ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                    tab === t.key
                      ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {tab === 'insights' ? (
                <div className="flex-1 overflow-y-auto">
                  <InsightsPanel branchId={branchId} />
                </div>
              ) : (
                <>
                  {/* Quick prompts */}
                  {messages.length <= 1 && (
                    <div className="border-b border-gray-100 p-3 dark:border-gray-800">
                      <p className="mb-2 text-xs font-medium text-gray-400">إجراء سريع</p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_PROMPTS.map((qp) => (
                          <button
                            key={qp.label}
                            onClick={() => sendMessage(qp.prompt)}
                            disabled={chatMutation.isPending}
                            className={cn(
                              'flex items-center gap-2 rounded-xl px-3 py-2 text-right text-xs font-medium transition-opacity disabled:opacity-40',
                              qp.color,
                            )}
                          >
                            {qp.icon}
                            {qp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn('flex', msg.role === 'user' ? 'justify-start' : 'justify-end')}
                      >
                        <div
                          className={cn(
                            'max-w-[87%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                            msg.role === 'user'
                              ? 'bg-[var(--accent)] text-white rounded-tr-sm'
                              : 'bg-gray-100 text-gray-800 rounded-tl-sm dark:bg-gray-800 dark:text-gray-100',
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatMutation.isPending && (
                      <div className="flex justify-end">
                        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 dark:bg-gray-800">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                          <span className="text-xs text-gray-400">جارٍ التحليل...</span>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                </>
              )}
            </div>

            {/* Chat input — always shown in chat tab */}
            {tab === 'chat' && (
              <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اسأل عن مبيعاتك أو المخزون..."
                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                    disabled={chatMutation.isPending}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || chatMutation.isPending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-white transition-opacity disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5 -scale-x-100" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
