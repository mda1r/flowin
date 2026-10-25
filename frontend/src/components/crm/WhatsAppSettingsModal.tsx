import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { marketingApi, type WhatsAppSettings } from '@/api/marketing'
import { useAuthStore } from '@/stores/authStore'
import { apiErrorMessage } from '@/lib/apiError'

interface Props {
  open: boolean
  onClose: () => void
  current?: WhatsAppSettings
}

export function WhatsAppSettingsModal({ open, onClose, current }: Props) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [languageCode, setLanguageCode] = useState('ar')
  const [hasImageHeader, setHasImageHeader] = useState(true)
  const [includeNameVariable, setIncludeNameVariable] = useState(true)

  useEffect(() => {
    if (!open) return
    setPhoneNumberId(current?.phoneNumberId ?? '')
    setAccessToken('')
    setTemplateName(current?.templateName ?? '')
    setLanguageCode(current?.languageCode || 'ar')
    setHasImageHeader(current?.configured ? current.hasImageHeader : true)
    setIncludeNameVariable(current?.configured ? current.includeNameVariable : true)
  }, [open, current])

  const save = useMutation({
    mutationFn: () =>
      marketingApi.updateWhatsApp(tenantId!, {
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim() || undefined,
        templateName: templateName.trim(),
        languageCode: languageCode.trim(),
        hasImageHeader,
        includeNameVariable,
      }),
    onSuccess: (data) => {
      qc.setQueryData(['whatsapp-settings', tenantId], data)
      toast.success('حُفظت إعدادات واتساب للأعمال')
      onClose()
    },
    onError: (err) => toast.error('تعذّر الحفظ', apiErrorMessage(err)),
  })

  const needsToken = !current?.tokenHint && !accessToken.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="واتساب للأعمال (API)"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button
            loading={save.isPending}
            disabled={!phoneNumberId.trim() || !templateName.trim() || needsToken}
            onClick={() => save.mutate()}
          >
            حفظ
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <details className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm text-fg">
          <summary className="cursor-pointer font-medium">كيف أجهّز الحساب؟</summary>
          <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-xs leading-6 text-muted">
            <li>أنشئ حساب Meta Business وأضف رقماً مخصصاً لواتساب للأعمال (لا يكون مستخدماً في تطبيق واتساب العادي).</li>
            <li>
              من WhatsApp Manager أنشئ قالباً من فئة <span className="text-fg">Marketing</span> بلغة العربية:
              ترويسة <span className="text-fg">صورة</span> (اختياري)، ونص مثل:{' '}
              <span dir="ltr" className="rounded bg-surface px-1 font-mono text-fg">{'مرحباً {{1}}، {{2}}'}</span>
              {' '}حيث ١ اسم العميل و٢ نص العرض. انتظر اعتماد Meta.
            </li>
            <li>انسخ <span className="text-fg">Phone number ID</span> وتوكن دائم (System User token) والصقهم هنا.</li>
            <li>تحاسبك Meta على كل رسالة تسويقية حسب تسعيرتها، والفاتورة تأتيك منهم مباشرة.</li>
          </ol>
        </details>

        <Input
          label="معرّف رقم الهاتف (Phone number ID)"
          inputMode="numeric"
          dir="ltr"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
        />
        <Input
          label="التوكن (Access token)"
          type="password"
          dir="ltr"
          autoComplete="off"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          hint={current?.tokenHint ? `محفوظ (${current.tokenHint}). اتركه فارغاً للإبقاء عليه.` : 'لا يُعرض مرة أخرى بعد الحفظ.'}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Input
            label="اسم القالب المعتمد"
            dir="ltr"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            hint="كما يظهر في Meta، مثل weekly_offer"
          />
          <Input label="لغة القالب" dir="ltr" value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} hint="ar غالباً" />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-fg">شكل القالب</legend>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={hasImageHeader} onChange={(e) => setHasImageHeader(e.target.checked)} className="accent-[rgb(var(--brand-ink))]" />
            القالب فيه ترويسة صورة (كل حملة تحتاج صورة)
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={includeNameVariable} onChange={(e) => setIncludeNameVariable(e.target.checked)} className="accent-[rgb(var(--brand-ink))]" />
            {'المتغير {{1}} اسم العميل، و{{2}} نص العرض'}
          </label>
          {!includeNameVariable && <p className="text-xs text-muted">{'سيُرسل نص العرض في المتغير {{1}} وحده.'}</p>}
        </fieldset>
      </div>
    </Modal>
  )
}
