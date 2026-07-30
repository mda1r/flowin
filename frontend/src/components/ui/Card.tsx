import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'holographic'

interface CardProps {
  className?: string
  children: React.ReactNode
  /** 'holographic' adds a subtle rainbow shimmer sweep on hover */
  variant?: CardVariant
}

export function Card({ className, children, variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'card-3d',
        variant === 'holographic' && 'card-holo',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div
      className={cn('flex items-center justify-between border-b px-6 py-4', className)}
      style={{ borderColor: 'var(--card-border)' }}
    >
      {children}
    </div>
  )
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}

export function CardFooter({ className, children }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-t', className)}
      style={{ borderColor: 'var(--card-border)' }}
    >
      {children}
    </div>
  )
}
