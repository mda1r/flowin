import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Printer, ReceiptText, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { zatcaApi, type ReceiptSettings } from '@/api/zatca'
import { marketingApi } from '@/api/marketing'
import { useAuthStore } from '@/stores/authStore'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { generateZatcaQr } from '@/lib/zatca'
import { compressImage } from '@/lib/image'
import { printElement } from '@/lib/print'
import { apiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'

// A sale that shows every part of the receipt, so the owner sees the whole design before printing a real one.
const SAMPLE = {
  invoiceNo: 'A1B2C3D4',
  lines: [
    { key: '1', name: 'لاتيه', quantity: 2, total: 36 },
    { key: '2', name: 'كرواسون', quantity: 1, total: 14 },
  ],
  subtotal: 43.48,
  tax: 6.52,
  total: 50,
}

export function ReceiptSettingsPage() {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const saved = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  const [draft, setDraft] = useState<ReceiptSettings>(saved)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const issuedAt = useRef(new Date().toISOString()).current

  useEffect(() => setDraft(saved), [saved])

  const set = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const pickLogo = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('اختر صورة للشعار', 'PNG أو JPG')
      return
    }
    setUploading(true)
    try {
      // receipts print in one colour at small size; 600px is plenty and keeps the upload light
      const { base64, contentType } = await compressImage(file, 600, 0.9)
      const uploaded = await marketingApi.uploadImage(tenantId!, contentType, base64)
      set('logoPath', uploaded.path)
    } catch (err) {
      toast.error('تعذّر رفع الشعار', apiErrorMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = useMutation({
    mutationFn: () => zatcaApi.saveReceiptSettings(draft).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['receipt-settings', tenantId], data)
      toast.success('حُفظ تصميم الفاتورة', 'يُطبَّق على كل الفواتير من الآن')
    },
    onError: (err) => toast.error('تعذّر الحفظ', apiErrorMessage(err)),
  })

  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  const qr = generateZatcaQr({
    sellerName: sellerName || 'المتجر',
    vatNumber,
    timestamp: issuedAt,
    totalWithVat: SAMPLE.total,
    vatAmount: SAMPLE.tax,
  })

  return (
    <div>
      <PageHeader
        title="تصميم الفاتورة"
        description="الشعار والبيانات والملاحظات ومقاس ورق طابعة الفواتير"
        icon={<ReceiptText className="h-5 w-5" />}
        action={
          <Button loading={save.isPending} disabled={!changed} onClick={() => save.mutate()}>
            حفظ التصميم
          </Button>
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Card className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-sm font-medium text-fg">شعار المحل</p>
              <input ref={fileRef} id="receipt-logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                onChange={(e) => void pickLogo(e.target.files?.[0])} />
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2">
                  {draft.logoPath ? <img src={draft.logoPath} alt="شعار المحل" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-muted" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label htmlFor="receipt-logo"
                    className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2', uploading && 'pointer-events-none opacity-60')}>
                    <ImagePlus className="h-4 w-4" />
                    {uploading ? 'جارٍ الرفع…' : draft.logoPath ? 'تغيير الشعار' : 'رفع شعار'}
                  </label>
                  {draft.logoPath && (
                    <Button variant="ghost" size="sm" onClick={() => set('logoPath', null)}>
                      <Trash2 className="h-4 w-4" />
                      إزالة
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">يُطبع بالأبيض والأسود على طابعات الفواتير، فالشعار الواضح بخلفية بيضاء يطلع أجمل.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="رقم التواصل" dir="ltr" inputMode="tel" value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="05XXXXXXXX" />
              <Input label="العنوان" value={draft.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="الرياض، حي العليا" />
            </div>

            <div>
              <label htmlFor="header-note" className="mb-1.5 block text-sm font-medium text-fg">نص أعلى الفاتورة</label>
              <textarea id="header-note" className="input min-h-16 resize-y" maxLength={300} value={draft.headerNote ?? ''}
                onChange={(e) => set('headerNote', e.target.value)} placeholder="مثال: أهلاً بك في مقهانا ☕" />
            </div>
            <div>
              <label htmlFor="footer-note" className="mb-1.5 block text-sm font-medium text-fg">نص أسفل الفاتورة</label>
              <textarea id="footer-note" className="input min-h-20 resize-y" maxLength={500} value={draft.footerNote ?? ''}
                onChange={(e) => set('footerNote', e.target.value)} placeholder={'مثال: شكراً لزيارتكم\nالاستبدال خلال 7 أيام مع الفاتورة'} />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg">مقاس ورق الطابعة</legend>
              <div className="grid grid-cols-2 gap-2">
                {([80, 58] as const).map((w) => (
                  <label key={w} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3', draft.paperWidthMm === w ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2')}>
                    <input type="radio" name="paper" className="accent-[rgb(var(--brand-ink))]" checked={draft.paperWidthMm === w} onChange={() => set('paperWidthMm', w)} />
                    <span>
                      <span className="block text-sm font-semibold text-fg tabular-nums">{w} ملم</span>
                      <span className="block text-xs text-muted">{w === 80 ? 'الأكثر انتشاراً في الكاشير' : 'الطابعات الصغيرة والمحمولة'}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2.5 text-sm text-fg">
              <input type="checkbox" className="accent-[rgb(var(--brand-ink))]" checked={draft.showPoweredBy} onChange={(e) => set('showPoweredBy', e.target.checked)} />
              إظهار شعار flowin الصغير أسفل الفاتورة
            </label>
            <p className="text-xs text-muted">
              اسم المحل والرقم الضريبي يُؤخذان من <a href="/settings/zatca" className="text-brand-ink underline">إعدادات زاتكا</a> لأنهما يدخلان في رمز الفاتورة.
            </p>
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-fg">معاينة <span className="text-muted tabular-nums">({draft.paperWidthMm} ملم)</span></p>
            <Button variant="secondary" size="sm" onClick={() => printElement(document.getElementById('receipt-preview'))}>
              <Printer className="h-4 w-4" />
              طباعة تجريبية
            </Button>
          </div>
          <div className="rounded-2xl bg-surface-2 p-4">
            <div className={cn('mx-auto rounded-md bg-surface p-4 shadow-md transition-[max-width]', draft.paperWidthMm === 58 ? 'max-w-[15rem]' : 'max-w-[20rem]')}>
              <ReceiptDocument
                id="receipt-preview"
                settings={draft}
                sellerName={sellerName || 'اسم المحل'}
                vatNumber={vatNumber || '300000000000003'}
                invoiceNo={SAMPLE.invoiceNo}
                issuedAt={issuedAt}
                lines={SAMPLE.lines}
                subtotal={SAMPLE.subtotal}
                tax={SAMPLE.tax}
                total={SAMPLE.total}
                paymentLabel="نقداً"
                tendered={100}
                qr={qr}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
