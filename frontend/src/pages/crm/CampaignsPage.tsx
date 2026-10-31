import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { AlertTriangle, CheckCircle2, ImagePlus, Info, Megaphone, MessageCircle, RefreshCw, Search, Send, Settings2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { WhatsAppSettingsModal } from '@/components/crm/WhatsAppSettingsModal'
import { WhatsAppTestSend } from '@/components/crm/WhatsAppTestSend'
import { fillTemplate, marketingApi, personalizedMessage, templateText, type Campaign, type CampaignChannel } from '@/api/marketing'
import { useAuthStore } from '@/stores/authStore'
import { apiErrorMessage } from '@/lib/apiError'
import { compressImage } from '@/lib/image'
import { whatsAppUrl } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import { intlLocale } from '@/lib/locale'

const MAX_MESSAGE = 1000
const NAME = '{الاسم}'
const GREETING = `هلا ${NAME} 👋\n`

// Identifies this browser tab to the server while it sends a campaign, so another tab or device waits.
const TAB_RUNNER_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16))

const publicUrl = (path?: string | null) => (path ? `${window.location.origin}${path}` : undefined)

export function CampaignsPage() {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [message, setMessage] = useState(GREETING)
  const [image, setImage] = useState<{ id: string; path: string; preview: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [channel, setChannel] = useState<CampaignChannel>('Links')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null)
  // The campaign just created from this exact form, so a second press does not quietly create a duplicate.
  const [lastCreated, setLastCreated] = useState<{ fingerprint: string; id: string } | null>(null)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const knownIds = useRef<Set<string> | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: audience, isLoading: loadingAudience } = useQuery({
    queryKey: ['marketing-audience', tenantId],
    queryFn: () => marketingApi.audience(tenantId!),
    enabled: !!tenantId,
    // Coming back from WhatsApp must not reload the list under the owner's ticks.
    refetchOnWindowFocus: false,
  })
  const { data: whatsApp } = useQuery({
    queryKey: ['whatsapp-settings', tenantId],
    queryFn: () => marketingApi.whatsApp(tenantId!),
    enabled: !!tenantId,
  })
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => marketingApi.campaigns(tenantId!),
    enabled: !!tenantId,
  })

  const reachable = useMemo(() => audience?.reachable ?? [], [audience])
  // Everyone reachable starts selected; the owner unticks whoever should not get this offer. A later reload keeps
  // those choices: only customers new to the list get ticked, and ones who left it are dropped.
  useEffect(() => {
    if (!audience) return
    const ids = audience.reachable.map((r) => r.customerId)
    const before = knownIds.current
    const now = new Set(ids)
    knownIds.current = now
    setSelected((prev) => {
      if (!before) return now
      const next = new Set([...prev].filter((id) => now.has(id)))
      for (const id of ids) if (!before.has(id)) next.add(id)
      return next
    })
  }, [audience])

  const visible = reachable.filter((r) => !search.trim() || r.name.includes(search.trim()) || r.phone.includes(search.trim()))
  const apiReady = !!whatsApp?.configured
  const needsImage = channel === 'Api' && !!whatsApp?.hasImageHeader && !image
  // The approved template already greets the customer by name ({{1}}), so {الاسم} in the offer would repeat it.
  const nameInTemplate = channel === 'Api' && !!whatsApp?.includeNameVariable
  const nameTwice = nameInTemplate && message.includes(NAME)
  // The offer fills a template variable that Meta will not take empty, so an image alone is not enough here.
  const needsText = channel === 'Api' && !message.trim()

  const chooseChannel = (next: CampaignChannel) => {
    setChannel(next)
    if (next === 'Api' && whatsApp?.includeNameVariable && message.startsWith(GREETING)) setMessage(message.slice(GREETING.length))
    if (next === 'Links' && !message.trim()) setMessage(GREETING)
  }

  const removeName = () =>
    setMessage((m) => (m.startsWith(GREETING) ? m.slice(GREETING.length) : m.split(NAME).join('').replace(/ {2,}/g, ' ')))

  const insertName = () => {
    const el = textRef.current
    const start = el?.selectionStart ?? message.length
    const end = el?.selectionEnd ?? message.length
    setMessage((m) => m.slice(0, start) + NAME + m.slice(end))
    window.setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(start + NAME.length, start + NAME.length)
    }, 0)
  }

  const pickImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('اختر صورة', 'JPG أو PNG أو WEBP')
      return
    }
    setUploading(true)
    try {
      const { base64, contentType, dataUrl } = await compressImage(file)
      const uploaded = await marketingApi.uploadImage(tenantId!, contentType, base64)
      setImage({ ...uploaded, preview: dataUrl })
    } catch (err) {
      toast.error('تعذّر رفع الصورة', apiErrorMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const create = useMutation({
    mutationFn: () =>
      marketingApi.createCampaign(tenantId!, {
        message: message.trim(),
        imageId: image?.id,
        channel,
        customerIds: [...selected],
      }),
    onSuccess: (campaign) => {
      qc.setQueryData(['campaign', tenantId, campaign.id], campaign)
      void qc.invalidateQueries({ queryKey: ['campaigns', tenantId] })
      setLastCreated({ fingerprint, id: campaign.id })
      setConfirmDuplicate(false)
      setOpenCampaignId(campaign.id)
    },
    onError: (err) => toast.error('تعذّر إنشاء الحملة', apiErrorMessage(err)),
  })

  const fingerprint = JSON.stringify([message.trim(), image?.id ?? null, channel, [...selected].sort()])
  const startCampaign = () => {
    if (lastCreated?.fingerprint === fingerprint) setConfirmDuplicate(true)
    else create.mutate()
  }

  const canCreate = (message.trim().length > 0 || !!image) && selected.size > 0 && !needsImage && !needsText && (channel === 'Links' || apiReady)
  const sample = reachable[0]?.name ?? 'محمد'
  // In API mode the customer reads the approved template with the variables filled in.
  const apiOffer = templateText(message.split(NAME).join(sample))
  const apiPreview = whatsApp?.templateBody
    ? fillTemplate(whatsApp.templateBody, nameInTemplate ? [sample, apiOffer] : [apiOffer])
    : nameInTemplate ? `${sample} · ${apiOffer}` : apiOffer

  return (
    <div>
      <PageHeader
        title="حملات واتساب"
        description="أرسل عروضك للعملاء الموافقين على استلامها"
        icon={<Megaphone className="h-5 w-5" />}
        action={
          <Button variant="secondary" onClick={() => setShowSettings(true)}>
            <Settings2 className="h-4 w-4" />
            واتساب للأعمال
          </Button>
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="space-y-5 p-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="offer-text" className="text-sm font-medium text-fg">نص العرض</label>
                <button type="button" onClick={insertName} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-brand-ink hover:bg-brand-soft">
                  + اسم العميل
                </button>
              </div>
              <textarea
                id="offer-text"
                ref={textRef}
                className="input min-h-36 resize-y leading-7"
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="مثال: خصم 20% على كل المشروبات الباردة اليوم فقط"
              />
              <p className="mt-1 flex justify-between text-xs text-muted">
                <span>{`${NAME} يتبدّل باسم كل عميل`}</span>
                <span className="tabular-nums">{message.length}/{MAX_MESSAGE}</span>
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">صورة العرض <span className="font-normal text-muted">(اختياري)</span></p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="offer-image"
                onChange={(e) => void pickImage(e.target.files?.[0])} />
              {image ? (
                <div className="flex items-center gap-3">
                  <img src={image.preview} alt="صورة العرض" className="h-20 w-20 rounded-lg border border-border object-cover" />
                  <Button variant="secondary" size="sm" onClick={() => setImage(null)}>
                    <X className="h-4 w-4" />
                    إزالة
                  </Button>
                </div>
              ) : (
                <label htmlFor="offer-image"
                  className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted hover:bg-surface-2', uploading && 'pointer-events-none opacity-60')}>
                  <ImagePlus className="h-5 w-5" />
                  {uploading ? 'جارٍ تجهيز الصورة…' : 'اختر صورة من جهازك'}
                </label>
              )}
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg">طريقة الإرسال</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <ChannelOption
                  checked={channel === 'Links'}
                  onSelect={() => chooseChannel('Links')}
                  title="روابط واتساب (مجاني)"
                  body="تفتح محادثة كل عميل والنص جاهز، وتضغط إرسال بنفسك. الصورة تصل كرابط."
                />
                <ChannelOption
                  checked={channel === 'Api'}
                  onSelect={() => chooseChannel('Api')}
                  disabled={!apiReady}
                  title="واتساب للأعمال (تلقائي)"
                  body={apiReady ? 'ترسل المنصة للجميع بالصورة عبر قالبك المعتمد.' : 'يحتاج إعداد حساب Meta أولاً.'}
                  action={!apiReady ? <button type="button" onClick={() => setShowSettings(true)} className="text-xs font-medium text-brand-ink underline">إعداد الآن</button> : undefined}
                />
              </div>
              {channel === 'Api' && (
                <p className="mt-2 text-xs text-muted">في الإرسال التلقائي تتحول أسطر النص إلى سطر واحد مفصول بـ « · »، لأن قوالب واتساب لا تقبل أسطراً جديدة في المتغيرات.</p>
              )}
              {needsImage && <p className="mt-2 text-xs text-warning">قالبك المعتمد فيه صورة، أضف صورة للحملة.</p>}
              {needsText && <p className="mt-2 text-xs text-warning">اكتب نص العرض، فقالب واتساب لا يُرسَل بدونه.</p>}
              {nameTwice && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-warning">
                  {`قالبك يذكر اسم العميل بنفسه، فوجود ${NAME} في النص يكرر الاسم.`}
                  <button type="button" onClick={removeName} className="font-medium text-brand-ink underline">{`إزالة ${NAME}`}</button>
                </p>
              )}
            </fieldset>
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <p className="text-sm font-medium text-fg">
                المستلمون <span className="tabular-nums text-muted">({selected.size.toLocaleString(intlLocale())} من {reachable.length.toLocaleString(intlLocale())})</span>
              </p>
              <div className="relative ms-auto w-full max-w-56">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input className="input ps-9 text-sm" placeholder="بحث بالاسم أو الجوال" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث في المستلمين" />
              </div>
              <button type="button" className="text-xs font-medium text-brand-ink"
                onClick={() => setSelected(selected.size === reachable.length ? new Set() : new Set(reachable.map((r) => r.customerId)))}>
                {selected.size === reachable.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            </div>

            {audience && (audience.withoutConsent > 0 || audience.withoutValidPhone > 0) && (
              <p className="border-b border-border bg-surface-2/60 px-4 py-2 text-xs text-muted">
                {audience.withoutConsent > 0 && <>{audience.withoutConsent.toLocaleString(intlLocale())} عميل لم يوافقوا على العروض بعد. </>}
                {audience.withoutValidPhone > 0 && <>{audience.withoutValidPhone.toLocaleString(intlLocale())} بلا رقم جوال صحيح. </>}
                عدّلهم من <Link to="/customers" className="text-brand-ink underline">صفحة العملاء</Link>.
              </p>
            )}

            {loadingAudience ? (
              <p className="p-6 text-center text-sm text-muted">جارٍ التحميل…</p>
            ) : reachable.length === 0 ? (
              <EmptyState
                icon={<MessageCircle />}
                title="لا يوجد عملاء موافقون على العروض"
                description="عند إضافة عميل أو تعديله، فعّل خيار «يوافق على استلام العروض عبر واتساب» بعد أخذ موافقته."
              />
            ) : (
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {visible.map((r) => (
                  <li key={r.customerId}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <input type="checkbox" className="accent-[rgb(var(--brand-ink))]" checked={selected.has(r.customerId)}
                        onChange={(e) => {
                          const next = new Set(selected)
                          if (e.target.checked) next.add(r.customerId)
                          else next.delete(r.customerId)
                          setSelected(next)
                        }} />
                      <span className="flex-1 truncate text-sm text-fg">{r.name}</span>
                      <span className="text-xs tabular-nums text-muted" dir="ltr">+{r.phone}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <p className="text-sm font-medium text-fg">معاينة عند {sample}</p>
          <div className="rounded-2xl bg-[#e7ddd3] p-4 dark:bg-[#0b141a]">
            <div className="ms-auto max-w-[17rem] overflow-hidden rounded-xl rounded-tr-sm bg-white text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
              {image && <img src={image.preview} alt="" className="max-h-60 w-full object-cover" />}
              <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm leading-6">
                {channel === 'Api' ? apiPreview || '…' : personalizedMessage(message, sample).trim() || '…'}
              </p>
              {channel === 'Links' && image && <p className="px-3 pb-2 text-xs text-[#027eb5] underline" dir="ltr">{window.location.host}/api/v1/public/media/…</p>}
            </div>
          </div>
          {channel === 'Api' && !whatsApp?.templateBody && (
            <p className="flex gap-1.5 text-xs leading-5 text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {`هذا ما يُملأ في متغيرات قالب «${whatsApp?.templateName ?? ''}». افحص الاتصال من «واتساب للأعمال» مع WABA ID لترى نص القالب كاملاً.`}
            </p>
          )}
          <Button className="w-full" disabled={!canCreate} loading={create.isPending} onClick={startCampaign}>
            <Send className="h-4 w-4" />
            {channel === 'Api' ? `إنشاء الحملة وإرسالها لـ ${selected.size.toLocaleString(intlLocale())}` : `تجهيز الإرسال لـ ${selected.size.toLocaleString(intlLocale())}`}
          </Button>
          {channel === 'Api' && apiReady && (
            <details className="rounded-xl border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-fg">جرّب العرض على رقمك أولاً</summary>
              <div className="mt-2 space-y-1.5">
                <WhatsAppTestSend message={message} imageId={image?.id} name={sample} disabled={needsImage || needsText} />
                <p className="text-xs text-muted">تصلك الرسالة كما ستصل لعملائك، ولا تُنشأ حملة.</p>
              </div>
            </details>
          )}
          <p className="text-xs leading-5 text-muted">
            أرسل فقط لمن وافق على استلام عروضك. الإزعاج بالرسائل قد يعرّض رقمك للحظر من واتساب.
          </p>

          {campaigns.length > 0 && (
            <Card className="p-0">
              <p className="border-b border-border px-4 py-3 text-sm font-medium text-fg">الحملات السابقة</p>
              <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                {campaigns.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setOpenCampaignId(c.id)} className="w-full px-4 py-3 text-start hover:bg-surface-2">
                      <p className="truncate text-sm text-fg">{c.message || 'صورة فقط'}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                        <span>{new Date(c.createdAt).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })}</span>
                        <span>{c.channel === 'Api' ? 'تلقائي' : 'روابط'}</span>
                        <span className="tabular-nums">{c.sent.toLocaleString(intlLocale())}/{c.total.toLocaleString(intlLocale())} أُرسلت</span>
                        {c.failed > 0 && <span className="tabular-nums text-danger">{c.failed.toLocaleString(intlLocale())} فشلت</span>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <WhatsAppSettingsModal open={showSettings} onClose={() => setShowSettings(false)} current={whatsApp} />
      {openCampaignId && <CampaignRunner campaignId={openCampaignId} onClose={() => setOpenCampaignId(null)} />}
      <Modal
        open={confirmDuplicate}
        onClose={() => setConfirmDuplicate(false)}
        title="الحملة نفسها موجودة"
        size="sm"
        footer={
          <>
            <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate()}>إنشاء حملة ثانية</Button>
            <Button
              onClick={() => {
                setConfirmDuplicate(false)
                if (lastCreated) setOpenCampaignId(lastCreated.id)
              }}
            >
              فتح الحملة السابقة
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          أنشأت قبل قليل حملة بنفس النص والمستلمين. حملة ثانية ترسل لهم العرض مرة أخرى.
        </p>
      </Modal>
    </div>
  )
}

function ChannelOption({ checked, onSelect, disabled, title, body, action }: {
  checked: boolean
  onSelect: () => void
  disabled?: boolean
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <label className={cn(
      'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
      checked ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2',
      disabled && 'cursor-not-allowed opacity-70',
    )}>
      <input type="radio" name="channel" className="mt-1 accent-[rgb(var(--brand-ink))]" checked={checked} disabled={disabled} onChange={onSelect} />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs leading-5 text-muted">{body}</span>
        {action}
      </span>
    </label>
  )
}

// Sends one campaign: link by link for the free channel, or in automatic batches through the WhatsApp API.
function CampaignRunner({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const key = ['campaign', tenantId, campaignId]
  const [running, setRunning] = useState(false)
  const [stopReason, setStopReason] = useState<string | null>(null)
  const stopRef = useRef(false)
  const { data: campaign } = useQuery({
    queryKey: key,
    queryFn: () => marketingApi.campaign(tenantId!, campaignId),
    enabled: !!tenantId,
    // Always fresh on open: progress or another device's lease may have changed since it was last shown.
    staleTime: 0,
    // While another tab or device is sending, or a batch this tab lost track of is still running, look again every
    // few seconds so the button frees up when it stops.
    refetchInterval: (q) => {
      const c = q.state.data
      return c?.sendingRunnerId && (c.sendingRunnerId !== TAB_RUNNER_ID || c.batchInProgress) ? 5_000 : false
    },
  })
  const busyElsewhere = !running && !!campaign?.sendingRunnerId && campaign.sendingRunnerId !== TAB_RUNNER_ID
  // This tab's request timed out or the connection dropped, but the server is still sending that batch.
  const busyHere = !running && !busyElsewhere && !!campaign?.batchInProgress
  const busy = busyElsewhere || busyHere

  const update = (c: Campaign) => {
    qc.setQueryData(key, c)
    void qc.invalidateQueries({ queryKey: ['campaigns', tenantId] })
  }

  const runApi = async () => {
    if (!campaign) return
    stopRef.current = false
    setStopReason(null)
    setRunning(true)
    let lostTrack = false
    try {
      let current = campaign
      while (!stopRef.current && current.recipients?.some((r) => r.status === 'Pending')) {
        current = await marketingApi.sendBatch(tenantId!, campaignId, TAB_RUNNER_ID)
        update(current)
      }
      if (!stopRef.current) toast.success('انتهى الإرسال', `${current.sent.toLocaleString(intlLocale())} أُرسلت · ${current.failed.toLocaleString(intlLocale())} فشلت`)
    } catch (err) {
      if (isAxiosError(err) && !err.response) {
        // No answer: the server may still be sending this batch, so it keeps the lease until the batch ends.
        lostTrack = true
        toast.warning('انقطع الاتصال أثناء الإرسال', 'ننتظر انتهاء الدفعة الحالية، ثم يمكنك المتابعة.')
      } else if (isAxiosError(err) && err.response?.status === 409) {
        // Another tab or device holds the lease; the banner below says so, nothing needs fixing.
        toast.info('الإرسال جارٍ الآن', apiErrorMessage(err))
      } else {
        // Token, template, payment or connection: the rest stay waiting and the reason stays on screen.
        const reason = apiErrorMessage(err)
        setStopReason(reason)
        toast.error('توقف الإرسال', reason)
      }
      void qc.invalidateQueries({ queryKey: key })
    } finally {
      setRunning(false)
      // Paused or closed: another device can carry on straight away instead of waiting for the lease to run out.
      if (!lostTrack) void marketingApi.releaseSending(tenantId!, campaignId, TAB_RUNNER_ID).catch(() => undefined)
    }
  }

  const retry = useMutation({
    mutationFn: () => marketingApi.retryFailed(tenantId!, campaignId),
    onSuccess: update,
    onError: (err) => toast.error('تعذّرت إعادة المحاولة', apiErrorMessage(err)),
  })

  const markSent = useMutation({
    mutationFn: (recipientId: string) => marketingApi.markSent(tenantId!, campaignId, recipientId),
    onSuccess: update,
  })

  const openChat = (recipientId: string, name: string, phone: string) => {
    if (!campaign) return
    window.open(whatsAppUrl(phone, personalizedMessage(campaign.message, name, publicUrl(campaign.imagePath))), '_blank', 'noopener')
    markSent.mutate(recipientId)
  }

  const recipients = campaign?.recipients ?? []
  const pending = recipients.filter((r) => r.status === 'Pending').length
  const progress = campaign && campaign.total > 0 ? Math.round(((campaign.sent + campaign.failed) / campaign.total) * 100) : 0
  const nextLink = recipients.find((r) => r.status === 'Pending')

  return (
    <Modal
      open
      onClose={() => {
        stopRef.current = true
        onClose()
      }}
      title={campaign?.channel === 'Api' ? 'إرسال تلقائي' : 'إرسال بالروابط'}
      size="lg"
      footer={
        campaign?.channel === 'Api' ? (
          <>
            {campaign.failed > 0 && !running && (
              <Button variant="secondary" loading={retry.isPending} disabled={busy} onClick={() => retry.mutate()}>
                <RefreshCw className="h-4 w-4" />
                إعادة محاولة الفاشلة
              </Button>
            )}
            {running ? (
              <Button variant="secondary" onClick={() => (stopRef.current = true)}>إيقاف مؤقت</Button>
            ) : (
              <Button disabled={pending === 0 || busy} onClick={() => void runApi()}>
                <Send className="h-4 w-4" />
                {campaign.sent + campaign.failed > 0 ? 'متابعة الإرسال' : 'بدء الإرسال'}
              </Button>
            )}
          </>
        ) : (
          nextLink && (
            <Button onClick={() => openChat(nextLink.id, nextLink.name, nextLink.phone)}>
              <MessageCircle className="h-4 w-4" />
              فتح المحادثة التالية: {nextLink.name}
            </Button>
          )
        )
      }
    >
      {!campaign ? (
        <p className="py-8 text-center text-sm text-muted">جارٍ التحميل…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-fg">
                أُرسلت <span className="tabular-nums font-semibold">{campaign.sent.toLocaleString(intlLocale())}</span> من{' '}
                <span className="tabular-nums">{campaign.total.toLocaleString(intlLocale())}</span>
                {campaign.failed > 0 && <span className="text-danger"> · فشلت {campaign.failed.toLocaleString(intlLocale())}</span>}
              </span>
              <span className="tabular-nums text-muted">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {campaign.channel === 'Api' && busyElsewhere && (
            <p className="flex gap-2 rounded-lg bg-info/10 px-3 py-2 text-xs leading-5 text-info" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              الحملة تُرسل الآن من جهاز أو نافذة أخرى. يتاح الإرسال هنا حين يتوقف هناك، أو خلال دقيقة ونصف إن أُغلقت.
            </p>
          )}

          {campaign.channel === 'Api' && busyHere && (
            <p className="flex gap-2 rounded-lg bg-info/10 px-3 py-2 text-xs leading-5 text-info" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              الدفعة السابقة ما زالت تُرسل، يتاح «متابعة الإرسال» حين تنتهي.
            </p>
          )}

          {campaign.channel === 'Api' && stopReason && !running && !busy && (
            <div className="flex gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs leading-5 text-danger" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {stopReason}
                <span className="block text-muted">الباقون ما زالوا بالانتظار، اضغط «متابعة الإرسال» بعد إصلاح السبب.</span>
              </p>
            </div>
          )}

          {campaign.channel === 'Links' && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-5 text-muted">
              كل ضغطة تفتح واتساب على محادثة العميل والنص جاهز، اضغط إرسال هناك ثم ارجع هنا للتالي.
            </p>
          )}

          <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                {r.status === 'Sent' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="أُرسلت" />
                ) : r.status === 'Failed' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-label="فشلت" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border" aria-label="بالانتظار" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{r.name}</span>
                  {r.error && <span className="block truncate text-xs text-danger" title={r.error}>{r.error}</span>}
                </span>
                <span className="text-xs tabular-nums text-muted" dir="ltr">+{r.phone}</span>
                {campaign.channel === 'Links' && (
                  <Button size="sm" variant={r.status === 'Sent' ? 'secondary' : 'primary'} onClick={() => openChat(r.id, r.name, r.phone)}>
                    {r.status === 'Sent' ? 'فتح مجدداً' : 'فتح واتساب'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
