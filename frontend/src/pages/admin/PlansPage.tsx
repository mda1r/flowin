import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, X, SlidersHorizontal, Save } from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import { toast } from '@/components/ui/Toast'
import type { BusinessType, SubscriptionPlanResponse } from '@/types/api'

const PREDEFINED_FEATURES: { key: string; label: string }[] = [
  { key: 'stock_count', label: 'الجرد المخزني' },
  { key: 'zatca_phase1', label: 'زاتكا المرحلة الأولى' },
  { key: 'zatca_phase2', label: 'زاتكا المرحلة الثانية' },
  { key: 'ai_assistant', label: 'المساعد الذكي' },
  { key: 'purchasing', label: 'المشتريات' },
  { key: 'crm', label: 'إدارة العملاء (CRM)' },
  { key: 'loyalty', label: 'برنامج الولاء' },
  { key: 'multi_branch', label: 'تعدد الفروع' },
  { key: 'advanced_reports', label: 'التقارير المتقدمة' },
  { key: 'api_access', label: 'واجهة برمجية (API)' },
]

const BUSINESS_TYPES: { key: BusinessType; label: string; emoji: string }[] = [
  { key: 'Restaurant', label: 'مطعم', emoji: '🍽️' },
  { key: 'Hotel', label: 'فندق', emoji: '🏨' },
  { key: 'Supermarket', label: 'سوبرماركت', emoji: '🛒' },
  { key: 'Gaming', label: 'ألعاب', emoji: '🎮' },
  { key: 'Retail', label: 'تجزئة', emoji: '🏪' },
  { key: 'Cafe', label: 'كافيه', emoji: '☕' },
]

export function PlansPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<BusinessType>('Restaurant')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('Restaurant')
  const [price, setPrice] = useState('')
  const [maxBranches, setMaxBranches] = useState('1')
  const [maxUsers, setMaxUsers] = useState('5')
  const [featureInput, setFeatureInput] = useState('')
  const [features, setFeatures] = useState<string[]>([])

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => superAdminApi.listPlans().then((r) => r.data),
  })

  const tabPlans = plans.filter((p) => p.businessType === activeTab && p.isActive)

  const createMut = useMutation({
    mutationFn: () =>
      superAdminApi.createPlan({
        name,
        businessType,
        price: parseFloat(price) || 0,
        maxBranches: parseInt(maxBranches) || 1,
        maxUsers: parseInt(maxUsers) || 5,
        features,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
      toast.success('تم إنشاء الخطة بنجاح', '')
      setShowForm(false)
      setName('')
      setPrice('')
      setMaxBranches('1')
      setMaxUsers('5')
      setFeatures([])
      setFeatureInput('')
    },
    onError: () => toast.error('فشل في إنشاء الخطة', ''),
  })

  const addFeature = () => {
    const f = featureInput.trim()
    if (f && !features.includes(f)) {
      setFeatures((prev) => [...prev, f])
      setFeatureInput('')
    }
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">خطط الاشتراك</h1>
          <p className="mt-1 text-slate-400">{plans.length} خطة • منفصلة لكل نوع نشاط تجاري</p>
        </div>
        <button
          onClick={() => { setBusinessType(activeTab); setShowForm((v) => !v) }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          خطة جديدة
        </button>
      </div>

      {/* Business type tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-800/60 p-1">
        {BUSINESS_TYPES.map((bt) => {
          const count = plans.filter((p) => p.businessType === bt.key).length
          return (
            <button
              key={bt.key}
              onClick={() => setActiveTab(bt.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === bt.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>{bt.emoji}</span>
              <span>{bt.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === bt.key ? 'bg-blue-500 text-blue-100' : 'bg-slate-700 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-5 text-base font-semibold text-white">
            إنشاء خطة جديدة
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">اسم الخطة</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: احترافي مطعم"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">نوع النشاط</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt.key} value={bt.key}>
                    {bt.emoji} {bt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">السعر (ر.س / شهر)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="499"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">أقصى فروع</label>
              <input
                type="number"
                min="1"
                value={maxBranches}
                onChange={(e) => setMaxBranches(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">أقصى مستخدمين</label>
              <input
                type="number"
                min="1"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-300">الميزات</label>
              <div className="flex gap-2">
                <input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  placeholder="اكتب ميزة واضغط إدخال"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={addFeature}
                  className="rounded-lg bg-slate-700 px-3 py-2.5 text-sm text-white hover:bg-slate-600 transition-colors"
                >
                  إضافة
                </button>
              </div>
              {features.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {features.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1.5 rounded-full bg-blue-900/50 px-3 py-1 text-xs text-blue-300"
                    >
                      {f}
                      <button
                        onClick={() => setFeatures((prev) => prev.filter((x) => x !== f))}
                        className="text-blue-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!name || createMut.isPending}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createMut.isPending ? 'جاري الحفظ...' : 'حفظ الخطة'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      ) : tabPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-lg">لا توجد خطط لهذا النشاط</p>
          <p className="mt-1 text-sm">أضف خطة جديدة بالضغط على الزر أعلاه</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tabPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onUpdated={() => qc.invalidateQueries({ queryKey: ['admin', 'plans'] })} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, onUpdated }: { plan: SubscriptionPlanResponse; onUpdated: () => void }) {
  const [editingFeatures, setEditingFeatures] = useState(false)
  const [draftFeatures, setDraftFeatures] = useState<string[]>(plan.features)

  const featureMut = useMutation({
    mutationFn: (features: string[]) => superAdminApi.updatePlanFeatures(plan.id, features),
    onSuccess: () => {
      toast.success('تم تحديث ميزات الخطة', '')
      setEditingFeatures(false)
      onUpdated()
    },
    onError: () => toast.error('فشل تحديث الميزات', ''),
  })

  const toggleFeature = (key: string) => {
    setDraftFeatures(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key],
    )
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="text-base font-bold text-white">{plan.name}</h3>
        <button
          onClick={() => { setDraftFeatures(plan.features); setEditingFeatures(v => !v) }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="تعديل الميزات"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-4 text-2xl font-bold text-white">
        {plan.price.toLocaleString('ar-SA')}
        <span className="text-sm font-normal text-slate-400"> ر.س / شهر</span>
      </p>
      <div className="mb-4 flex gap-4 text-xs text-slate-400">
        <span>{plan.maxBranches >= 999 ? 'غير محدود' : plan.maxBranches} فروع</span>
        <span>{plan.maxUsers >= 999 ? 'غير محدود' : plan.maxUsers} مستخدم</span>
      </div>

      {editingFeatures ? (
        <div className="mt-auto">
          <p className="mb-3 text-xs font-medium text-slate-300">الميزات المتاحة</p>
          <div className="space-y-2">
            {PREDEFINED_FEATURES.map(f => {
              const enabled = draftFeatures.includes(f.key)
              return (
                <label key={f.key} className="flex cursor-pointer items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleFeature(f.key)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      enabled ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      enabled ? '-translate-x-5' : '-translate-x-0.5'
                    }`} />
                  </button>
                  <span className="text-xs text-slate-300">{f.label}</span>
                </label>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => featureMut.mutate(draftFeatures)}
              disabled={featureMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {featureMut.isPending ? 'جاري...' : 'حفظ'}
            </button>
            <button
              onClick={() => setEditingFeatures(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <ul className="mt-auto space-y-2">
          {plan.features.length === 0 ? (
            <li className="text-xs text-slate-500">لا توجد ميزات — اضغط ✏️ للإضافة</li>
          ) : plan.features.map((f) => {
            const meta = PREDEFINED_FEATURES.find(pf => pf.key === f)
            return (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                {meta ? meta.label : f}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
