interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function PageHeader({ title, description, action, icon }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-4 py-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-fg">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
