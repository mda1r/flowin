import { useMemo, useState } from 'react'
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
import { useI18n } from '@/i18n'
import type { Translations } from '@/i18n/en'
import { apiErrorMessage } from '@/lib/apiError'

const makeSchema = (m: Translations['admin']['createTenant']) =>
  z.object({
    name: z.string().min(1, m.nameRequired),
    subdomain: z
      .string()
      .min(1, m.subdomainRequired)
      .max(63)
      .regex(/^[a-z0-9-]+$/, m.subdomainFormat),
    adminEmail: z.string().email(m.invalidEmail),
    businessType: z.enum(['Retail', 'Supermarket', 'Restaurant', 'Hotel', 'Gaming', 'Cafe']),
    currency: z.string().length(3, m.currencyLength),
    timeZone: z.string().min(1, m.timeZoneRequired),
  })

type FormData = z.infer<ReturnType<typeof makeSchema>>

interface Props {
  onClose: () => void
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
      <div>
        <p className="text-xs text-muted mb-0.5">{label}</p>
        <p className="font-mono text-sm text-fg">{value}</p>
      </div>
      <button
        onClick={copy}
        className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-border transition-colors"
        title={t.admin.createTenant.copy}
      >
        {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function CreateTenantModal({ onClose }: Props) {
  const qc = useQueryClient()
  const { t } = useI18n()
  const [created, setCreated] = useState<TenantWithSubscriptionResponse | null>(null)

  const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
    Retail:      t.admin.dashboard.business.retail,
    Supermarket: t.admin.dashboard.business.supermarket,
    Restaurant:  t.admin.dashboard.business.restaurant,
    Hotel:       t.admin.dashboard.business.hotel,
    Gaming:      t.admin.dashboard.business.gaming,
    Cafe:        t.admin.dashboard.business.cafe,
  }

  const schema = useMemo(() => makeSchema(t.admin.createTenant), [t])
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
    onError: (err) => {
      toast.error(t.admin.createTenant.failed, apiErrorMessage(err))
    },
  })

  if (created) {
    const [createdBefore, createdAfter = ''] = t.admin.createTenant.created.split('{name}')
    return (
      <Modal
        open
        onClose={onClose}
        title={t.admin.createTenant.success}
        footer={<Button onClick={onClose}>{t.common.close}</Button>}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-success/15 border border-success/50 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-success shrink-0" />
            <p className="text-sm text-success">
              {createdBefore}<span className="font-semibold">{created.name}</span>{createdAfter}
            </p>
          </div>
          <div className="space-y-2">
            <CredentialRow label={t.admin.createTenant.email} value={created.adminEmail} />
            <CredentialRow label={t.admin.createTenant.password} value={created.defaultPassword ?? 'Nexus@123!'} />
          </div>
          <p className="text-xs text-muted text-center">{t.admin.createTenant.changePasswordHint}</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.admin.createTenant.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            loading={createMut.isPending}
            onClick={handleSubmit((d) => createMut.mutate(d))}
          >
            {t.admin.createTenant.submit}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input
          label={t.admin.createTenant.businessName}
          placeholder={t.admin.createTenant.namePlaceholder}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label={t.admin.createTenant.subdomain}
          placeholder={t.admin.createTenant.subdomainPlaceholder}
          error={errors.subdomain?.message}
          {...register('subdomain')}
        />
        <Input
          label={t.admin.createTenant.email}
          type="email"
          placeholder="admin@alamin.sa"
          error={errors.adminEmail?.message}
          {...register('adminEmail')}
        />
        <Select label={t.admin.createTenant.businessType} error={errors.businessType?.message} {...register('businessType')}>
          {(Object.entries(BUSINESS_TYPE_LABELS) as [BusinessType, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.admin.createTenant.currency}
            placeholder="SAR"
            error={errors.currency?.message}
            {...register('currency')}
          />
          <Input
            label={t.admin.createTenant.timeZone}
            placeholder="Asia/Riyadh"
            error={errors.timeZone?.message}
            {...register('timeZone')}
          />
        </div>
      </form>
    </Modal>
  )
}
