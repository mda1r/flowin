import { useI18n } from '@/i18n'

// Catalog items carry their Arabic name and, when the owner added one, an English name.
export interface Named {
  name: string
  nameEn?: string | null
}

/** The name to show on screen: the English one in English mode when there is one, otherwise the Arabic. */
export function localName(item: Named | null | undefined, lang: string): string {
  if (!item) return ''
  return lang === 'en' && item.nameEn?.trim() ? item.nameEn.trim() : item.name
}

export function useLocalName() {
  const { lang } = useI18n()
  return (item: Named | null | undefined) => localName(item, lang)
}
