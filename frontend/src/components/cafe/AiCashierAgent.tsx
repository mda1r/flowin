import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, MicOff, X, Volume2, Loader2 } from 'lucide-react'
import { aiCashierApi, type AiCashierMessage } from '@/api/aiCashier'
import type { ProductResponse } from '@/types/api'
import { cn } from '@/lib/utils'

interface AiCashierAgentProps {
  branchId: string
  allProducts: ProductResponse[]
  onAddVariant: (variantId: string, qty: number, notes: string) => void
  onCompleteOrder: (paymentMethod: 'Cash' | 'Card') => void
  onDeactivate: () => void
}

interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
  id: number
}

export function AiCashierAgent({
  branchId,
  allProducts: _allProducts,
  onAddVariant,
  onCompleteOrder,
  onDeactivate,
}: AiCashierAgentProps) {
  const [sessionStarted, setSessionStarted] = useState(false)
  const [messages, setMessages] = useState<AiCashierMessage[]>([])
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const msgCountRef = useRef(0)
  const recognitionRef = useRef<any>(null)
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

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ar-SA'
    utterance.rate = 0.95
    utterance.pitch = 1.05
    setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
      onEnd?.()
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      onEnd?.()
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const startListening = useCallback(
    (currentMessages: AiCashierMessage[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) return

      const recognition: any = new SR()
      recognition.lang = 'ar-SA'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition

      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript.trim()
        if (!text) return
        addDisplay('user', text)
        const updated: AiCashierMessage[] = [...currentMessages, { role: 'user', content: text }]
        setMessages(updated)
        sendToAI(updated)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)

      setIsListening(true)
      recognition.start()
    },
    // sendToAI is defined below; ESLint disabled since it's circular
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addDisplay],
  )

  const sendToAI = useCallback(
    async (msgs: AiCashierMessage[]) => {
      setIsLoading(true)
      try {
        const response = await aiCashierApi.chat(branchId, msgs)

        const assistantMsg: AiCashierMessage = { role: 'assistant', content: response.message }
        const updated = [...msgs, assistantMsg]
        setMessages(updated)
        addDisplay('assistant', response.message)

        // Apply actions
        let completionAction: { paymentMethod: 'Cash' | 'Card' } | null = null
        for (const action of response.actions) {
          if (action.type === 'add_item' && action.variantId) {
            onAddVariant(action.variantId, action.quantity ?? 1, action.notes ?? '')
          } else if (action.type === 'complete_order' && action.paymentMethod) {
            completionAction = { paymentMethod: action.paymentMethod }
          }
        }

        if (completionAction) {
          const pm = completionAction.paymentMethod
          speak(response.message, () => onCompleteOrder(pm))
          return
        }

        speak(response.message, () => {
          if (response.state !== 'complete') {
            startListening(updated)
          }
        })
      } catch {
        addDisplay('assistant', 'عذراً، حدث خطأ. هل تودّ تكرار طلبك؟')
        speak('عذراً، حدث خطأ. هل تودّ تكرار طلبك؟', () => startListening(msgs))
      } finally {
        setIsLoading(false)
      }
    },
    [branchId, addDisplay, onAddVariant, onCompleteOrder, speak, startListening],
  )

  const startSession = useCallback(async () => {
    setSessionStarted(true)
    await sendToAI([])
  }, [sendToAI])

  const handleManualListen = () => {
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      startListening(messages)
    }
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDeactivate} />

      {/* Panel */}
      <div className="relative flex h-[90dvh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-gray-950 shadow-2xl ring-1 ring-indigo-400/30">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-l from-indigo-500/20 to-indigo-400/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-400 text-lg font-bold text-gray-950">
              س
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-300">سعد — كاشير AI</p>
              <p className="text-xs text-gray-400">
                {isListening ? 'يستمع...' : isSpeaking ? 'يتكلم...' : isLoading ? 'يفكر...' : 'جاهز'}
              </p>
            </div>
          </div>
          <button
            onClick={onDeactivate}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {!sessionStarted && (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-400/20 text-4xl">
                🎙️
              </div>
              <div>
                <p className="text-base font-semibold text-white">كاشير AI</p>
                <p className="mt-1 text-sm text-gray-400">اضغط لبدء جلسة مع سعد</p>
                {!speechSupported && (
                  <p className="mt-2 text-xs text-red-400">⚠ المتصفح لا يدعم التعرف على الصوت</p>
                )}
              </div>
              <button
                onClick={startSession}
                disabled={isLoading}
                className="rounded-2xl bg-indigo-400 px-8 py-3 text-sm font-bold text-gray-950 transition-transform active:scale-95 disabled:opacity-60"
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
                  ? 'self-start bg-indigo-400/15 text-indigo-100 ring-1 ring-indigo-400/20'
                  : 'ml-auto self-end bg-blue-500/20 text-blue-100 ring-1 ring-blue-500/20',
              )}
            >
              {msg.role === 'assistant' && (
                <span className="mb-1 block text-xs font-semibold text-indigo-400">سعد</span>
              )}
              {msg.text}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-indigo-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">يفكر...</span>
            </div>
          )}
        </div>

        {/* Footer controls */}
        {sessionStarted && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse text-indigo-400" />}
              {isListening && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  يستمع
                </span>
              )}
            </div>
            <button
              onClick={handleManualListen}
              disabled={isLoading || isSpeaking || !speechSupported}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-95',
                isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-indigo-600 text-white disabled:opacity-50',
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
