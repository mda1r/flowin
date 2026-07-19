import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn('flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800', className)}>
      {children}
    </div>
  )
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}

export function CardFooter({ className, children }: CardProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-gray-200 dark:border-gray-800', className)}>
      {children}
    </div>
  )
}
