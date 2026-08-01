import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  FileText, Plus, Pencil, Printer, Trash2, PenLine,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { rentalContractsApi } from '@/api/rentalContracts'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { RentalContractResponse, ContractStatus } from '@/types/api'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ContractStatus, string> = {
  Draft: 'مسودة',
  Active: 'نشط',
  Executed: 'موقّع',
  Cancelled: 'ملغي',
}

const STATUS_BADGE: Record<ContractStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Active: 'blue',
  Executed: 'green',
  Cancelled: 'red',
}

// ── Zod schema ─────────────────────────────────────────────────────────────────

const clauseSchema = z.object({
  title: z.string().min(1, 'عنوان البند مطلوب'),
  body: z.string().min(1, 'نص البند مطلوب'),
})

const contractSchema = z.object({
  tenantName: z.string().min(2, 'اسم المستأجر مطلوب'),
  tenantNationalId: z.string().min(3, 'رقم الهوية مطلوب'),
  tenantPhone: z.string().min(9, 'رقم الهاتف مطلوب'),
  roomNumber: z.string().min(1, 'رقم الغرفة مطلوب'),
  startDate: z.string().min(1, 'تاريخ البدء مطلوب'),
  endDate: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
  monthlyRent: z.coerce.number().positive('الإيجار يجب أن يكون أكبر من صفر'),
  landlordName: z.string().min(2, 'اسم المؤجر مطلوب'),
  notes: z.string().optional(),
  clauses: z.array(clauseSchema),
})

type ContractFormData = z.infer<typeof contractSchema>

// ── Print helper ───────────────────────────────────────────────────────────────

