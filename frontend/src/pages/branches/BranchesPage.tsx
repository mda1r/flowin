import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Star, GitBranch } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { branchesApi, type CreateBranchPayload } from '@/api/branches'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import type { BranchResponse, BranchType } from '@/types/api'
import { useI18n } from '@/i18n'


const BRANCH_TYPES: BranchType[] = ['Retail', 'Restaurant', 'Hotel', 'Gaming', 'Warehouse', 'Office']

const branchSchema = z.object({
  name: z.string().min(1, 'اسم الفرع مطلوب'),
  type: z.enum(['Retail', 'Restaurant', 'Hotel', 'Gaming', 'Warehouse', 'Office']),
  phoneNumber: z.string().optional(),
  email: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
  city: z.string().optional(),
  country: z.string().optional(),
})

type BranchFormData = z.infer<typeof branchSchema>

export function BranchesPage() {
  const { tenantId, user } = useAuthStore()
  const { t } = useI18n()
  const role = user?.role
  const qc = useQueryClient()
  const typeLabels: Record<BranchType, string> = {
    Retail:     t.branches.types.retail,
    Restaurant: t.branches.types.restaurant,
    Hotel:      t.branches.types.hotel,
    Gaming:     t.branches.types.gaming,
    Warehouse:  'مستودع',
    Office:     'مكتب',
  }

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<BranchResponse | null>(null)
  const [deactivating, setDeactivating] = useState<BranchResponse | null>(null)

  const canManage = role === 'Owner' || role === 'Manager'

  const { data, isLoading } = useQuery({
    queryKey: ['branches', tenantId],
    queryFn: () => branchesApi.list(tenantId!),
    enabled: !!tenantId,
    select: (r) => r.data,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: { type: 'Retail' },
  })

  const createMut = useMutation({
    mutationFn: (data: BranchFormData) =>
      branchesApi.create(tenantId!, data as CreateBranchPayload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches', tenantId] })
      setShowCreate(false)
      reset()
      toast.success(t.branches.created, '')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      toast.error(t.branches.failed, err?.response?.data?.detail ?? ''),
  })

  const updateMut = useMutation({
    mutationFn: (data: BranchFormData) =>
      branchesApi.update(tenantId!, editing!.id, data as CreateBranchPayload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches', tenantId] })
      setEditing(null)
      reset()
      toast.success(t.branches.updated, '')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      toast.error(t.branches.failed, err?.response?.data?.detail ?? ''),
  })

  const deactivateMut = useMutation({
    mutationFn: () => branchesApi.deactivate(tenantId!, deactivating!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches', tenantId] })
      setDeactivating(null)
      toast.success('تم تعطيل الفرع', '')
    },
    onError: () => toast.error(t.branches.failed, ''),
  })

  const openEdit = (branch: BranchResponse) => {
    setEditing(branch)
    reset({
      name: branch.name,
      type: branch.type,
      phoneNumber: branch.phoneNumber ?? '',
      email: branch.email ?? '',
      city: branch.city ?? '',
      country: branch.country ?? '',
    })
  }

  const branches = data ?? []

  return (
    <div>
      <PageHeader
        title={t.branches.title}
        description="إدارة فروع المنشأة"
        action={
          canManage ? (
            <Button onClick={() => { reset({ type: 'Retail' }); setShowCreate(true) }}>
              <Plus className="h-4 w-4" />
              {t.branches.addBranch}
            </Button>
          ) : undefined
        }
      />

      <div className="p-6">
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">{t.branches.totalBranches}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{branches.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">{t.branches.activeBranches}</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {branches.filter((b) => b.isActive).length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">{t.branches.inactiveBranches}</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {branches.filter((b) => !b.isActive).length}
            </p>
          </div>
        </div>

        <Card>
          <Table
            loading={isLoading}
            data={branches}
            keyExtractor={(r) => r.id}
            emptyMessage={t.branches.noBranches}
            columns={[
              {
                key: 'name',
                header: t.branches.name,
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                      {r.isMainBranch && (
                        <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                          <Star className="h-3 w-3" /> {t.branches.mainBranch}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'type',
                header: t.branches.type,
                render: (r) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {typeLabels[r.type] ?? r.type}
                  </span>
                ),
              },
              {
                key: 'contact',
                header: t.branches.contact,
                render: (r) => (
                  <div className="text-xs text-gray-500">
                    {r.phoneNumber && <p>{r.phoneNumber}</p>}
                    {r.email && <p>{r.email}</p>}
                    {!r.phoneNumber && !r.email && '—'}
                  </div>
                ),
              },
              {
                key: 'city',
                header: t.branches.city,
                render: (r) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {[r.city, r.country].filter(Boolean).join('، ') || '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: t.branches.status,
                render: (r) => (
                  <Badge variant={r.isActive ? 'green' : 'gray'}>
                    {r.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                ),
              },
              ...(canManage
                ? [
                    {
                      key: 'actions',
                      header: '',
                      render: (r: BranchResponse) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!r.isMainBranch && r.isActive && (
                            <button
                              onClick={() => setDeactivating(r)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                              title="تعطيل"
                            >
                              <span className="text-xs font-medium">تعطيل</span>
                            </button>
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); reset() }}
        title={t.branches.newBranch}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); reset() }}>{t.common.cancel}</Button>
            <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <BranchForm register={register} errors={errors} />
      </Modal>

      {/* Edit Modal */}
      {editing && (
        <Modal
          open
          onClose={() => { setEditing(null); reset() }}
          title={`${t.branches.editBranch} — ${editing.name}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setEditing(null); reset() }}>{t.common.cancel}</Button>
              <Button loading={updateMut.isPending} onClick={handleSubmit((d) => updateMut.mutate(d))}>
                {t.common.save}
              </Button>
            </>
          }
        >
          <BranchForm register={register} errors={errors} />
        </Modal>
      )}

      {/* Deactivate Confirm */}
      {deactivating && (
        <ConfirmModal
          open
          onClose={() => setDeactivating(null)}
          onConfirm={() => deactivateMut.mutate()}
          title="تعطيل الفرع"
          message={`هل أنت متأكد من تعطيل الفرع "${deactivating.name}"؟`}
          confirmLabel="تعطيل"
          confirmVariant="danger"
          loading={deactivateMut.isPending}
        />
      )}
    </div>
  )
}

function BranchForm({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<z.infer<typeof branchSchema>>>['register']
  errors: ReturnType<typeof useForm<z.infer<typeof branchSchema>>>['formState']['errors']
}) {
  const { t } = useI18n()
  const typeLabels: Record<BranchType, string> = {
    Retail:     t.branches.types.retail,
    Restaurant: t.branches.types.restaurant,
    Hotel:      t.branches.types.hotel,
    Gaming:     t.branches.types.gaming,
    Warehouse:  'مستودع',
    Office:     'مكتب',
  }
  return (
    <form className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label={t.branches.name} error={errors.name?.message} {...register('name')} />
        <Select label={t.branches.type} error={errors.type?.message} {...register('type')}>
          {BRANCH_TYPES.map((bt) => (
            <option key={bt} value={bt}>{typeLabels[bt]}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t.branches.phone} {...register('phoneNumber')} />
        <Input label={t.users.email} type="email" error={errors.email?.message} {...register('email')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t.branches.city} {...register('city')} />
        <Input label={t.branches.country} {...register('country')} />
      </div>
    </form>
  )
}
