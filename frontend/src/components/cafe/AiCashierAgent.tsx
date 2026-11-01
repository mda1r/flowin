import { useEffect, useRef, useState, useCallback } from 'react'
import { isAxiosError } from 'axios'
import { Mic, MicOff, X, Volume2, Loader2 } from 'lucide-react'
import {
  aiCashierApi,
  type AiCashierAction,
  type AiCashierCartSnapshot,
  type AiCashierMessage,
  type AiCashierResponse,
} from '@/api/aiCashier'
import type { ProductResponse } from '@/types/api'
import { apiErrorMessage } from '@/lib/apiError'
import { cn, formatCurrency } from '@/lib/utils'

/** What happened when the agent tried to change the POS cart. */
// needs_options: the drink has an add-on the customer must pick (e.g. milk), so the cashier picks it on the till.
export type AiCartResult = 'ok' | 'not_found' | 'out_of_stock' | 'not_in_cart' | 'needs_options'

interface AiCashierAgentProps {
  branchId: string
  allProducts: ProductResponse[]
  /** The cart exactly as the POS has it right now (totals include VAT). */
  getCart: () => AiCashierCartSnapshot
  onAddVariant: (variantId: string, qty: number, notes: string) => AiCartResult
  onSetQuantity: (variantId: string, qty: number) => AiCartResult
  onRemoveVariant: (variantId: string) => AiCartResult
  /** Resolves false when the checkout failed and the order is still open. */
  onCompleteOrder: (paymentMethod: 'Cash' | 'Card') => Promise<boolean>
  onDeactivate: () => void
}

interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
  id: number
}

const ERROR_REPLY = 'عذراً، حدث خطأ. هل تودّ تكرار طلبك؟'
const PAYMENT_FAILED_REPLY = 'تعذّر إتمام الدفع، نحاول مرة ثانية؟'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any

