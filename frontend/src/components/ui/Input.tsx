import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  /** floating-label mode: the label sits inside the field and floats up on focus/fill */
  floating?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, floating, className, id, placeholder, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    if (floating && label) {
      return (
        <div className="space-y-1">
          <div className="float-field">
            <input
              ref={ref}
              id={inputId}
              /* a placeholder must exist for :placeholder-shown to drive the float */
              placeholder={placeholder ?? ' '}
              className={cn('input-float', error && 'input-float-error', className)}
              {...props}
            />
            <label htmlFor={inputId} className="float-label">
              {label}
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          {hint && !error && <p className="text-xs text-muted">{hint}</p>}
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-fg"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          placeholder={placeholder}
          className={cn(
            'block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-[3px]',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/15'
              : 'border-border focus:border-brand focus:ring-brand/15',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: React.ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-fg"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-[3px]',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/15'
              : 'border-border focus:border-brand focus:ring-brand/15',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-fg"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-[3px]',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/15'
              : 'border-border focus:border-brand focus:ring-brand/15',
            className,
          )}
          rows={3}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
