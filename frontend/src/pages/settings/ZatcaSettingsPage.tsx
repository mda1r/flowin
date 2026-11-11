import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Save, CheckCircle, AlertCircle, FileText, Percent } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { zatcaApi } from '@/api/zatca'
import { toast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { apiErrorMessage } from '@/lib/apiError'
import { apiClient } from '@/api/client'
import { ConfirmModal } from '@/components/ui/Modal'
import { useVat } from '@/lib/vat'
import { cn } from '@/lib/utils'

// ZATCA VAT registration numbers: 15 digits that start and end with 3.
const VAT_PATTERN = /^3\d{13}3$/

export function ZatcaSettingsPage() {
  const qc = useQueryClient()
  const { t } = useI18n()
  const role = useAuthStore((s) => s.user?.role)
  // The legal name and VAT number print on every invoice and in its QR code, so only the owner or a manager edits them.
  const canManage = role === 'Owner' || role === 'Manager'
  const { enabled: vatOn } = useVat()

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
      toast.success(t.zatca.saved)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.zatca.saveFailed)),
  })

  const isConfigured = !!settings
  const vatValid = VAT_PATTERN.test(vatNumber.trim())

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t.zatca.title}
        description={t.zatca.description}
      />

      <VatSwitch canManage={canManage} />

      {vatOn && (<>
      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${
        isConfigured
          ? 'border-success/30 bg-success/10'
          : 'border-warning/30 bg-warning/10'
      }`}>
        {isConfigured
          ? <CheckCircle className="h-5 w-5 shrink-0 text-success" />
          : <AlertCircle className="h-5 w-5 shrink-0 text-warning" />}
        <div className="text-sm">
          {isConfigured ? (
            <span className="font-medium text-success">
              {t.zatca.connected} · {settings.invoiceCounter} فاتورة صادرة
            </span>
          ) : (
            <span className="font-medium text-warning">
              {t.zatca.notConnected}
            </span>
          )}
        </div>
      </div>

      {/* Settings form */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-fg">{t.zatca.supplierData}</h2>
            <p className="text-xs text-muted">{t.zatca.supplierDataHint}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">
                {t.zatca.legalName}
              </label>
              <Input
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
                placeholder="مثال: شركة النور للتجزئة"
                dir="rtl"
                disabled={!canManage}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">
                {t.zatca.vatNumber}
              </label>
              <Input
                value={vatNumber}
                onChange={e => setVatNumber(e.target.value)}
                placeholder="300000000000003"
                dir="ltr"
                inputMode="numeric"
                disabled={!canManage}
                className={vatNumber && !vatValid ? 'border-danger/30' : ''}
              />
              {vatNumber && !vatValid && (
                <p className="mt-1 text-xs text-danger">{t.zatca.vatLengthError}</p>
              )}
            </div>

            {/* Phase 2 toggle */}
            <div className="flex items-start gap-4 rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-fg">{t.zatca.enablePhase2}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {t.zatca.phase2Hint}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={phase2}
                onClick={() => setPhase2(v => !v)}
                disabled={!canManage}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                  phase2 ? 'bg-success' : 'bg-border'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  phase2 ? '-translate-x-6' : '-translate-x-1'
                }`} />
              </button>
            </div>

            {canManage ? (
              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !sellerName.trim() || !vatValid}
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? t.common.loading : t.zatca.save}
                </Button>
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-xs text-muted">{t.zatca.readOnlyHint}</p>
            )}
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard
          icon={<FileText className="h-5 w-5 text-info" />}
          title={t.zatca.phase1}
          description={t.zatca.phase1Info}
          active={isConfigured}
        />
        <InfoCard
          icon={<Shield className="h-5 w-5 text-success" />}
          title={t.zatca.phase2}
          description={t.zatca.phase2Info}
          active={isConfigured && settings?.isPhase2Enabled}
        />
      </div>
      </>)}
    </div>
  )
}

// Charge VAT or not. A shop that is not VAT-registered switches it off: sales, invoices, reports and every screen
// then leave VAT out entirely (the server enforces it on every sale) until it is switched back on.
function VatSwitch({ canManage }: { canManage: boolean }) {
  const { t } = useI18n()
  const v = t.zatca.vat
  const qc = useQueryClient()
  const { enabled } = useVat()
  const tenantId = useAuthStore((s) => s.tenantId)
  const [confirming, setConfirming] = useState<boolean | null>(null)

  const save = useMutation({
    mutationFn: (next: boolean) =>
      apiClient.put<{ vatEnabled: boolean }>(`/api/v1/tenants/${tenantId}/vat`, { enabled: next }).then((r) => r.data.vatEnabled),
    onSuccess: (next) => {
      const { user, setUser } = useAuthStore.getState()
      if (user) setUser({ ...user, vatEnabled: next })
      // Every figure on every screen depends on it.
      qc.invalidateQueries()
      setConfirming(null)
      toast.success(next ? v.turnedOn : v.turnedOff)
    },
    onError: (err) => {
      setConfirming(null)
      toast.error(apiErrorMessage(err, v.failed))
    },
  })

  return (
    <div className={cn('flex flex-wrap items-start gap-4 rounded-xl border p-5', enabled ? 'border-border bg-surface' : 'border-warning/40 bg-warning/10')}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <Percent className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-fg">{v.title}</p>
        <p className="mt-1 max-w-2xl text-sm text-muted">{enabled ? v.onHint : v.offHint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={v.title}
        disabled={!canManage || save.isPending}
        onClick={() => setConfirming(!enabled)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50',
          enabled ? 'bg-brand' : 'bg-border',
        )}
      >
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-all', enabled ? 'start-6' : 'start-1')} />
      </button>
      <ConfirmModal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming !== null && save.mutate(confirming)}
        title={confirming ? v.confirmOnTitle : v.confirmOffTitle}
        message={confirming ? v.confirmOn : v.confirmOff}
        confirmLabel={confirming ? v.turnOn : v.turnOff}
        confirmVariant={confirming ? 'primary' : 'danger'}
        loading={save.isPending}
      />
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
      active ? 'border-success/30 bg-success/10' : 'border-border bg-surface'
    }`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        active ? 'bg-surface' : 'bg-surface-2'
      }`}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg">{title}</span>
          {active && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">مُفعّل</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
    </div>
  )
}