function printContract(contract: RentalContractResponse) {
  const monthCount = (() => {
    const s = new Date(contract.startDate)
    const e = new Date(contract.endDate)
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30))
  })()

  const clausesHtml = contract.clauses
    .sort((a, b) => a.order - b.order)
    .map(
      (c, i) => `
      <div class="clause">
        <p class="clause-title">البند ${i + 1}: ${c.title}</p>
        <p class="clause-body">${c.body}</p>
      </div>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>عقد إيجار – ${contract.tenantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Arial', 'Tahoma', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 13px;
      line-height: 1.7;
      color: #111;
      background: #fff;
      padding: 40px 50px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #555; }
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
      margin-bottom: 12px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .info-row { display: flex; gap: 6px; }
    .info-label { font-weight: bold; min-width: 120px; }
    .clause { margin-bottom: 14px; }
    .clause-title { font-weight: bold; margin-bottom: 4px; }
    .clause-body { color: #333; text-align: justify; }
    .signatures {
      margin-top: 60px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .sig-box { border-top: 1px solid #333; padding-top: 10px; }
    .sig-label { font-weight: bold; margin-bottom: 60px; }
    .sig-line { border-bottom: 1px dotted #999; margin-bottom: 6px; }
    .sig-sub { font-size: 11px; color: #666; text-align: center; }
    @media print {
      body { padding: 20px 30px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>عقد إيجار</h1>
    <p>تاريخ الإنشاء: ${formatDate(contract.createdAt, 'ar-SA')}</p>
  </div>

  <div class="section">
    <div class="section-title">أطراف العقد</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">المؤجر (صاحب الفندق):</span><span>${contract.landlordName}</span></div>
      <div class="info-row"><span class="info-label">المستأجر:</span><span>${contract.tenantName}</span></div>
      <div class="info-row"><span class="info-label">رقم هوية المستأجر:</span><span>${contract.tenantNationalId}</span></div>
      <div class="info-row"><span class="info-label">هاتف المستأجر:</span><span>${contract.tenantPhone}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">تفاصيل العقد</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">رقم الغرفة / الوحدة:</span><span>${contract.roomNumber}</span></div>
      <div class="info-row"><span class="info-label">الإيجار الشهري:</span><span>${formatCurrency(contract.monthlyRent, contract.currency)}</span></div>
      <div class="info-row"><span class="info-label">تاريخ البدء:</span><span>${formatDate(contract.startDate, 'ar-SA')}</span></div>
      <div class="info-row"><span class="info-label">تاريخ الانتهاء:</span><span>${formatDate(contract.endDate, 'ar-SA')}</span></div>
      <div class="info-row"><span class="info-label">مدة العقد:</span><span>${monthCount} شهر</span></div>
      <div class="info-row"><span class="info-label">إجمالي قيمة العقد:</span><span>${formatCurrency(contract.monthlyRent * monthCount, contract.currency)}</span></div>
    </div>
    ${contract.notes ? `<p style="margin-top:10px;"><strong>ملاحظات:</strong> ${contract.notes}</p>` : ''}
  </div>

  ${
    contract.clauses.length > 0
      ? `<div class="section">
    <div class="section-title">بنود العقد</div>
    ${clausesHtml}
  </div>`
      : ''
  }

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">المؤجر<br><small>${contract.landlordName}</small></div>
      <div class="sig-line"></div>
      <div class="sig-sub">التوقيع / الختم</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">المستأجر<br><small>${contract.tenantName}</small></div>
      <div class="sig-line"></div>
      <div class="sig-sub">التوقيع</div>
    </div>
  </div>

</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0'
  document.body.appendChild(iframe)
  iframe.srcdoc = html
  iframe.addEventListener('load', () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }, 2000)
    }
  })
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ContractsPage() {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<RentalContractResponse | null>(null)

  const { branchId } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['rental-contracts', branchId],
    queryFn: () => rentalContractsApi.list(branchId!),
    enabled: !!branchId,
  })

  const contracts: RentalContractResponse[] = data?.data ?? []

  const sign = useMutation({
    mutationFn: (contractId: string) => rentalContractsApi.sign(branchId!, contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rental-contracts', branchId] })
      toast.success('تم التوقيع', 'تم تسجيل العقد كموقّع')
    },
    onError: () => toast.error('فشل التوقيع', 'يرجى المحاولة مرة أخرى'),
  })

  function openCreate() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(contract: RentalContractResponse) {
    setEditing(contract)
    setShowModal(true)
  }

  return (
    <div dir="rtl">
      <PageHeader
        title="عقود الإيجار"
        description="إنشاء عقود الإيجار وطباعتها وإدارتها"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            عقد جديد
          </Button>
        }
      />

      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText className="mb-3 h-12 w-12 text-gray-300" />
            <p className="font-medium text-gray-600 dark:text-gray-400">لا توجد عقود إيجار بعد</p>
            <p className="text-sm text-gray-400">أنشئ أول عقد باستخدام زر "عقد جديد"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => (
              <ContractRow
                key={c.id}
                contract={c}
                onEdit={() => openEdit(c)}
                onPrint={() => printContract(c)}
                onSign={() => sign.mutate(c.id)}
                signPending={sign.isPending && sign.variables === c.id}
              />
            ))}
          </div>
        )}
      </div>

      <ContractModal
        open={showModal}
        onClose={() => setShowModal(false)}
        branchId={branchId!}
        editing={editing}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['rental-contracts', branchId] })
          setShowModal(false)
        }}
      />
    </div>
  )
}

// ── Contract row ───────────────────────────────────────────────────────────────

function ContractRow({
  contract,
  onEdit,
  onPrint,
  onSign,
  signPending,
}: {
  contract: RentalContractResponse
  onEdit: () => void
  onPrint: () => void
  onSign: () => void
  signPending: boolean
}) {
  const canEdit = contract.status === 'Draft' || contract.status === 'Active'
  const canSign = contract.status !== 'Executed' && contract.status !== 'Cancelled'

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{contract.tenantName}</p>
          <Badge variant={STATUS_BADGE[contract.status]}>{STATUS_LABEL[contract.status]}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
          <span>غرفة {contract.roomNumber}</span>
          <span>·</span>
          <span>{formatCurrency(contract.monthlyRent, contract.currency)} / شهر</span>
          <span>·</span>
          <span>
            {formatDate(contract.startDate, 'ar-SA')} – {formatDate(contract.endDate, 'ar-SA')}
          </span>
          {contract.clauses.length > 0 && (
            <>
              <span>·</span>
              <span>{contract.clauses.length} بند</span>
            </>
          )}
        </div>
        {contract.signedAt && (
          <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
            وُقِّع في {formatDate(contract.signedAt, 'ar-SA')}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onPrint} title="طباعة العقد">
          <Printer className="h-4 w-4" />
        </Button>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={onEdit} title="تعديل">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {canSign && (
          <Button size="sm" variant="primary" loading={signPending} onClick={onSign}>
            <PenLine className="h-4 w-4" />
            توقيع
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Contract modal ─────────────────────────────────────────────────────────────

function ContractModal({
  open,
  onClose,
  branchId,
  editing,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  branchId: string
  editing: RentalContractResponse | null
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: editing
      ? {
          tenantName: editing.tenantName,
          tenantNationalId: editing.tenantNationalId,
          tenantPhone: editing.tenantPhone,
          roomNumber: editing.roomNumber,
          startDate: editing.startDate.split('T')[0],
          endDate: editing.endDate.split('T')[0],
          monthlyRent: editing.monthlyRent,
          landlordName: editing.landlordName,
          notes: editing.notes ?? '',
          clauses: editing.clauses.map((c) => ({ title: c.title, body: c.body })),
        }
      : {
          tenantName: '',
          tenantNationalId: '',
          tenantPhone: '',
          roomNumber: '',
          startDate: '',
          endDate: '',
          monthlyRent: 0,
          landlordName: '',
          notes: '',
          clauses: [],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'clauses' })

  const create = useMutation({
    mutationFn: (data: ContractFormData) =>
      rentalContractsApi.create(branchId, {
        ...data,
        clauses: data.clauses.map((c, i) => ({ order: i + 1, title: c.title, body: c.body })),
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('تم الإنشاء', 'تم إنشاء العقد بنجاح')
      reset()
      onSuccess()
    },
    onError: () => toast.error('فشل الإنشاء', 'يرجى التحقق من البيانات'),
  })

  const update = useMutation({
    mutationFn: (data: ContractFormData) =>
      rentalContractsApi.update(branchId, editing!.id, {
        ...data,
        clauses: data.clauses.map((c, i) => ({ order: i + 1, title: c.title, body: c.body })),
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('تم التحديث', 'تم تحديث العقد بنجاح')
      onSuccess()
    },
    onError: () => toast.error('فشل التحديث', 'يرجى التحقق من البيانات'),
  })

  function onSubmit(data: ContractFormData) {
    if (editing) {
      update.mutate(data)
    } else {
      create.mutate(data)
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'تعديل العقد' : 'عقد إيجار جديد'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={isPending} onClick={handleSubmit(onSubmit)}>
            {editing ? 'حفظ التعديلات' : 'إنشاء العقد'}
          </Button>
        </>
      }
    >
      <form className="max-h-[65vh] overflow-y-auto space-y-5 pr-1" dir="rtl">
        {/* ── Parties ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">أطراف العقد</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="اسم المستأجر"
              placeholder="محمد أحمد"
              error={errors.tenantName?.message}
              {...register('tenantName')}
            />
            <Input
              label="اسم المؤجر (صاحب الفندق)"
              placeholder="فندق السلام"
              error={errors.landlordName?.message}
              {...register('landlordName')}
            />
            <Input
              label="رقم الهوية / الجواز"
              placeholder="1234567890"
              error={errors.tenantNationalId?.message}
              {...register('tenantNationalId')}
            />
            <Input
              label="رقم الهاتف"
              placeholder="0501234567"
              error={errors.tenantPhone?.message}
              {...register('tenantPhone')}
            />
          </div>
        </div>

        {/* ── Property & dates ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">تفاصيل الإيجار</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="رقم الغرفة / الوحدة"
              placeholder="101"
              error={errors.roomNumber?.message}
              {...register('roomNumber')}
            />
            <Input
              label="تاريخ البدء"
              type="date"
              error={errors.startDate?.message}
              {...register('startDate')}
            />
            <Input
              label="تاريخ الانتهاء"
              type="date"
              error={errors.endDate?.message}
              {...register('endDate')}
            />
          </div>
          <div className="mt-4">
            <Input
              label="الإيجار الشهري (ر.س)"
              type="number"
              step="0.01"
              min="0"
              error={errors.monthlyRent?.message}
              {...register('monthlyRent')}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="ملاحظات (اختياري)"
              placeholder="أي ملاحظات إضافية..."
              rows={2}
              {...register('notes')}
            />
          </div>
        </div>

        {/* ── Clauses ── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              بنود العقد ({fields.length})
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => append({ title: '', body: '' })}
            >
              <Plus className="h-3 w-3" />
              إضافة بند
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-gray-700">
              لا توجد بنود — اضغط "إضافة بند" لإضافة بنود العقد
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      البند {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Input
                      label="عنوان البند"
                      placeholder="مثال: الالتزام بالنظام الداخلي"
                      error={errors.clauses?.[index]?.title?.message}
                      {...register(`clauses.${index}.title`)}
                    />
                    <Textarea
                      label="نص البند"
                      placeholder="اكتب نص البند هنا..."
                      rows={3}
                      error={errors.clauses?.[index]?.body?.message}
                      {...register(`clauses.${index}.body`)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
