// src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'

// Import your images
import logoLight from '../assets/a29dc90a-d036-4010-b33e-82cd29b6a2d5-removebg-preview.png'
import logoDark from '../assets/78a4edcc-a4c9-4027-b585-1144cfc5ff64-removebg-preview.png'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // The saved theme is the initial state, read once at mount: the first
  // paint is already correct (the previous version ran an effect and always
  // resolved to 'light', so a saved dark preference was never applied).
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  // Theme-specific images
  const imagePaths = {
    light: {
      logo: logoLight,
    },
    dark: {
      logo: logoDark,
    }
  }

  // Derived, not state: it always mirrors the theme, so it no longer costs
  // an extra render (and a cascading-render warning).
  const themeImages = imagePaths[theme]

  // Apply theme class to body and persist it
  useEffect(() => {
    document.body.className = theme
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  // Helper function to get image by name
  const getImage = (imageName) => {
    return imagePaths[theme]?.[imageName] || null
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      themeImages,
      getImage 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
