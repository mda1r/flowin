import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

/** Shared id + aria wiring: a unique id per field and error/hint linked for screen readers. */
function useFieldIds(id: string | undefined, error: string | undefined, hint: string | undefined, describedBy: string | undefined) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const messageId = error || hint ? `${fieldId}-msg` : undefined
  return {
    fieldId,
    messageId,
    aria: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': [describedBy, messageId].filter(Boolean).join(' ') || undefined,
    },
  }
}

function FieldMessage({ id, error, hint }: { id?: string; error?: string; hint?: string }) {
  if (error) return <p id={id} className="text-xs text-danger">{error}</p>
  if (hint) return <p id={id} className="text-xs text-muted">{hint}</p>
  return null
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  /** floating-label mode: the label sits inside the field and floats up on focus/fill */
  floating?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, floating, className, id, placeholder, 'aria-describedby': describedBy, ...props }, ref) => {
    const { fieldId: inputId, messageId, aria } = useFieldIds(id, error, hint, describedBy)

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
              {...aria}
              {...props}
            />
            <label htmlFor={inputId} className="float-label">
              {label}
            </label>
          </div>
          <FieldMessage id={messageId} error={error} hint={hint} />
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
          {...aria}
          {...props}
        />
        <FieldMessage id={messageId} error={error} hint={hint} />
      </div>
    )
  },
)

Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  children: React.ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, id, children, 'aria-describedby': describedBy, ...props }, ref) => {
    const { fieldId: selectId, messageId, aria } = useFieldIds(id, error, hint, describedBy)
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
          {...aria}
          {...props}
        >
          {children}
        </select>
        <FieldMessage id={messageId} error={error} hint={hint} />
      </div>
    )
  },
)

Select.displayName = 'Select'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const { fieldId: textareaId, messageId, aria } = useFieldIds(id, error, hint, describedBy)
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
          {...aria}
          {...props}
        />
        <FieldMessage id={messageId} error={error} hint={hint} />
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
