// src/context/LanguageContext.jsx
//
// Owns the language state and the t() lookup. The copy itself lives in
// src/i18n/strings.js so it can be edited without touching the provider.
import { createContext, useContext, useEffect, useState } from 'react'
import { ar, en } from "../i18n/strings";

// The live dictionary pair. t() reads translations[lang], so pointing this at
// a different source (a CMS, a locale fetched at runtime) is the only change
// a new language needs.
const translations = { ar, en };

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  // Load the saved language as the initial state rather than in an effect,
  // so the first paint is already in the right language and direction.
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('language')
      return saved === 'ar' || saved === 'en' ? saved : 'ar'
    } catch {
      return 'ar' // private mode: default Arabic
    }
  })

  // Apply direction & language to body
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('language', lang)
  }, [lang])

  // Enhanced translation function with interpolation support
  const t = (key, params = {}) => {
    let text = translations[lang][key] || key

    // Handle interpolation for dynamic values like {count}
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param])
    })

    return text
  }

  const toggleLanguage = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar')
  }

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)