import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, Copy } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { superAdminApi } from '@/api/superadmin'
import { toast } from '@/components/ui/Toast'
import type { BusinessType, TenantWithSubscriptionResponse } from '@/types/api'

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  subdomain: z
    .string()
    .min(1, 'النطاق مطلوب')
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'أحرف لاتينية صغيرة وأرقام وشرطات فقط'),
  adminEmail: z.string().email('بريد إلكتروني غير صالح'),
  businessType: z.enum(['Retail', 'Supermarket', 'Restaurant', 'Hotel', 'Gaming', 'Cafe']),
  currency: z.string().length(3, 'رمز العملة 3 أحرف'),
  timeZone: z.string().min(1, 'المنطقة الزمنية مطلوبة'),
})

type FormData = z.infer<typeof schema>

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  Retail: 'بيع بالتجزئة',
  Supermarket: 'سوبرماركت',
  Restaurant: 'مطعم',
  Hotel: 'فندق',
  Gaming: 'ألعاب',
  Cafe: 'كافيه',
}

interface Props {
  onClose: () => void
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3">
      <div>
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="font-mono text-sm text-white">{value}</p>
      </div>
      <button
        onClick={copy}
        className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        title="نسخ"
      >
        {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function CreateTenantModal({ onClose }: Props) {
  const qc = useQueryClient()
  const [created, setCreated] = useState<TenantWithSubscriptionResponse | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'SAR',
      timeZone: 'Asia/Riyadh',
      businessType: 'Retail',
    },
  })

  const createMut = useMutation({
    mutationFn: (data: FormData) => superAdminApi.createTenant(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      setCreated(res.data)
    },
    onError: (err: { message?: string }) => {
      toast.error('فشل إنشاء المستأجر', err?.message ?? '')
    },
  })

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title="تم إنشاء الحساب بنجاح"
        footer={<Button onClick={onClose}>إغلاق</Button>}
      >
        <div className="space-y-4" dir="rtl">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-900/30 border border-emerald-700/50 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300">
              تم إنشاء حساب <span className="font-semibold">{created.name}</span> وتعيين كلمة مرور افتراضية.
              شارك بيانات الدخول مع المدير.
            </p>
          </div>
          <div className="space-y-2">
            <CredentialRow label="البريد الإلكتروني" value={created.adminEmail} />
            <CredentialRow label="كلمة المرور" value={created.defaultPassword ?? 'Nexus@123!'} />
          </div>
          <p className="text-xs text-slate-500 text-center">يُنصح بتغيير كلمة المرور عند أول تسجيل دخول.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="إضافة مستأجر جديد"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button
            loading={createMut.isPending}
            onClick={handleSubmit((d) => createMut.mutate(d))}
          >
            إنشاء
          </Button>
        </>
      }
    >
      <form className="space-y-4" dir="rtl">
        <Input
          label="اسم الشركة / المنشأة"
          placeholder="مثال: سوبرماركت الأمين"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="النطاق الفرعي"
          placeholder="مثال: alamin"
          error={errors.subdomain?.message}
          {...register('subdomain')}
        />
        <Input
          label="البريد الإلكتروني للمدير"
          type="email"
          placeholder="admin@alamin.sa"
          error={errors.adminEmail?.message}
          {...register('adminEmail')}
        />
        <Select label="نوع النشاط التجاري" error={errors.businessType?.message} {...register('businessType')}>
          {(Object.entries(BUSINESS_TYPE_LABELS) as [BusinessType, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="العملة"
            placeholder="SAR"
            error={errors.currency?.message}
            {...register('currency')}
          />
          <Input
            label="المنطقة الزمنية"
            placeholder="Asia/Riyadh"
            error={errors.timeZone?.message}
            {...register('timeZone')}
          />
        </div>
      </form>
    </Modal>
  )
}
