import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { purchasingApi } from '@/api/purchasing'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PurchaseOrderStatus } from '@/types/api'

const statusVariant: Record<PurchaseOrderStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Sent: 'blue',
  Received: 'green',
  Cancelled: 'red',
}

const orderSchema = z.object({
  supplierId: z.string().min(1),
  notes: z.string().optional(),
})

const supplierSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  contactEmail: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderSchema>
type SupplierFormData = z.infer<typeof supplierSchema>

export function PurchasingPage() {
  const [view, setView] = useState<'orders' | 'suppliers'>('orders')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const { branchId, tenantId } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders', branchId],
    queryFn: () => purchasingApi.listPurchaseOrders(branchId!),
    enabled: !!branchId && view === 'orders',
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', tenantId],
    queryFn: () => purchasingApi.listSuppliers(tenantId!),
    enabled: !!tenantId,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  })

  const supplierForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  })

  const createOrder = useMutation({
    mutationFn: (data: OrderFormData) =>
      purchasingApi.createPurchaseOrder(branchId!, { ...data, tenantId: tenantId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
      setShowNewOrder(false)
      reset()
      toast.success(t.purchasing.created, '')
    },
    onError: () => toast.error(t.purchasing.failed, ''),
  })

  const createSupplier = useMutation({
    mutationFn: (data: SupplierFormData) =>
      purchasingApi.createSupplier(tenantId!, {
        name: data.name,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        address: data.address || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', tenantId] })
      setShowNewSupplier(false)
      supplierForm.reset()
      toast.success(t.purchasing.created)
    },
    onError: () => toast.error(t.purchasing.failed),
  })

  const changeStatus = useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: 'send' | 'receive' | 'cancel' }) => {
      switch (action) {
        case 'send': return purchasingApi.send(branchId!, orderId)
        case 'receive': return purchasingApi.receive(branchId!, orderId)
        case 'cancel': return purchasingApi.cancel(branchId!, orderId)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] }),
    onError: () => toast.error(t.purchasing.failed, ''),
  })

  const statusLabel: Record<PurchaseOrderStatus, string> = {
    Draft: t.purchasing.draft,
    Sent: t.purchasing.sent,
    Received: t.purchasing.received,
    Cancelled: t.purchasing.cancelled,
  }

  const viewLabels: Record<'orders' | 'suppliers', string> = {
    orders: t.purchasing.title,
    suppliers: t.purchasing.supplier,
  }

  return (
    <div>
      <PageHeader
        title={t.purchasing.title}
        description={t.purchasing.description}
        action={
          view === 'suppliers' ? (
            <Button onClick={() => setShowNewSupplier(true)}>
              <Plus className="h-4 w-4" />
              {t.purchasing.newSupplier}
            </Button>
          ) : (
            <Button onClick={() => setShowNewOrder(true)}>
              <Plus className="h-4 w-4" />
              {t.purchasing.newOrder}
            </Button>
          )
        }
      />
      <div className="p-6">
        <Card>
          <div className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-800">
              {(['orders', 'suppliers'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    view === v
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {viewLabels[v]}
                </button>
              ))}
            </div>
          </div>

          {view === 'orders' ? (
            <Table
              loading={isLoading}
              data={(Array.isArray(orders?.data) ? orders!.data : ((orders?.data as any)?.items ?? [])) as import('@/types/api').PurchaseOrderResponse[]}
              keyExtractor={(r) => r.id}
              emptyMessage={t.purchasing.noOrders}
              columns={[
                {
                  key: 'id',
                  header: '#',
                  render: (r) => (
                    <span className="font-mono text-sm font-medium">{r.id.slice(-8).toUpperCase()}</span>
                  ),
                },
                {
                  key: 'supplierName',
                  header: t.purchasing.supplier,
                  render: (r) => {
                    const supplierList = Array.isArray(suppliers?.data) ? suppliers!.data : ((suppliers?.data as any)?.items ?? [])
                    const found = supplierList.find((s: { id: string; name: string }) => s.id === r.supplierId)
                    return found?.name ?? '—'
                  },
                },
                {
                  key: 'totalCost',
                  header: t.purchasing.total,
                  render: (r) => (
                    <span className="font-semibold tabular-nums">{formatCurrency(r.totalCost)}</span>
                  ),
                },
                {
                  key: 'status',
                  header: t.purchasing.status,
                  render: (r) => (
                    <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge>
                  ),
                },
                {
                  key: 'createdAt',
                  header: t.purchasing.date,
                  render: (r) => formatDate(r.createdAt),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (r) => (
                    <div className="flex gap-1">
                      {r.status === 'Draft' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => changeStatus.mutate({ orderId: r.id, action: 'send' })}
                        >
                          {t.purchasing.sent}
                        </Button>
                      )}
                      {r.status === 'Sent' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => changeStatus.mutate({ orderId: r.id, action: 'receive' })}
                        >
                          {t.purchasing.received}
                        </Button>
                      )}
                      {(r.status === 'Draft' || r.status === 'Sent') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => changeStatus.mutate({ orderId: r.id, action: 'cancel' })}
                        >
                          {t.common.cancel}
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <Table
              data={suppliers?.data ?? []}
              keyExtractor={(r) => r.id}
              emptyMessage={t.common.noData}
              columns={[
                {
                  key: 'name',
                  header: t.purchasing.supplier,
                  render: (r) => (
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.contactEmail ?? '—'}</p>
                    </div>
                  ),
                },
                { key: 'contactEmail', header: t.customers.email, render: (r) => r.contactEmail ?? '—' },
                { key: 'contactPhone', header: t.customers.phone, render: (r) => r.contactPhone ?? '—' },
                {
                  key: 'isActive',
                  header: t.products.status,
                  render: (r) => (
                    <Badge variant={r.isActive ? 'green' : 'gray'}>
                      {r.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Modal
        open={showNewSupplier}
        onClose={() => { setShowNewSupplier(false); supplierForm.reset() }}
        title={t.purchasing.newSupplier}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowNewSupplier(false); supplierForm.reset() }}>{t.common.cancel}</Button>
            <Button loading={createSupplier.isPending} onClick={supplierForm.handleSubmit((d) => createSupplier.mutate(d))}>
              {t.common.create}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label={t.purchasing.supplierName} error={supplierForm.formState.errors.name?.message} {...supplierForm.register('name')} />
          <Input label={t.purchasing.supplierEmail} type="email" error={supplierForm.formState.errors.contactEmail?.message} {...supplierForm.register('contactEmail')} />
          <Input label={t.purchasing.supplierPhone} {...supplierForm.register('contactPhone')} />
          <Input label={t.purchasing.supplierAddress} {...supplierForm.register('address')} />
        </form>
      </Modal>

      <Modal
        open={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        title={t.purchasing.newOrder}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewOrder(false)}>{t.common.cancel}</Button>
            <Button loading={createOrder.isPending} onClick={handleSubmit((d) => createOrder.mutate(d))}>
              {t.common.create}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Select label={t.purchasing.supplier} error={errors.supplierId?.message} {...register('supplierId')}>
            <option value="">{t.purchasing.supplier}...</option>
            {suppliers?.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Input label={t.inventory.notes} {...register('notes')} />
        </form>
      </Modal>
    </div>
  )
}
