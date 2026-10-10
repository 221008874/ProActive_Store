// src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'

// Import your images
import logoLight from '../assets/a29dc90a-d036-4010-b33e-82cd29b6a2d5-removebg-preview.png'
import logoDark from '../assets/78a4edcc-a4c9-4027-b585-1144cfc5ff64-removebg-preview.png'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const [themeImages, setThemeImages] = useState({
    logo: logoLight, // default
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

  // Load saved theme from localStorage on initial load
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') {
      setTheme('light')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('light')
    }
  }, [])

  // Apply theme class to body, save to localStorage, and update images
  useEffect(() => {
    document.body.className = theme
    localStorage.setItem('theme', theme)
    
    // Update images based on theme
    setThemeImages(imagePaths[theme])
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
