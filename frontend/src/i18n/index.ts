import { createContext, useContext, useEffect, useState } from 'react'
import { en } from './en'
import { ar } from './ar'
import type { Translations } from './en'

type Language = 'en' | 'ar'

interface I18nContextValue {
  lang: Language
  t: Translations
  setLang: (lang: Language) => void
  isRtl: boolean
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  t: en,
  setLang: () => {},
  isRtl: false,
})

const translations: Record<Language, Translations> = { en, ar }

const STORAGE_KEY = 'flowin_lang'

export function useI18nState(): I18nContextValue {
  const stored = (localStorage.getItem(STORAGE_KEY) ?? 'en') as Language
  const [lang, setLangState] = useState<Language>(stored)

  const setLang = (l: Language) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLangState(l)
  }

  useEffect(() => {
    const isRtl = lang === 'ar'
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  return {
    lang,
    t: translations[lang],
    setLang,
    isRtl: lang === 'ar',
  }
}

export function useI18n() {
  return useContext(I18nContext)
}
