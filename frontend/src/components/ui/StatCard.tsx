import { cn } from '@/lib/utils'

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  hint?: React.ReactNode
  tone?: Tone
  className?: string
}

const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  neutral: 'bg-surface-2 text-muted',
}

export function StatCard({ label, value, icon, hint, tone = 'brand', className }: StatCardProps) {
  return (
    <div className={cn('card-3d flex items-start justify-between gap-3 p-5', className)}>
      <div className="min-w-0 space-y-1">
        <p className="text-13 font-medium text-muted">{label}</p>
        <p className="truncate text-2xl font-semibold tabular-nums text-fg">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {icon && (
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5', toneClasses[tone])}>
          {icon}
        </span>
      )}
    </div>
  )
}
