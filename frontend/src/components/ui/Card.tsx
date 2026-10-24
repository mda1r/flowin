import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'holographic'

interface CardProps {
  className?: string
  children: React.ReactNode
  variant?: CardVariant
}

export function Card({ className, children }: CardProps) {
  return <div className={cn('card-3d', className)}>{children}</div>
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-border px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}

export function CardFooter({ className, children }: CardProps) {
  return <div className={cn('border-t border-border px-6 py-4', className)}>{children}</div>
}
