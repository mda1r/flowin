import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Gift, Megaphone, MessageCircle, Plus, Search, Star } from 'lucide-react'
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
import { CUSTOMERS_PAGE_SIZE, customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import type { CustomerResponse } from '@/types/api'
import { LoyaltySettingsModal } from '@/components/crm/LoyaltySettingsModal'
import { CustomerLoyaltyCard } from '@/components/crm/CustomerLoyaltyCard'
import { apiErrorMessage } from '@/lib/apiError'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  marketingOptIn: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

// Left-empty fields are sent as missing, not as "", so a walk-in with only a name and phone saves cleanly.
const blankToUndefined = (value?: string) => value?.trim() || undefined
const toPayload = (d: FormData) => ({
  name: d.name.trim(),
  email: blankToUndefined(d.email),
  phone: blankToUndefined(d.phone),
  address: blankToUndefined(d.address),
  marketingOptIn: d.marketingOptIn,
})

export function CustomersPage() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CustomerResponse | null>(null)
  const { tenantId, user } = useAuthStore()
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const [showLoyalty, setShowLoyalty] = useState(false)
  const { t } = useI18n()
  const qc = useQueryClient()

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 250)
    return () => window.clearTimeout(id)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['customers', tenantId, 'list', debounced, page],
    queryFn: () => customersApi.list(tenantId!, { search: debounced || undefined, page }),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  })
  const { data: totalCount } = useQuery({
    queryKey: ['customers', tenantId, 'count', debounced],
    queryFn: () => customersApi.count(tenantId!, { search: debounced || undefined }),
    enabled: !!tenantId,
  })
  const rows = data?.data ?? []
  const pageCount = totalCount ? Math.max(1, Math.ceil(totalCount / CUSTOMERS_PAGE_SIZE)) : 1
  const from = rows.length ? (page - 1) * CUSTOMERS_PAGE_SIZE + 1 : 0
  const to = (page - 1) * CUSTOMERS_PAGE_SIZE + rows.length

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const save = useMutation({
    mutationFn: (formData: FormData) =>
      editing
        ? customersApi.update(tenantId!, editing.id, {
            ...toPayload(formData),
            // The form has no birthday or notes yet: send back what is stored so saving does not wipe them.
            dateOfBirth: editing.dateOfBirth ?? null,
            notes: editing.notes ?? null,
          })
        : customersApi.create(tenantId!, toPayload(formData)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
      setShowModal(false)
      setEditing(null)
      reset()
      toast.success(editing ? t.customers.updated : t.customers.created)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.customers.failed)),
  })

  const openCreate = () => {
    setEditing(null)
    reset({ marketingOptIn: false })
    setShowModal(true)
  }

  const openEdit = (customer: CustomerResponse) => {
    setEditing(customer)
    reset({
      name: customer.name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      marketingOptIn: customer.marketingOptIn,
    })
    setShowModal(true)
  }

  return (
    <div>
      <PageHeader
        title={t.customers.title}
        description={t.customers.description}
        action={
          <div className="flex gap-2">
            {canManage && (
              <Link to="/campaigns" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                <Megaphone className="h-4 w-4" />
                حملة واتساب
              </Link>
            )}
            {canManage && (
              <Button variant="secondary" onClick={() => setShowLoyalty(true)}>
                <Gift className="h-4 w-4" />
                برنامج النقاط
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t.customers.addCustomer}
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <Card>
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder={t.common.search + '...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input ps-9"
              />
            </div>
          </div>
          <Table
            loading={isLoading}
            data={rows}
            keyExtractor={(r) => r.id}
            onRowClick={openEdit}
            emptyMessage={t.customers.noCustomers}
            columns={[
              {
                key: 'name',
                header: t.customers.name,
                render: (r) => (
                  <div>
                    <p className="flex items-center gap-1.5 font-medium text-fg">
                      {r.name}
                      {r.marketingOptIn && <MessageCircle className="h-3.5 w-3.5 text-success" aria-label="يوافق على العروض" />}
                    </p>
                    <p className="text-xs text-muted">{r.email ?? r.phone ?? '—'}</p>
                  </div>
                ),
              },
              {
                key: 'loyaltyPoints',
                header: t.customers.loyaltyPoints,
                render: (r) => (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-warning" />
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
                render: (r) => formatDate(r.createdAt),
              },
            ]}
          />
          {totalCount !== undefined && totalCount > CUSTOMERS_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
              <p className="text-muted tabular-nums">
                {t.customers.showing
                  .replace('{from}', String(from))
                  .replace('{to}', String(to))
                  .replace('{total}', String(totalCount))}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t.customers.prevPage}
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  {t.customers.nextPage}
                </Button>
              </div>
            </div>
          )}
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
          <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-sm text-fg">
            <input type="checkbox" className="mt-0.5 accent-[rgb(var(--brand-ink))]" {...register('marketingOptIn')} />
            <span>
              يوافق على استلام العروض عبر واتساب
              <span className="block text-xs text-muted">فعّله فقط بعد أخذ موافقة العميل.</span>
            </span>
          </label>
        </form>
        {editing && (
          <div className="mt-4">
            <CustomerLoyaltyCard customer={editing} canManage={canManage} onChanged={setEditing} />
          </div>
        )}
      </Modal>

      {canManage && <LoyaltySettingsModal open={showLoyalty} onClose={() => setShowLoyalty(false)} />}
    </div>
  )
}
