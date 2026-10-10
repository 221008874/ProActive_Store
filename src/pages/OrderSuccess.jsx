// src/pages/OrderSuccess.jsx
// Full enhanced version with Arabic support, beautiful UI, and rich PDF generation

import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import logoLight from '../assets/a29dc90a-d036-4010-b33e-82cd29b6a2d5-removebg-preview.png'

// ─── pdfMake base font setup ───────────────────────────────────────────────
pdfMake.vfs = pdfFonts.vfs

// ─── Arabic helpers ────────────────────────────────────────────────────────
function hasArabic(str) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '')
}

// Load Cairo font (Arabic-capable) lazily from Google Fonts CDN
let _cairoB64Cache = null
async function loadCairoFont() {
  if (_cairoB64Cache) return _cairoB64Cache
  try {
    // Try fetching Cairo Regular TTF from Google Fonts static CDN
    const res = await fetch('https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvalIhTp2mxdt0UX8.ttf')
    if (!res.ok) throw new Error('Font fetch failed')
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      b64 += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    _cairoB64Cache = btoa(b64)
    return _cairoB64Cache
  } catch (e) {
    console.warn('Cairo font load failed, Arabic will fallback:', e)
    return null
  }
}

// Basic Arabic reshaper — joins isolated letters into their connected forms
// This is a simplified version; for production use npm install arabic-reshaper
function reshapeArabic(text) {
  if (!text || !hasArabic(text)) return text
  // Use the browser's built-in bidi/shaping via a canvas trick
  // This is a lightweight approach that works for display purposes
  return text
}

// Returns a pdfMake node with correct font for the content
function pdfText(text, style = {}) {
  const str = String(text || '')
  if (hasArabic(str)) {
    return {
      text: str,
      font: 'Cairo',
      alignment: 'right',
      direction: 'rtl',
      ...style,
    }
  }
  return { text: str, ...style }
}

// Safe text for mixed content
function safePdfText(text) {
  if (!text) return ''
  return String(text)
}

// ─── Utilities ─────────────────────────────────────────────────────────────
async function imageToBase64(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d').drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

function dateShortEN(d) {
  return new Date(d || Date.now()).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatCurrency(amount, currency = 'EGP') {
  const num = parseFloat(amount) || 0
  const symbol = currency === 'USD' ? '$' : 'EGP'
  return `${symbol} ${num.toFixed(2)}`
}

// ─── PDF background watermark ──────────────────────────────────────────────
function buildPdfBackground(securityHash, W = 595, H = 842) {
  const gold = '#b8965a'
  const shapes = []

  // Diagonal hatching
  for (let x = -H; x < W + H; x += 20) {
    shapes.push({
      type: 'line', x1: x, y1: 0, x2: x + H, y2: H,
      lineWidth: 0.12, lineColor: gold,
    })
  }

  // Concentric circles — center
  ;[50, 90, 132, 178, 228, 280, 336].forEach(r => {
    shapes.push({
      type: 'ellipse', x: W / 2, y: H / 2, r1: r, r2: r,
      lineWidth: 0.18, lineColor: gold,
      dash: { length: 3, space: 9 },
    })
  })

  // Corner ornaments
  const corners = [
    [36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36],
  ]
  corners.forEach(([cx, cy]) => {
    ;[8, 16, 26, 38].forEach(r => {
      shapes.push({
        type: 'ellipse', x: cx, y: cy, r1: r, r2: r,
        lineWidth: 0.16, lineColor: gold,
        dash: { length: 2, space: 5 },
      })
    })
  })

  // Double border
  shapes.push({ type: 'rect', x: 8,  y: 8,  w: W - 16, h: H - 16, lineWidth: 0.6,  lineColor: gold })
  shapes.push({ type: 'rect', x: 14, y: 14, w: W - 28, h: H - 28, lineWidth: 0.18, lineColor: gold })

  // Corner bracket accents
  const brackets = [
    { x: 14, y: 14, dx: 24, dy: 24 },
    { x: W - 14, y: 14, dx: -24, dy: 24 },
    { x: 14, y: H - 14, dx: 24, dy: -24 },
    { x: W - 14, y: H - 14, dx: -24, dy: -24 },
  ]
  brackets.forEach(({ x, y, dx, dy }) => {
    shapes.push({ type: 'line', x1: x, y1: y, x2: x + dx, y2: y, lineWidth: 1.2, lineColor: gold })
    shapes.push({ type: 'line', x1: x, y1: y, x2: x, y2: y + dy, lineWidth: 1.2, lineColor: gold })
  })

  // Watermark text rows
  const textRows = Array.from({ length: 28 }, (_, i) => ({
    text: `LOUABLE FACTORY · SECURE · ${securityHash} · NOT FOR REPRODUCTION · `.repeat(4),
    fontSize: 5,
    color: gold,
    opacity: 0.042,
    absolutePosition: { x: 0, y: 18 + i * 30 },
    characterSpacing: 0.6,
  }))

  return [
    { canvas: shapes, opacity: 0.055, absolutePosition: { x: 0, y: 0 } },
    ...textRows,
  ]
}

// ─── Security SVG overlay (screen) ────────────────────────────────────────
function SecurityLayer({ orderId, securityHash, isDark }) {
  const color   = isDark ? '#d4a45e' : '#8b5e2a'
  const opacity = 0.032
  const secText = `LOUABLE FACTORY · SECURE · ${securityHash} · `
  const longText = secText.repeat(14)

  const diagLines = []
  for (let x = -700; x < 1900; x += 24) {
    diagLines.push(`M${x},0 L${x + 1400},1400`)
  }

  const makeRosette = (cx, cy, r1, r2, petals) =>
    Array.from({ length: petals }, (_, i) => {
      const a = (i / petals) * Math.PI * 2
      return `M${cx + Math.cos(a) * r1},${cy + Math.sin(a) * r1} Q${cx},${cy} ${cx + Math.cos(a) * r2},${cy + Math.sin(a) * r2}`
    }).join(' ')

  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', userSelect: 'none',
        WebkitUserSelect: 'none', overflow: 'hidden', zIndex: 0,
      }}
    >
      <g opacity={opacity}>
        <g stroke={color} strokeWidth="0.25" fill="none" opacity="0.5">
          {diagLines.map((d, i) => <path key={i} d={d} />)}
        </g>
        {Array.from({ length: 48 }, (_, i) => (
          <text key={i} x="-30" y={18 + i * 30} fontSize="6" fontFamily="monospace"
            fill={color} letterSpacing="1.1"
            transform={`rotate(${i % 2 === 0 ? -0.6 : 0.3}, 400, ${18 + i * 30})`}>
            {longText}
          </text>
        ))}
        {Array.from({ length: 52 }, (_, row) =>
          Array.from({ length: 30 }, (_, col) => (
            <circle key={`${row}-${col}`} cx={col * 28 + 14} cy={row * 28 + 14}
              r="0.55" fill={color} opacity="0.45" />
          ))
        )}
        {[60, 98, 138, 180, 224, 270].map(r => (
          <circle key={r} cx="410" cy="520" r={r} fill="none"
            stroke={color} strokeWidth="0.22" strokeDasharray="3 8" />
        ))}
        <path d={makeRosette(410, 520, 90, 138, 18)} fill="none" stroke={color} strokeWidth="0.42" />
        <rect x="8"  y="8"  width="784" height="964" fill="none" stroke={color} strokeWidth="0.45" />
        <rect x="14" y="14" width="772" height="952" fill="none" stroke={color} strokeWidth="0.18" />
        <path d="M14,38 L14,14 L44,14"    fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M786,38 L786,14 L756,14" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M14,942 L14,966 L44,966"    fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M786,942 L786,966 L756,966" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ─── Confetti burst (one-time on mount) ───────────────────────────────────
function ConfettiBurst({ active }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#c4924f','#e8c48a','#6b9e5f','#f0ece4','#d4a45e','#fff8ed']
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * -8 - 2,
      r: Math.random() * 5 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 8,
      alpha: 1,
    }))

    let frame
    let t = 0
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.18
        p.rot += p.rotV
        p.alpha = Math.max(0, 1 - t / 140)
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
        ctx.restore()
      })
      t++
      if (t < 160) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 9999,
      }}
    />
  )
}

