import { isAxiosError } from 'axios'
import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'
import { activeLang } from '@/lib/locale'

// Turns an API failure (ProblemDetails / ValidationProblemDetails) into one readable line in the UI language.
// Known ErrorOr codes are translated; the server's own text is used only when the code is unknown.
export function apiErrorMessage(err: unknown, fallback?: string): string {
  const t = (activeLang() === 'ar' ? ar : en).errors
  if (!isAxiosError(err)) return fallback ?? t.generic
  if (!err.response) return t.network
  const data = err.response.data as { title?: string; detail?: string; errors?: Record<string, string[]> } | undefined
  if (data?.title && t.codes[data.title]) return t.codes[data.title]
  // Validation problems are keyed by code for domain errors and by property name for FluentValidation.
  const knownField = data?.errors ? Object.keys(data.errors).find((k) => t.codes[k]) : undefined
  if (knownField) return t.codes[knownField]
  const firstValidation = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  if (firstValidation) return firstValidation
  if (data?.detail) return data.detail
  if (err.response.status === 403) return t.forbidden
  if (err.response.status === 409) return t.conflict
  return fallback ?? t.generic
}
