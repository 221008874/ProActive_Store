// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { CartProvider } from './context/CartContext'
import { LanguageProvider } from './context/LanguageContext' // new
import App from './App'
import './tokens.css'
import './styles/components.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
)
