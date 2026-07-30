import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Save, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { zatcaApi } from '@/api/zatca'
import { toast } from '@/components/ui/Toast'

export function ZatcaSettingsPage() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings().then(r => r.data),
    retry: (count, err: unknown) => {
      if ((err as { status?: number })?.status === 404) { return false }
      return count < 3
    },
  })

  const [sellerName, setSellerName] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [phase2, setPhase2] = useState(false)

  useEffect(() => {
    if (settings) {
      setSellerName(settings.sellerName)
      setVatNumber(settings.vatRegistrationNumber)
      setPhase2(settings.isPhase2Enabled)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () =>
      zatcaApi.saveSettings({
        sellerName: sellerName.trim(),
        vatRegistrationNumber: vatNumber.trim(),
        isPhase2Enabled: phase2,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zatca-settings'] })
      toast.success('تم حفظ إعدادات زاتكا')
    },
    onError: () => toast.error('فشل حفظ الإعدادات'),
  })

  const isConfigured = !!settings
  const vatValid = vatNumber.trim().length >= 15

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      <PageHeader
        title="إعدادات زاتكا"
        description="ربط الفواتير الإلكترونية بهيئة الزكاة والضريبة والجمارك"
      />

      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${
        isConfigured
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        {isConfigured
          ? <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          : <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />}
        <div className="text-sm">
          {isConfigured ? (
            <span className="font-medium text-emerald-800">
              زاتكا مُفعّلة · {settings.invoiceCounter} فاتورة صادرة
            </span>
          ) : (
            <span className="font-medium text-amber-800">
              لم يتم تهيئة زاتكا بعد — أدخل بيانات المُزوِّد أدناه لتفعيل الفوترة الإلكترونية
            </span>
          )}
        </div>
      </div>

      {/* Settings form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <Shield className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">بيانات المُزوِّد</h2>
            <p className="text-xs text-gray-500">المعلومات التي ستظهر على الفواتير الإلكترونية</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                اسم المُزوِّد (اسم المنشأة)
              </label>
              <Input
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
                placeholder="مثال: شركة النور للتجزئة"
                dir="rtl"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                الرقم الضريبي (VAT)
              </label>
              <Input
                value={vatNumber}
                onChange={e => setVatNumber(e.target.value)}
                placeholder="300000000000003"
                dir="ltr"
                className={vatNumber && !vatValid ? 'border-red-300' : ''}
              />
              {vatNumber && !vatValid && (
                <p className="mt-1 text-xs text-red-500">الرقم الضريبي يجب أن يكون 15 رقماً على الأقل</p>
              )}
            </div>

            {/* Phase 2 toggle */}
            <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">تفعيل المرحلة الثانية (Phase 2)</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  ربط الفواتير مباشرةً بمنصة فاتورة — يتطلب شهادة رقمية من الهيئة
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhase2(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  phase2 ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  phase2 ? '-translate-x-6' : '-translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-4">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !sellerName.trim() || !vatValid}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          title="المرحلة الأولى"
          description="إنشاء فواتير XML وكود QR تلقائياً مع كل طلب مكتمل"
          active={isConfigured}
        />
        <InfoCard
          icon={<Shield className="h-5 w-5 text-emerald-600" />}
          title="المرحلة الثانية"
          description="إرسال الفواتير مباشرةً لمنصة فاتورة مع التوقيع الرقمي"
          active={isConfigured && settings?.isPhase2Enabled}
        />
      </div>
    </div>
  )
}

function InfoCard({ icon, title, description, active }: {
  icon: React.ReactNode
  title: string
  description: string
  active?: boolean
}) {
  return (
    <div className={`flex gap-4 rounded-xl border p-4 ${
      active ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
    }`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        active ? 'bg-white' : 'bg-gray-100'
      }`}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {active && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">مُفعّل</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
    </div>
  )
}
