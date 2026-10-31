import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { marketingApi } from '@/api/marketing'
import { useAuthStore } from '@/stores/authStore'
import { apiErrorMessage } from '@/lib/apiError'

const PHONE_KEY = 'whatsapp-test-phone'

const readPhone = () => {
  try {
    return localStorage.getItem(PHONE_KEY) ?? ''
  } catch {
    return ''
  }
}

interface Props {
  // The offer being written; without it the server sends a short sample text.
  message?: string
  imageId?: string
  name?: string
  disabled?: boolean
}

// Sends the template once to the owner's own phone, to see exactly what customers will get.
export function WhatsAppTestSend({ message, imageId, name, disabled }: Props) {
  const { tenantId } = useAuthStore()
  const [phone, setPhone] = useState(readPhone)

  const send = useMutation({
    mutationFn: () => marketingApi.testWhatsApp(tenantId!, { phone: phone.trim(), name, message, imageId }),
    onSuccess: (result) => {
      try {
        localStorage.setItem(PHONE_KEY, phone.trim())
      } catch {
        /* storage unavailable */
      }
      // The number is isolated left-to-right so its + stays in front of it inside the Arabic sentence.
      toast.success('أُرسلت الرسالة التجريبية', `افتح واتساب على ⁦+${result.phone}⁩`)
    },
    onError: (err) => toast.error('لم تُرسل التجربة', apiErrorMessage(err)),
  })

  return (
    <div className="flex gap-2">
      <input
        className="input min-w-0 flex-1 text-sm"
        dir="ltr"
        inputMode="tel"
        placeholder="05XXXXXXXX"
        aria-label="رقمك للتجربة"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Button variant="secondary" disabled={disabled || phone.trim().length < 9} loading={send.isPending} onClick={() => send.mutate()}>
        <Send className="h-4 w-4" />
        إرسال تجريبي لرقمي
      </Button>
    </div>
  )
}
