import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { WhatsAppTestSend } from '@/components/crm/WhatsAppTestSend'
import { marketingApi, type WhatsAppCheck, type WhatsAppSettings } from '@/api/marketing'
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
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [check, setCheck] = useState<WhatsAppCheck | null>(null)
  const seeded = useRef(false)

  // Filled once per opening (again only if the settings were still loading), so saving does not wipe the result.
  useEffect(() => {
    if (!open) {
      seeded.current = false
      return
    }
    if (seeded.current) return
    seeded.current = current !== undefined
    setPhoneNumberId(current?.phoneNumberId ?? '')
    setAccessToken('')
    setTemplateName(current?.templateName ?? '')
    setLanguageCode(current?.languageCode || 'ar')
    setHasImageHeader(current?.configured ? current.hasImageHeader : true)
    setIncludeNameVariable(current?.configured ? current.includeNameVariable : true)
    setBusinessAccountId(current?.businessAccountId ?? '')
    setCheck(null)
  }, [open, current])

  // Saves, then asks Meta whether the number, token and template really work, so a mistake shows up now and
  // not halfway through a campaign. "حفظ" closes when all is well; "فحص الاتصال" stays open to show the result.
  const save = useMutation({
    mutationFn: async (closeWhenOk: boolean) => {
      const saved = await marketingApi.updateWhatsApp(tenantId!, {
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim() || undefined,
        templateName: templateName.trim(),
        languageCode: languageCode.trim(),
        hasImageHeader,
        includeNameVariable,
        businessAccountId: businessAccountId.trim(),
      })
      let result: WhatsAppCheck | null = null
      try {
        result = await marketingApi.checkWhatsApp(tenantId!)
      } catch (err) {
        toast.error('حُفظت الإعدادات، لكن تعذّر الفحص', apiErrorMessage(err))
      }
      return { closeWhenOk, saved, result }
    },
    onSuccess: ({ closeWhenOk, saved, result }) => {
      qc.setQueryData<WhatsAppSettings>(['whatsapp-settings', tenantId], result ? { ...saved, templateBody: result.templateBody } : saved)
      setAccessToken('')
      setCheck(result)
      if (!result) return
      if (!result.ok) {
        toast.error('حُفظت الإعدادات، لكن الفحص وجد مشكلة', 'راجع النتيجة أسفل النموذج')
      } else if (closeWhenOk) {
        toast.success('حُفظت إعدادات واتساب للأعمال', 'والاتصال يعمل')
        onClose()
      } else {
        toast.success('الاتصال يعمل')
      }
    },
    onError: (err) => toast.error('تعذّر الحفظ', apiErrorMessage(err)),
  })

  const needsToken = !current?.tokenHint && !accessToken.trim()
  const canSave = !!phoneNumberId.trim() && !!templateName.trim() && !needsToken
  const savingAndClosing = save.isPending && save.variables === true

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
            variant="secondary"
            loading={save.isPending && !savingAndClosing}
            disabled={!canSave || savingAndClosing}
            onClick={() => save.mutate(false)}
          >
            <ShieldCheck className="h-4 w-4" />
            فحص الاتصال
          </Button>
          <Button
            loading={savingAndClosing}
            disabled={!canSave || (save.isPending && !savingAndClosing)}
            onClick={() => save.mutate(true)}
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
            <li>انسخ <span className="text-fg">Phone number ID</span> و<span className="text-fg">WABA ID</span> وتوكن دائم (System User token) والصقهم هنا.</li>
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
        <Input
          label="معرّف حساب واتساب للأعمال (WABA ID)"
          inputMode="numeric"
          dir="ltr"
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          hint="اختياري، تجده بجانب Phone number ID. به يُفحص القالب ويظهر نصه في المعاينة."
        />

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

        {check && (
          <div className="space-y-2 rounded-xl border border-border p-3" role="status">
            <p className="text-sm font-medium text-fg">نتيجة الفحص</p>
            <ul className="space-y-2">
              {check.items.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm">
                  {item.status === 'Ok' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="سليم" />
                  ) : item.status === 'Warning' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="تنبيه" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="مشكلة" />
                  )}
                  <span>
                    <span className="font-medium text-fg">{item.label}: </span>
                    <span className="text-muted">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {check.templateBody && (
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-xs leading-5 text-fg">{check.templateBody}</p>
            )}
          </div>
        )}

        {current?.configured && (
          <div className="space-y-1.5 border-t border-border pt-4">
            <p className="text-sm font-medium text-fg">جرّب على رقمك</p>
            <WhatsAppTestSend disabled={save.isPending} />
            <p className="text-xs leading-5 text-muted">
              تصلك رسالة تجريبية بالقالب المحفوظ{current.hasImageHeader ? ' مع صورة بسيطة مكان صورة العرض' : ''}، وتحسبها Meta رسالة مدفوعة.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
