import { cn } from '@/lib/utils'

type BadgeVariant = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple' | 'orange' | 'live'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-info/10 text-info',
  green: 'bg-success/10 text-success',
  yellow: 'bg-warning/15 text-warning',
  red: 'bg-danger/10 text-danger',
  gray: 'bg-surface-2 text-muted',
  purple: 'bg-[#7c5cd6]/10 text-[#7c5cd6] dark:text-[#b4a1f0]',
  orange: 'bg-warning/15 text-warning',
  live: 'bg-success/10 text-success',
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {variant === 'live' && (
        <span className="live-dot" aria-hidden="true">
          <span className="live-dot-ping" />
        </span>
      )}
      {children}
    </span>
  )
}