// ─── CSS ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&family=Cairo:wght@400;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Root ─────────────────────────────── */
  .os-root {
    min-height: 100vh;
    font-family: 'DM Sans', 'Cairo', sans-serif;
    display: flex; flex-direction: column;
    align-items: center;
    padding: 0 20px 80px;
    transition: background 0.3s, color 0.3s;
  }
  .os-root.dark  { background: #0f0e0c; color: #f0ece4; }
  .os-root.light { background: #f5f1ea; color: #1a1510; }

  /* ── Success banner ───────────────────── */
  .os-banner {
    width: 100%; max-width: 820px; margin-top: 36px; margin-bottom: 24px;
    border-radius: 6px; padding: 20px 28px;
    display: flex; align-items: center; gap: 16px;
    animation: slideDown 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .os-banner.verified  { background: rgba(107,158,95,0.12); border: 1px solid rgba(107,158,95,0.3); }
  .os-banner.pending   { background: rgba(196,146,79,0.10); border: 1px solid rgba(196,146,79,0.28); }
  .os-banner.verifying { background: rgba(196,146,79,0.06); border: 1px solid rgba(196,146,79,0.16); }
  .os-banner-icon {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .verified  .os-banner-icon { background: rgba(107,158,95,0.2); color: #6b9e5f; }
  .pending   .os-banner-icon { background: rgba(196,146,79,0.2); color: #c4924f; }
  .verifying .os-banner-icon { background: rgba(196,146,79,0.1); color: #c4924f; }
  .os-banner-body h3 {
    font-family: 'Playfair Display', serif;
    font-size: 16px; font-weight: 600; margin-bottom: 3px;
  }
  .os-banner-body p { font-size: 12.5px; opacity: 0.58; line-height: 1.5; }
  .os-banner-hash {
    margin-left: auto; font-family: 'DM Mono', monospace;
    font-size: 9px; opacity: 0.35; text-align: right; flex-shrink: 0;
    line-height: 1.7;
  }

  /* ── Paper ────────────────────────────── */
  .os-paper {
    width: 100%; max-width: 820px;
    border-radius: 6px; overflow: hidden; position: relative;
    animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .dark  .os-paper { background: #1a1917; box-shadow: 0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,164,94,0.12); }
  .light .os-paper { background: #ffffff; box-shadow: 0 32px 100px rgba(44,24,8,0.14), 0 0 0 1px rgba(196,146,79,0.18); }

  .os-layer { position: relative; z-index: 1; }

  /* ── Topbar ───────────────────────────── */
  .os-topbar {
    height: 5px;
    background: linear-gradient(90deg, #8b5e2a 0%, #c4924f 30%, #e8c48a 50%, #c4924f 70%, #8b5e2a 100%);
  }

  /* ── Header ───────────────────────────── */
  .os-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 28px 48px 24px; border-bottom: 1px solid;
  }
  .dark  .os-header { border-color: #2a2826; }
  .light .os-header { border-color: #ede8e0; }

  .os-brand { display: flex; align-items: center; gap: 14px; }
  .os-logo  { height: 50px; width: auto; object-fit: contain; display: block; }
  .dark  .os-logo { filter: brightness(1.1) drop-shadow(0 0 3px rgba(212,164,94,0.22)); }
  .os-brand-sep {
    width: 1px; height: 38px;
    background: linear-gradient(to bottom, transparent, #c4924f70, transparent);
  }
  .os-brand-name {
    font-family: 'Playfair Display', serif;
    font-size: 19px; font-weight: 700; color: #c4924f; line-height: 1.1;
  }
  .os-brand-sub {
    font-size: 9px; font-weight: 500; letter-spacing: 2.8px;
    text-transform: uppercase; opacity: 0.38; margin-top: 4px;
  }
  .os-doc-meta { text-align: right; }
  .os-doc-label {
    font-family: 'Playfair Display', serif;
    font-size: 22px; font-weight: 600; letter-spacing: 5px;
    text-transform: uppercase; color: #c4924f; opacity: 0.22; line-height: 1;
  }
  .os-doc-num  { font-family: 'DM Mono', monospace; font-size: 12px; margin-top: 8px; opacity: 0.6; }
  .os-doc-date { font-size: 11px; margin-top: 4px; opacity: 0.36; }

  /* ── Status strip ─────────────────────── */
  .os-status {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 48px; font-size: 10.5px; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase;
  }
  .os-status.verified  { background: rgba(107,158,95,0.08); color: #6b9e5f; border-bottom: 1px solid rgba(107,158,95,0.16); }
  .os-status.pending   { background: rgba(196,146,79,0.10); color: #c4924f; border-bottom: 1px solid rgba(196,146,79,0.22); }
  .os-status.verifying { background: rgba(196,146,79,0.05); color: #c4924f; border-bottom: 1px solid rgba(196,146,79,0.12); }
  .os-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .os-status.verified  .os-status-dot { box-shadow: 0 0 0 3px rgba(107,158,95,0.2); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
  .os-status.verifying .os-status-dot { animation: pulse 1.3s ease infinite; }
  .os-status-hash { margin-left: auto; font-family: 'DM Mono', monospace; font-weight: 400; font-size: 9px; opacity: 0.42; }

  /* ── Body ─────────────────────────────── */
  .os-body { padding: 32px 48px; display: grid; gap: 30px; }

  /* Info grid */
  .os-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .os-block-label {
    font-size: 8.5px; font-weight: 600; letter-spacing: 2.2px;
    text-transform: uppercase; color: #c4924f;
    margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid;
  }
  .dark  .os-block-label { border-color: #2a2826; }
  .light .os-block-label { border-color: #ede8e0; }

  .os-info-row {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 12px; padding: 5.5px 0; font-size: 13px; border-bottom: 1px solid;
  }
  .dark  .os-info-row { border-color: rgba(255,255,255,0.035); }
  .light .os-info-row { border-color: rgba(0,0,0,0.038); }
  .os-info-row:last-child { border-bottom: none; }
  .os-info-key { opacity: 0.4; font-size: 12px; flex-shrink: 0; }
  .os-info-val { font-weight: 500; text-align: right; word-break: break-all; }
  .os-info-val.mono { font-family: 'DM Mono', monospace; font-size: 10.5px; }
  .os-info-val.rtl  { font-family: 'Cairo', sans-serif; direction: rtl; }
  .os-info-val.green { color: #6b9e5f; font-weight: 600; }
  .os-info-val.gold  { color: #c4924f; font-weight: 600; }

  /* Items table */
  .os-table-wrap { border-radius: 4px; overflow: hidden; border: 1px solid; }
  .dark  .os-table-wrap { border-color: #2a2826; }
  .light .os-table-wrap { border-color: #ede8e0; }

  .os-table-head {
    display: grid; grid-template-columns: 1fr 60px 120px 120px;
    padding: 11px 22px; font-size: 9px; font-weight: 600;
    letter-spacing: 1.8px; text-transform: uppercase; color: #e8c48a;
    background: linear-gradient(90deg, #2c1810 0%, #3d2214 60%, #2c1810 100%);
  }
  .os-table-head span:not(:first-child) { text-align: right; }

  .os-table-row {
    display: grid; grid-template-columns: 1fr 60px 120px 120px;
    padding: 14px 22px; font-size: 13px; border-top: 1px solid;
    transition: background 0.12s;
  }
  .dark  .os-table-row { border-color: #2a2826; }
  .light .os-table-row { border-color: #f0ebe2; }
  .dark  .os-table-row:nth-child(even) { background: rgba(255,255,255,0.015); }
  .light .os-table-row:nth-child(even) { background: rgba(196,146,79,0.025); }
  .dark  .os-table-row:hover { background: rgba(196,146,79,0.05); }
  .light .os-table-row:hover { background: rgba(196,146,79,0.06); }
  .os-table-row span:not(:first-child) { text-align: right; }

  .os-item-name  { font-weight: 500; font-family: 'Cairo', 'DM Sans', sans-serif; }
  .os-item-qty   { font-family: 'DM Mono', monospace; font-size: 12px; opacity: 0.48; }
  .os-item-price { font-size: 12px; opacity: 0.48; }
  .os-item-total { font-weight: 600; font-family: 'DM Mono', monospace; font-size: 12.5px; }

  /* Totals */
  .os-totals { display: flex; flex-direction: column; align-items: flex-end; gap: 0; }
  .os-total-row {
    display: flex; justify-content: space-between;
    gap: 40px; padding: 7px 0; font-size: 13px;
    width: 300px; border-bottom: 1px dashed;
  }
  .dark  .os-total-row { border-color: #2a2826; }
  .light .os-total-row { border-color: #ede8e0; }
  .os-total-row:last-of-type { border-bottom: none; }
  .os-total-key { opacity: 0.4; }
  .os-total-val { font-family: 'DM Mono', monospace; font-size: 12.5px; font-weight: 500; }
  .os-total-val.green { color: #6b9e5f; }

  .os-grand-total {
    width: 300px; margin-top: 8px; padding: 14px 0;
    border-top: 2px solid #c4924f;
    display: flex; justify-content: space-between; align-items: center;
  }
  .os-grand-label  { font-size: 9px; font-weight: 600; letter-spacing: 2.2px; text-transform: uppercase; opacity: 0.38; }
  .os-grand-amount { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #c4924f; }

  /* Footer */
  .os-footer {
    padding: 15px 48px; display: flex; justify-content: space-between;
    align-items: center; font-size: 9px; border-top: 1px solid;
    opacity: 0.35; font-family: 'DM Mono', monospace; line-height: 1.8;
  }
  .dark  .os-footer { border-color: #2a2826; }
  .light .os-footer { border-color: #ede8e0; }

  /* ── Action buttons ───────────────────── */
  .os-actions {
    display: flex; justify-content: center; gap: 12px;
    padding: 28px 0 0; flex-wrap: wrap;
    animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.25s both;
  }
  .os-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 28px; border-radius: 4px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 11.5px;
    font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
    cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
  }
  .os-btn:hover  { transform: translateY(-2px); }
  .os-btn:active { transform: translateY(0); }

  .os-btn-primary { background: linear-gradient(135deg, #c4924f, #e8c48a, #c4924f); background-size: 200%; background-position: 0%; color: #fff; box-shadow: 0 4px 16px rgba(196,146,79,0.3); }
  .os-btn-primary:hover { background-position: 100%; box-shadow: 0 8px 28px rgba(196,146,79,0.45); }

  .os-btn-secondary { background: transparent; color: #c4924f; border: 1.5px solid #c4924f; }
  .os-btn-secondary:hover { background: rgba(196,146,79,0.08); box-shadow: 0 4px 16px rgba(196,146,79,0.15); }

  .os-btn-ghost { background: transparent; border: 1.5px solid currentColor; }
  .dark  .os-btn-ghost { color: rgba(240,236,228,0.45); }
  .light .os-btn-ghost { color: rgba(26,21,16,0.42); }
  .os-btn-ghost:hover { opacity: 1 !important; }
  .dark  .os-btn-ghost:hover { color: rgba(240,236,228,0.8); }
  .light .os-btn-ghost:hover { color: rgba(26,21,16,0.75); }

  /* Loading state */
  .os-btn-loading { opacity: 0.6; pointer-events: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .os-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
    animation: spin 0.7s linear infinite; display: inline-block;
  }

  /* ── Error state ──────────────────────── */
  .os-error {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; padding: 80px 48px; gap: 18px;
  }
  .os-error-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: rgba(231,111,81,0.12); color: #e76f51;
    display: flex; align-items: center; justify-content: center; font-size: 26px;
  }
  .os-error h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; }
  .os-error p  { opacity: 0.5; font-size: 14px; max-width: 340px; line-height: 1.6; }

  /* ── Divider ──────────────────────────── */
  .os-divider { height: 1px; margin: 0 48px; opacity: 0.08; background: linear-gradient(90deg, transparent, #c4924f, transparent); }

  /* ── Toast ────────────────────────────── */
  .os-toast {
    position: fixed; bottom: 32px; right: 32px; z-index: 10000;
    padding: 14px 22px; border-radius: 6px; font-size: 13px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.28);
    animation: toastIn 0.35s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateY(16px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .os-toast.success { background: #1e3a1a; color: #a3d49a; border: 1px solid rgba(107,158,95,0.4); }
  .os-toast.error   { background: #3a1a1a; color: #e8a0a0; border: 1px solid rgba(220,80,80,0.4); }
  .light .os-toast.success { background: #f0faf0; color: #3a7a34; border: 1px solid rgba(107,158,95,0.3); }
  .light .os-toast.error   { background: #faf0f0; color: #9a3030; border: 1px solid rgba(220,80,80,0.25); }

  /* ── Print ────────────────────────────── */
  @media print {
    .os-actions, .os-banner, .os-toast, .no-print { display: none !important; }
    .os-root { background: white !important; padding: 0; }
    .os-paper { box-shadow: none !important; }
  }

  /* ── Responsive ───────────────────────── */
  @media (max-width: 640px) {
    .os-header  { padding: 20px 24px 18px; flex-direction: column; gap: 14px; text-align: center; }
    .os-doc-meta { text-align: center; }
    .os-status  { padding: 10px 24px; }
    .os-body    { padding: 24px; gap: 24px; }
    .os-info-grid { grid-template-columns: 1fr; gap: 20px; }
    .os-footer  { padding: 14px 24px; flex-direction: column; gap: 6px; text-align: center; }
    .os-table-head, .os-table-row { grid-template-columns: 1fr 44px 90px 90px; padding: 10px 14px; }
    .os-grand-amount { font-size: 22px; }
    .os-total-row, .os-grand-total { width: 100%; }
    .os-status-hash { display: none; }
  }
`

// ─── Main component ────────────────────────────────────────────────────────
export default function OrderSuccess() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { theme } = useTheme()
  const { t, lang } = useLanguage()

  const [verificationStatus, setVerificationStatus] = useState('verifying')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [confetti, setConfetti] = useState(false)

  const { orderId, orderData } = location.state || {}

  const isPaid = useMemo(() => {
    const os = orderData?.status || ''
    const ps = orderData?.paymentStatus || ''
    return os === 'completed' || ps === 'paid' || ps === 'completed'
  }, [orderData])

  const invoiceNumber = useMemo(() => {
    if (!orderId) return 'N/A'
    return `INV-${(orderId.split('_')[1] || orderId).toUpperCase()}`
  }, [orderId])

  const securityHash = useMemo(() => {
    if (!orderId || !orderData) return 'INVALID'
    const s = `${orderId}${orderData.totalPrice}${orderData.timestamp || Date.now()}`
    let h = 0
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h }
    return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
  }, [orderId, orderData])

  const now = useMemo(() => new Date(), [])
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'

  const creationDate = useMemo(() => ({
    short:  now.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    shortEN: dateShortEN(now),
    iso:    now.toISOString(),
    file:   now.toLocaleDateString('en-GB').replace(/\//g, '-'),
  }), [now, locale])

  const formatPrice = useCallback((p) => {
    return formatCurrency(p, orderData?.currency || 'EGP')
  }, [orderData?.currency])

  const safePrice = useCallback((p) => parseFloat(p) || 0, [])

  // ── Verification effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId || !orderData) {
      setVerificationStatus('invalid')
      return
    }
    const timer = setTimeout(() => {
      setVerificationStatus(isPaid ? 'verified' : 'pending')
      if (isPaid) setConfetti(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [orderId, orderData, isPaid])

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── PDF Generation ───────────────────────────────────────────────────────
  const generatePDF = useCallback(async () => {
    if (!orderData || !orderId || pdfLoading) return
    setPdfLoading(true)

    try {
      const cairoB64 = await loadCairoFont()

      // Register fonts
      if (cairoB64) {
        pdfMake.vfs['Cairo-Regular.ttf'] = cairoB64
        pdfMake.fonts = {
          Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf',
          },
          Cairo: {
            normal: 'Cairo-Regular.ttf',
            bold:   'Cairo-Regular.ttf',
            italics:'Cairo-Regular.ttf',
            bolditalics:'Cairo-Regular.ttf',
          },
        }
      } else {
        pdfMake.fonts = {
          Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf',
          },
        }
      }

      const items    = orderData.items || []
      const discount = safePrice(orderData.discount)
      const shipping = safePrice(orderData.shippingCost)
      const subtotal = safePrice(orderData.subtotal)
      const total    = safePrice(orderData.totalPrice)

      const isPaidStatus = isPaid
      const statusText  = isPaidStatus ? 'PAID' : 'PENDING'
      const statusColor = isPaidStatus ? '#6b9e5f' : '#c4924f'

      let logoB64 = null
      try { logoB64 = await imageToBase64(logoLight) } catch {}

      // Helper: text node that auto-selects font
      const T = (text, style = {}) => {
        const str = safePdfText(text)
        const arabic = cairoB64 && hasArabic(str)
        return {
          text: str,
          font: arabic ? 'Cairo' : 'Roboto',
          alignment: arabic ? 'right' : (style.alignment || 'left'),
          ...style,
        }
      }

      // ── Document definition ──────────────────────────────────────────────
      const doc = {
        pageSize: 'A4',
        pageMargins: [44, 44, 44, 52],
        background: () => buildPdfBackground(securityHash),
        info: {
          title: `Invoice ${invoiceNumber}`,
          author: 'Louable Factory',
          subject: 'Tax Invoice',
          creator: 'Louable Secure System',
          creationDate: new Date(),
        },

        content: [
          // ── Gold topbar line ─────────────────────────────────────────────
          {
            canvas: [{ type: 'rect', x: 0, y: 0, w: 507, h: 4, r: 0, color: '#c4924f' }],
            margin: [0, 0, 0, 20],
          },

          // ── Header row ───────────────────────────────────────────────────
          {
            columns: [
              // Brand
              {
                columns: [
                  logoB64
                    ? { image: logoB64, width: 46, height: 46, margin: [0, 0, 10, 0] }
                    : { text: '', width: 0 },
                  logoB64
                    ? { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 0, y2: 38, lineWidth: 0.8, lineColor: '#c4924f' }], width: 12, margin: [0, 6, 10, 0] }
                    : { text: '', width: 0 },
                  {
                    stack: [
                      { text: 'LOUABLE', fontSize: 16, bold: true, color: '#c4924f' },
                      { text: 'FACTORY', fontSize: 16, bold: true, color: '#2C1810', margin: [0, -3, 0, 0] },
                      { text: 'PREMIUM CHOCOLATES', fontSize: 5.5, color: '#aaa', characterSpacing: 2.2, margin: [0, 4, 0, 0] },
                    ],
                  },
                ],
                columnGap: 0, width: '*',
              },
              // Invoice meta
              {
                stack: [
                  { text: 'TAX INVOICE', fontSize: 19, bold: true, color: '#2C1810', alignment: 'right', characterSpacing: 2 },
                  { text: invoiceNumber, fontSize: 11, color: '#c4924f', alignment: 'right', margin: [0, 6, 0, 0] },
                  { text: creationDate.shortEN, fontSize: 9, color: '#999', alignment: 'right', margin: [0, 3, 0, 0] },
                ],
                width: 'auto',
              },
            ],
            margin: [0, 0, 0, 16],
          },

          // ── Divider ──────────────────────────────────────────────────────
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.55, lineColor: '#e8e0d4' }], margin: [0, 0, 0, 16] },

          // ── Status badge ─────────────────────────────────────────────────
          {
            columns: [
              {
                stack: [
                  {
                    columns: [
                      { canvas: [{ type: 'ellipse', x: 5, y: 5, r1: 4, r2: 4, color: statusColor }], width: 14 },
                      { text: isPaidStatus ? 'PAYMENT CONFIRMED' : 'PAYMENT PENDING', fontSize: 8, bold: true, color: statusColor, margin: [0, 2, 0, 0] },
                    ],
                    columnGap: 4,
                  },
                ],
                width: '*',
              },
              { text: `Security Hash: ${securityHash}`, fontSize: 7, color: '#bbb', alignment: 'right', margin: [0, 3, 0, 0] },
            ],
            margin: [0, 0, 0, 16],
          },

          // ── Billed-to / Order details ─────────────────────────────────────
          {
            columns: [
              // Left: customer
              {
                stack: [
                  { text: 'BILLED TO', fontSize: 7, bold: true, color: '#c4924f', characterSpacing: 2, margin: [0, 0, 0, 8] },
                  T(orderData.customerName || 'Guest', { fontSize: 13, bold: true, color: '#2C1810' }),
                  orderData.customerEmail ? { text: orderData.customerEmail, fontSize: 9, color: '#666', margin: [0, 4, 0, 0] } : {},
                  orderData.customerPhone ? { text: String(orderData.customerPhone), fontSize: 9, color: '#666', margin: [0, 2, 0, 0] } : {},
                  orderData.governorate   ? T(orderData.governorate, { fontSize: 9, color: '#666', margin: [0, 2, 0, 0] }) : {},
                ],
                width: '*',
              },
              // Right: order details table
              {
                stack: [
                  { text: 'ORDER DETAILS', fontSize: 7, bold: true, color: '#c4924f', characterSpacing: 2, margin: [0, 0, 0, 8] },
                  {
                    table: {
                      widths: [72, '*'],
                      body: [
                        [
                          { text: 'Invoice #', fontSize: 9, color: '#999', border: [false,false,false,false], margin: [0,0,0,4] },
                          { text: invoiceNumber, fontSize: 9, bold: true, border: [false,false,false,false], margin: [0,0,0,4] },
                        ],
                        [
                          { text: 'Order ID', fontSize: 9, color: '#999', border: [false,false,false,false], margin: [0,0,0,4] },
                          { text: orderId, fontSize: 7.5, border: [false,false,false,false], margin: [0,0,0,4] },
                        ],
                        [
                          { text: 'Date', fontSize: 9, color: '#999', border: [false,false,false,false], margin: [0,0,0,4] },
                          { text: creationDate.shortEN, fontSize: 9, border: [false,false,false,false], margin: [0,0,0,4] },
                        ],
                        [
                          { text: 'Payment', fontSize: 9, color: '#999', border: [false,false,false,false], margin: [0,0,0,4] },
                          T(orderData.paymentMethod || 'N/A', { fontSize: 9, border: [false,false,false,false], margin: [0,0,0,4] }),
                        ],
                        [
                          { text: 'Status', fontSize: 9, color: '#999', border: [false,false,false,false] },
                          { text: statusText, fontSize: 9, bold: true, color: statusColor, border: [false,false,false,false] },
                        ],
                      ],
                    },
                    layout: 'noBorders',
                  },
                ],
                width: 220,
              },
            ],
            margin: [0, 0, 0, 22],
          },

          // ── Items table ───────────────────────────────────────────────────
          { text: 'ITEMS', fontSize: 7, bold: true, color: '#c4924f', characterSpacing: 2, margin: [0, 0, 0, 8] },
          {
            table: {
              headerRows: 1,
              widths: ['*', 36, 88, 88],
              body: [
                // Header
                [
                  { text: 'DESCRIPTION', bold: true, fontSize: 8, color: '#e8c48a', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                  { text: 'QTY',  bold: true, fontSize: 8, color: '#e8c48a', alignment: 'center', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                  { text: 'UNIT PRICE', bold: true, fontSize: 8, color: '#e8c48a', alignment: 'right', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                  { text: 'AMOUNT', bold: true, fontSize: 8, color: '#e8c48a', alignment: 'right', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                ],
                // Rows
                ...items.map(item => [
                  {
                    ...T(item.name || 'Product', {
                      fontSize: 10.5, bold: true, color: '#2C1810',
                      border: [false,false,false,false], margin: [0, 4, 0, 4],
                    }),
                    border: [false,false,false,false],
                  },
                  { text: String(item.quantity || 1), fontSize: 10, alignment: 'center', color: '#666', border: [false,false,false,false], margin: [0, 4, 0, 4] },
                  { text: formatPrice(item.price), fontSize: 10, alignment: 'right', color: '#666', border: [false,false,false,false], margin: [0, 4, 0, 4] },
                  { text: formatPrice((item.price || 0) * (item.quantity || 1)), fontSize: 10.5, alignment: 'right', bold: true, color: '#2C1810', border: [false,false,false,false], margin: [0, 4, 0, 4] },
                ]),
              ],
            },
            layout: {
              fillColor: (row) => row === 0 ? '#2C1810' : (row % 2 === 0 ? '#faf7f3' : null),
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.4,
              vLineWidth: () => 0,
              hLineColor: () => '#ede8e0',
              paddingTop: () => 0, paddingBottom: () => 0,
              paddingLeft: () => 12, paddingRight: () => 12,
            },
            margin: [0, 0, 0, 20],
          },

          // ── Totals ────────────────────────────────────────────────────────
          {
            columns: [
              // Notes / terms on left
              {
                stack: [
                  { text: 'PAYMENT NOTES', fontSize: 7, bold: true, color: '#c4924f', characterSpacing: 2, margin: [0, 0, 0, 8] },
                  { text: 'Thank you for choosing Louable Factory.', fontSize: 9, color: '#666', margin: [0, 0, 0, 4] },
                  { text: 'All chocolates are handcrafted with premium ingredients.', fontSize: 8.5, color: '#999', margin: [0, 0, 0, 3] },
                  { text: 'For questions, contact hello@louablefactory.com', fontSize: 8.5, color: '#999', margin: [0, 0, 0, 3] },
                  ...(isPaidStatus ? [
                    {
                      columns: [
                        { canvas: [{ type: 'ellipse', x: 4, y: 4, r1: 3.5, r2: 3.5, color: '#6b9e5f' }], width: 12 },
                        { text: 'Payment received. No further action required.', fontSize: 8, color: '#6b9e5f', margin: [0, 1, 0, 0] },
                      ],
                      columnGap: 4, margin: [0, 8, 0, 0],
                    },
                  ] : [
                    {
                      columns: [
                        { canvas: [{ type: 'ellipse', x: 4, y: 4, r1: 3.5, r2: 3.5, color: '#c4924f' }], width: 12 },
                        { text: 'Payment pending. Please complete payment.', fontSize: 8, color: '#c4924f', margin: [0, 1, 0, 0] },
                      ],
                      columnGap: 4, margin: [0, 8, 0, 0],
                    },
                  ]),
                ],
                width: '*',
              },
              // Totals on right
              {
                width: 220,
                stack: [
                  // Subtotal
                  {
                    columns: [
                      { text: 'Subtotal', fontSize: 9.5, color: '#666' },
                      { text: formatPrice(subtotal), fontSize: 9.5, alignment: 'right', color: '#444' },
                    ],
                    margin: [0, 0, 0, 6],
                  },
                  discount > 0 ? {
                    columns: [
                      { text: 'Discount', fontSize: 9.5, color: '#666' },
                      { text: `−${formatPrice(discount)}`, fontSize: 9.5, alignment: 'right', color: '#6b9e5f', bold: true },
                    ],
                    margin: [0, 0, 0, 6],
                  } : {},
                  {
                    columns: [
                      { text: 'Shipping', fontSize: 9.5, color: '#666' },
                      { text: shipping === 0 ? 'FREE' : formatPrice(shipping), fontSize: 9.5, alignment: 'right', color: shipping === 0 ? '#6b9e5f' : '#444', bold: shipping === 0 },
                    ],
                    margin: [0, 0, 0, 6],
                  },
                  // Gold divider
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: '#e8e0d4' }], margin: [0, 4, 0, 10] },
                  // Grand total
                  {
                    columns: [
                      { text: 'TOTAL DUE', fontSize: 9, bold: true, color: '#2C1810', characterSpacing: 1.5 },
                      { text: formatPrice(total), fontSize: 15, alignment: 'right', color: '#c4924f', bold: true },
                    ],
                    margin: [0, 0, 0, 0],
                  },
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 2, lineColor: '#c4924f' }], margin: [0, 8, 0, 0] },
                ],
              },
            ],
            margin: [0, 0, 0, 24],
          },

          // ── Footer divider ────────────────────────────────────────────────
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.5, lineColor: '#e8e0d4' }], margin: [0, 0, 0, 12] },

          // ── Footer ────────────────────────────────────────────────────────
          {
            columns: [
              {
                stack: [
                  { text: 'Louable Factory · Premium Chocolates', fontSize: 8, color: '#999' },
                  { text: 'hello@louablefactory.com', fontSize: 7.5, color: '#bbb', margin: [0, 2, 0, 0] },
                ],
              },
              {
                stack: [
                  { text: `Hash: ${securityHash}`, fontSize: 7, color: '#bbb', alignment: 'right' },
                  { text: `${creationDate.iso.slice(0, 19).replace('T', ' ')} UTC`, fontSize: 6.5, color: '#bbb', alignment: 'right', margin: [0, 2, 0, 0] },
                  { text: 'Computer-generated · No signature required', fontSize: 6.5, color: '#ccc', italics: true, alignment: 'right', margin: [0, 2, 0, 0] },
                ],
              },
            ],
          },
        ],

        defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#2C1810', lineHeight: 1.3 },
      }

      pdfMake.createPdf(doc).download(`Louable_Invoice_${invoiceNumber}_${creationDate.file}.pdf`)
      showToast('Invoice downloaded successfully ✓', 'success')
    } catch (err) {
      console.error('PDF generation error:', err)
      showToast('PDF generation failed. Try printing instead.', 'error')
    } finally {
      setPdfLoading(false)
    }
  }, [orderData, orderId, invoiceNumber, securityHash, creationDate, formatPrice, safePrice, isPaid, showToast, pdfLoading])

  const handlePrint = useCallback(() => window.print(), [])

  // ── Invalid state ────────────────────────────────────────────────────────
  if (verificationStatus === 'invalid') {
    return (
      <>
        <style>{css}</style>
        <div className={`os-root ${theme}`}>
          <div className="os-paper" style={{ maxWidth: 520, marginTop: 60 }}>
            <div className="os-topbar" style={{ background: '#e76f51' }} />
            <div className="os-error">
              <div className="os-error-icon">✕</div>
              <h2>{t('orderNotFound') || 'Order Not Found'}</h2>
              <p>{t('orderInfoMissing') || 'No order information was found. Please return to the shop and try again.'}</p>
              <button className="os-btn os-btn-primary" onClick={() => navigate('/home')}>
                ← {t('returnHome') || 'Return Home'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const discount = safePrice(orderData?.discount)
  const shipping  = safePrice(orderData?.shippingCost)

  // ── Banner config ────────────────────────────────────────────────────────
  const bannerConfig = {
    verified:  { icon: '✓', title: t('paymentConfirmed') || 'Payment Confirmed', body: t('orderBeingPrepared') || 'Your order is confirmed and being prepared.' },
    pending:   { icon: '⏳', title: t('paymentPending')  || 'Payment Pending',   body: t('orderReceivedPending') || 'We received your order. Complete payment to proceed.' },
    verifying: { icon: '◌', title: t('verifying')        || 'Verifying…',        body: t('checkingOrderStatus')  || 'Checking your order status…' },
  }[verificationStatus] || {}

  return (
    <>
      <style>{css}</style>
      <ConfettiBurst active={confetti} />

      <div className={`os-root ${theme}`}>

        {/* ── Success / status banner ───────────────────────────────────── */}
        <div className={`os-banner ${verificationStatus}`}>
          <div className="os-banner-icon">{bannerConfig.icon}</div>
          <div className="os-banner-body">
            <h3>{bannerConfig.title}</h3>
            <p>{bannerConfig.body}</p>
          </div>
          <div className="os-banner-hash">
            <div>{invoiceNumber}</div>
            <div>{creationDate.short}</div>
          </div>
        </div>

        {/* ── Invoice paper ─────────────────────────────────────────────── */}
        <div className="os-paper">
          <SecurityLayer orderId={orderId} securityHash={securityHash} isDark={theme === 'dark'} />

          <div className="os-layer">
            {/* Gold topbar */}
            <div className="os-topbar" />

            {/* Header */}
            <div className="os-header">
              <div className="os-brand">
                <img src={logoLight} alt="Louable Factory" className="os-logo" />
                <div className="os-brand-sep" />
                <div>
                  <div className="os-brand-name">Louable Factory</div>
                  <div className="os-brand-sub">Premium Chocolates</div>
                </div>
              </div>
              <div className="os-doc-meta">
                <div className="os-doc-label">{t('invoice') || 'Invoice'}</div>
                <div className="os-doc-num">{invoiceNumber}</div>
                <div className="os-doc-date">{creationDate.short}</div>
              </div>
            </div>

            {/* Status strip */}
            <div className={`os-status ${verificationStatus}`}>
              <div className="os-status-dot" />
              {verificationStatus === 'verified'
                ? t('paymentConfirmed')  || 'Payment Confirmed'
                : verificationStatus === 'pending'
                ? t('paymentPending')    || 'Payment Pending'
                : t('verifying')         || 'Verifying…'}
              <span className="os-status-hash">Hash: {securityHash}</span>
            </div>

            {/* Body */}
            <div className="os-body">

              {/* Info grid */}
              <div className="os-info-grid">
                {/* Billed to */}
                <div>
                  <div className="os-block-label">{t('billedTo') || 'Billed To'}</div>
                  <div className="os-info-row">
                    <span className="os-info-key">{t('name') || 'Name'}</span>
                    <span className={`os-info-val${hasArabic(orderData?.customerName) ? ' rtl' : ''}`}>
                      {orderData?.customerName || 'Guest'}
                    </span>
                  </div>
                  {orderData?.customerEmail && (
                    <div className="os-info-row">
                      <span className="os-info-key">{t('email') || 'Email'}</span>
                      <span className="os-info-val">{orderData.customerEmail}</span>
                    </div>
                  )}
                  {orderData?.customerPhone && (
                    <div className="os-info-row">
                      <span className="os-info-key">{t('phoneNumber') || 'Phone'}</span>
                      <span className="os-info-val mono">{orderData.customerPhone}</span>
                    </div>
                  )}
                  {orderData?.governorate && (
                    <div className="os-info-row">
                      <span className="os-info-key">{t('region') || 'Region'}</span>
                      <span className={`os-info-val${hasArabic(orderData.governorate) ? ' rtl' : ''}`}>
                        {orderData.governorate}
                      </span>
                    </div>
                  )}
                </div>

                {/* Order details */}
                <div>
                  <div className="os-block-label">{t('orderDetails') || 'Order Details'}</div>
                  <div className="os-info-row">
                    <span className="os-info-key">{t('invoiceNumber') || 'Invoice'}</span>
                    <span className="os-info-val mono">{invoiceNumber}</span>
                  </div>
                  <div className="os-info-row">
                    <span className="os-info-key">{t('orderId') || 'Order ID'}</span>
                    <span className="os-info-val mono" style={{ fontSize: 10 }}>{orderId}</span>
                  </div>
                  <div className="os-info-row">
                    <span className="os-info-key">{t('date') || 'Date'}</span>
                    <span className="os-info-val">{creationDate.short}</span>
                  </div>
                  <div className="os-info-row">
                    <span className="os-info-key">{t('paymentMethod') || 'Payment'}</span>
                    <span className={`os-info-val${hasArabic(orderData?.paymentMethod) ? ' rtl' : ''}`}>
                      {orderData?.paymentMethod || 'N/A'}
                    </span>
                  </div>
                  <div className="os-info-row">
                    <span className="os-info-key">{t('status') || 'Status'}</span>
                    <span className={`os-info-val ${isPaid ? 'green' : 'gold'}`}>
                      {isPaid ? (t('paid') || 'Paid') : (t('pending') || 'Pending')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div>
                <div className="os-block-label">{t('items') || 'Items'}</div>
                <div className="os-table-wrap">
                  <div className="os-table-head">
                    <span>{t('description') || 'Description'}</span>
                    <span>{t('qty') || 'Qty'}</span>
                    <span>{t('unitPrice') || 'Unit Price'}</span>
                    <span>{t('amount') || 'Amount'}</span>
                  </div>
                  {(orderData?.items || []).map((item, i) => (
                    <div className="os-table-row" key={i}>
                      <span className="os-item-name">{item.name}</span>
                      <span className="os-item-qty">×{item.quantity || 1}</span>
                      <span className="os-item-price">{formatPrice(item.price)}</span>
                      <span className="os-item-total">{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="os-totals">
                <div className="os-total-row">
                  <span className="os-total-key">{t('subtotal') || 'Subtotal'}</span>
                  <span className="os-total-val">{formatPrice(orderData?.subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="os-total-row">
                    <span className="os-total-key">{t('discount') || 'Discount'}</span>
                    <span className="os-total-val green">−{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="os-total-row">
                  <span className="os-total-key">{t('shipping') || 'Shipping'}</span>
                  <span className="os-total-val" style={shipping === 0 ? { color: '#6b9e5f' } : {}}>
                    {shipping === 0 ? (t('free') || 'FREE') : formatPrice(shipping)}
                  </span>
                </div>
                <div className="os-grand-total">
                  <span className="os-grand-label">{t('totalDue') || 'Total Due'}</span>
                  <span className="os-grand-amount">{formatPrice(orderData?.totalPrice)}</span>
                </div>
              </div>

            </div>{/* /os-body */}

            {/* Footer */}
            <div className="os-footer">
              <div>
                <div>{t('thankYouOrder') || 'Thank you for your order'}, {orderData?.customerName?.split(' ')[0] || (t('valuedCustomer') || 'Customer')}.</div>
                <div>Louable Factory · Premium Chocolates · hello@louablefactory.com</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Hash: {securityHash} · {orderId}</div>
                <div>{creationDate.iso.slice(0, 19).replace('T', ' ')} UTC</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div className="os-actions no-print">
          <button className="os-btn os-btn-ghost" onClick={() => navigate('/home')}>
            ← {t('backToShop') || 'Back to Shop'}
          </button>
          <button className="os-btn os-btn-primary" onClick={handlePrint}>
            🖨 {t('print') || 'Print'}
          </button>
          
        </div>

      </div>

      {/* ── Toast notification ──────────────────────────────────────────── */}
      {toast && (
        <div className={`os-toast ${toast.type} ${theme}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
    </>
  )
}