export function AiCashierAgent(props: AiCashierAgentProps) {
  const { onDeactivate } = props
  const [sessionStarted, setSessionStarted] = useState(false)
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Callbacks fire long after the render that created them (speech end, recognition result),
  // so everything they touch lives in refs: the latest props, the history, and whether the
  // panel is still open. Once it closes nothing may listen, speak or change the cart.
  const latest = useRef(props)
  latest.current = props
  const activeRef = useRef(true)
  const historyRef = useRef<AiCashierMessage[]>([])
  const recognitionRef = useRef<Recognition>(null)
  const abortRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const completingRef = useRef(false)
  const speechIdRef = useRef(0)
  const msgCountRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const addDisplay = useCallback((role: 'user' | 'assistant', text: string) => {
    msgCountRef.current += 1
    setDisplayMessages((prev) => [...prev, { role, text, id: msgCountRef.current }])
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [displayMessages])

  const stopRecognition = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try { recognition.abort() } catch { /* already stopped */ }
    }
    setIsListening(false)
  }

  const speak = (text: string, onEnd?: () => void) => {
    if (!activeRef.current) return
    if (!('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    // cancel() fires onend of the previous utterance; the id check keeps that from chaining on.
    const id = ++speechIdRef.current
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ar-SA'
    utterance.rate = 0.95
    utterance.pitch = 1.05
    const done = () => {
      if (!activeRef.current || id !== speechIdRef.current) return
      setIsSpeaking(false)
      onEnd?.()
    }
    utterance.onend = done
    utterance.onerror = done
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const startListening = () => {
    if (!activeRef.current || busyRef.current || recognitionRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const recognition: Recognition = new SR()
    recognition.lang = 'ar-SA'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    const finish = () => {
      if (recognitionRef.current !== recognition) return
      recognitionRef.current = null
      if (activeRef.current) setIsListening(false)
    }
    recognition.onresult = (e: Recognition) => {
      if (!activeRef.current) return
      const text = String(e.results?.[0]?.[0]?.transcript ?? '').trim()
      finish()
      if (!text) return
      addDisplay('user', text)
      void sendToAI([...historyRef.current, { role: 'user', content: text }])
    }
    recognition.onerror = finish
    recognition.onend = finish

    recognitionRef.current = recognition
    setIsListening(true)
    try {
      recognition.start()
    } catch {
      finish()
    }
  }

  const productName = (variantId: string): string => {
    for (const product of latest.current.allProducts) {
      const variant = product.variants.find((v) => v.id === variantId)
      if (variant) return variant.name && variant.name !== product.name ? `${product.name} ${variant.name}` : product.name
    }
    return 'هذا الصنف'
  }

  const applyAction = (action: AiCashierAction): AiCartResult | null => {
    const { onAddVariant, onSetQuantity, onRemoveVariant } = latest.current
    if (!action.variantId) return null
    switch (action.type) {
      case 'add_item': return onAddVariant(action.variantId, action.quantity ?? 1, action.notes ?? '')
      case 'set_quantity': return onSetQuantity(action.variantId, action.quantity ?? 1)
      case 'remove_item': return onRemoveVariant(action.variantId)
      default: return null
    }
  }

  const problemText = (result: AiCartResult, variantId: string): string => {
    const name = productName(variantId)
    switch (result) {
      case 'out_of_stock': return `عذراً، الكمية المطلوبة من ${name} غير متوفرة.`
      case 'not_in_cart': return `${name} مو موجود في الطلب.`
      case 'needs_options': return `${name} يحتاج اختيار إضافة، اختارها من الشاشة.`
      default: return 'عذراً، أحد الأصناف غير متوفر حالياً.'
    }
  }

  // What the POS cart really holds, so a correction never repeats a stale total.
  const cartSummary = (): string => {
    const { lines, total } = latest.current.getCart()
    if (lines.length === 0) return 'طلبك فاضي الحين.'
    const items = lines.map((l) => `${l.name} × ${l.quantity}`).join('، ')
    return `طلبك الحين: ${items}. المجموع ${formatCurrency(total, 'SAR', 'ar-SA')}.`
  }

  const completeOrder = async (method: 'Cash' | 'Card') => {
    if (!activeRef.current || completingRef.current) return
    completingRef.current = true
    // Nothing listens or talks to the AI while the payment runs.
    busyRef.current = true
    setIsPaying(true)
    const ok = await latest.current.onCompleteOrder(method)
    // On success the POS closes the panel; keep the guards up until it does.
    if (!activeRef.current || ok) return
    busyRef.current = false
    completingRef.current = false
    setIsPaying(false)
    historyRef.current = [
      ...historyRef.current,
      { role: 'assistant', content: JSON.stringify({ message: PAYMENT_FAILED_REPLY, actions: [], state: 'payment_method' }) },
    ]
    addDisplay('assistant', PAYMENT_FAILED_REPLY)
    speak(PAYMENT_FAILED_REPLY, startListening)
  }

  const sendToAI = async (msgs: AiCashierMessage[]) => {
    if (!activeRef.current || busyRef.current) return
    busyRef.current = true
    historyRef.current = msgs
    setIsLoading(true)
    const controller = new AbortController()
    abortRef.current = controller

    let response: AiCashierResponse | undefined
    try {
      response = await aiCashierApi.chat(latest.current.branchId, msgs, latest.current.getCart(), controller.signal)
    } catch (err) {
      if (!activeRef.current || controller.signal.aborted) return
      const reply = apiErrorMessage(err, ERROR_REPLY)
      addDisplay('assistant', reply)
      // A missing subscription or permission will not fix itself, so stop the loop there.
      const status = isAxiosError(err) ? err.response?.status : undefined
      const retry = status !== 402 && status !== 403
      // Release the busy flag before speaking: without speech support onEnd runs synchronously.
      busyRef.current = false
      setIsLoading(false)
      speak(reply, retry ? startListening : undefined)
      return
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      busyRef.current = false
      if (activeRef.current) setIsLoading(false)
    }
    if (!response || !activeRef.current || controller.signal.aborted) return

    // Apply the actions and tell the customer about anything the POS refused.
    const applied: AiCashierAction[] = []
    const problems: string[] = []
    let payment: 'Cash' | 'Card' | null = null
    for (const action of response.actions) {
      if (action.type === 'complete_order') {
        if (action.paymentMethod === 'Cash' || action.paymentMethod === 'Card') payment = action.paymentMethod
        continue
      }
      const result = applyAction(action)
      if (result === 'ok') applied.push(action)
      else if (result) {
        const text = problemText(result, action.variantId!)
        if (!problems.includes(text)) problems.push(text)
      }
    }
    // Never take payment when part of the order did not make it into the cart.
    if (problems.length > 0) payment = null
    if (payment) applied.push({ type: 'complete_order', paymentMethod: payment })

    // Once something was refused the model's confirmation (and any total it quoted) is wrong,
    // so say what went wrong and then what the cart really holds.
    const message = response.corrected || problems.length > 0
      ? [...(response.corrected ? [response.message] : []), ...problems, cartSummary()].join(' ')
      : response.message
    const state = problems.length > 0 && response.state === 'complete' ? 'taking_order' : response.state

    // The model sees its own past actions next turn, not just what it said.
    historyRef.current = [
      ...msgs,
      { role: 'assistant', content: JSON.stringify({ message, actions: applied, state }) },
    ]
    addDisplay('assistant', message)

    if (payment) {
      const method = payment
      speak(message, () => { void completeOrder(method) })
      return
    }

    // 'error' means the server cannot reach the AI; listening again would only repeat it.
    speak(message, () => {
      if (state !== 'complete' && state !== 'error') startListening()
    })
  }

  const startSession = () => {
    if (busyRef.current) return
    setSessionStarted(true)
    void sendToAI([])
  }

  const handleManualListen = () => {
    if (recognitionRef.current) {
      // stop() (not abort) so whatever was already said is still delivered
      recognitionRef.current.stop()
    } else {
      startListening()
    }
  }

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      abortRef.current?.abort()
      abortRef.current = null
      const recognition = recognitionRef.current
      recognitionRef.current = null
      if (recognition) {
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
        try { recognition.abort() } catch { /* already stopped */ }
      }
      speechIdRef.current += 1
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const close = () => {
    stopRecognition()
    onDeactivate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      {/* Panel */}
      <div className="relative flex h-[90dvh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-border bg-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-brand-soft px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-brand-fg">
              س
            </div>
            <div>
              <p className="text-sm font-bold text-brand-ink">سعد — كاشير AI</p>
              <p className="text-xs text-muted">
                {isListening ? 'يستمع...' : isSpeaking ? 'يتكلم...' : isPaying ? 'جاري الدفع...' : isLoading ? 'يفكر...' : 'جاهز'}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            aria-label="إغلاق"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {!sessionStarted && (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft">
                <Mic className="h-9 w-9 text-brand-strong" />
              </div>
              <div>
                <p className="text-base font-semibold text-fg">كاشير AI</p>
                <p className="mt-1 text-sm text-muted">اضغط لبدء جلسة مع سعد</p>
                {!speechSupported && (
                  <p className="mt-2 text-xs text-danger">المتصفح لا يدعم التعرف على الصوت</p>
                )}
              </div>
              <button
                onClick={startSession}
                disabled={isLoading}
                className="rounded-2xl bg-brand px-8 py-3 text-sm font-bold text-brand-fg transition-transform active:scale-95 disabled:opacity-60"
              >
                {isLoading ? 'جاري التحميل...' : 'ابدأ الجلسة'}
              </button>
            </div>
          )}

          {displayMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'assistant'
                  ? 'self-start bg-surface-2 text-fg'
                  : 'self-end bg-brand text-brand-fg',
              )}
            >
              {msg.role === 'assistant' && (
                <span className="mb-1 block text-xs font-semibold text-brand-ink">سعد</span>
              )}
              {msg.text}
            </div>
          ))}

          {(isLoading || isPaying) && (
            <div className="flex items-center gap-2 text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">{isPaying ? 'جاري الدفع...' : 'يفكر...'}</span>
            </div>
          )}
        </div>

        {/* Footer controls */}
        {sessionStarted && (
          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <div className="flex items-center gap-2">
              {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse text-brand-strong" />}
              {isListening && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-success" />
                  يستمع
                </span>
              )}
            </div>
            <button
              onClick={handleManualListen}
              disabled={!isListening && (isLoading || isSpeaking || isPaying || !speechSupported)}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50',
                isListening
                  ? 'bg-danger/15 text-danger ring-1 ring-danger/40'
                  : 'bg-brand text-brand-fg',
              )}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4" />
                  إيقاف
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  تحدث
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
