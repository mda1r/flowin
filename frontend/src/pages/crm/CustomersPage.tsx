import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Star } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import type { CustomerResponse } from '@/types/api'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CustomerResponse | null>(null)
  const { tenantId } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', tenantId, search],
    queryFn: () => customersApi.list(tenantId!, { search }),
    enabled: !!tenantId,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const save = useMutation({
    mutationFn: (formData: FormData) =>
      editing
        ? customersApi.update(tenantId!, editing.id, formData)
        : customersApi.create(tenantId!, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
      setShowModal(false)
      setEditing(null)
      reset()
      toast.success(editing ? t.customers.updated : t.customers.created)
    },
    onError: () => toast.error(t.customers.failed),
  })

  const openCreate = () => {
    setEditing(null)
    reset({})
    setShowModal(true)
  }

  const openEdit = (customer: CustomerResponse) => {
    setEditing(customer)
    reset({
      name: customer.name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    })
    setShowModal(true)
  }

  return (
    <div>
      <PageHeader
        title={t.customers.title}
        description={t.customers.description}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t.customers.addCustomer}
          </Button>
        }
      />
      <div className="p-6">
        <Card>
          <div className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t.common.search + '...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>
          <Table
            loading={isLoading}
            data={data?.data ?? []}
            keyExtractor={(r) => r.id}
            onRowClick={openEdit}
            emptyMessage={t.customers.noCustomers}
            columns={[
              {
                key: 'name',
                header: t.customers.name,
                render: (r) => (
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.email ?? r.phone ?? '—'}</p>
                  </div>
                ),
              },
              {
                key: 'loyaltyPoints',
                header: t.customers.loyaltyPoints,
                render: (r) => (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="tabular-nums font-medium">{r.loyaltyPoints}</span>
                  </div>
                ),
              },
              {
                key: 'isActive',
                header: t.common.active,
                render: (r) => (
                  <Badge variant={r.isActive ? 'green' : 'gray'}>
                    {r.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                ),
              },
              {
                key: 'createdAt',
                header: t.sales.date,
                render: (r) => new Date(r.createdAt).toLocaleDateString(),
              },
            ]}
          />
        </Card>
      </div>

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? t.customers.editCustomer : t.customers.newCustomer}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</Button>
            <Button loading={save.isPending} onClick={handleSubmit((d) => save.mutate(d))}>
              {editing ? t.common.update : t.common.create}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label={t.customers.name} error={errors.name?.message} {...register('name')} />
          <Input label={t.customers.email} type="email" error={errors.email?.message} {...register('email')} />
          <Input label={t.customers.phone} type="tel" {...register('phone')} />
          <Input label={t.customers.address} {...register('address')} />
        </form>
      </Modal>
    </div>
  )
}
