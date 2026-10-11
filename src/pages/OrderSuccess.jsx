// src/pages/OrderSuccess.jsx
// Full enhanced version with Arabic support, beautiful UI, and rich PDF generation

import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import logoLight from '../assets/a29dc90a-d036-4010-b33e-82cd29b6a2d5-removebg-preview.png'
import { COLORS, getColors } from '../config/themes'
import { Button, StepHeader, Summary, StatusPill, formatEGP } from '../ui'

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

// Money formatting is the design system's formatEGP (it delegates to the
// store's formatPrice), so the screen receipt and the generated PDF can never
// disagree the way a local `EGP x.xx` helper could.
function dateShortEN(d) {
  return new Date(d || Date.now()).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ─── PDF background watermark ──────────────────────────────────────────────
// The PDF is always printed on white paper, so the receipt generator pins to
// the LIGHT board palette regardless of the screen theme. pdfMake takes literal
// hexes; CSS custom properties are not available to it.
const PDF = COLORS.light

function buildPdfBackground(securityHash, W = 595, H = 842) {
  const gold = COLORS.light.disabled
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
    text: `PROACTIVE STORE · SECURE · ${securityHash} · NOT FOR REPRODUCTION · `.repeat(4),
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
function SecurityLayer({ securityHash, isDark }) {
  const c = getColors(isDark ? 'dark' : 'light')
  const color   = c.disabled
  const opacity = 0.032
  const secText = `PROACTIVE STORE · SECURE · ${securityHash} · `
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
function ConfettiBurst({ active, theme = 'light' }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    // Board palette: ink/stone carry the paper confetti, sale + instock the accents.
    const c = getColors(theme)
    const CONFETTI_COLORS = [c.primary, c.textMuted, c.success, c.danger, c.warning, c.surface]
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * -8 - 2,
      r: Math.random() * 5 + 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
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
  }, [active, theme])

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

  const safePrice = useCallback((p) => parseFloat(p) || 0, [])

  const formatPrice = useCallback((p) => formatEGP(safePrice(p)), [safePrice])

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
      const statusColor = isPaidStatus ? PDF.success : PDF.textDark

      let logoB64 = null
      try {
        logoB64 = await imageToBase64(logoLight)
      } catch {
        logoB64 = null // the logo is decoration; the receipt renders without it
      }

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
          author: 'ProActive Store',
          subject: 'Tax Invoice',
          creator: 'ProActive Store Secure System',
          creationDate: new Date(),
        },

        content: [
          // ── Gold topbar line ─────────────────────────────────────────────
          {
            canvas: [{ type: 'rect', x: 0, y: 0, w: 507, h: 4, r: 0, color: PDF.textDark }],
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
                    ? { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 0, y2: 38, lineWidth: 0.8, lineColor: PDF.textDark }], width: 12, margin: [0, 6, 10, 0] }
                    : { text: '', width: 0 },
                  {
                    stack: [
                      { text: 'PROACTIVE STORE', fontSize: 16, bold: true, color: PDF.textDark },
                      { text: 'FASHION', fontSize: 16, bold: true, color: PDF.textDark, margin: [0, -3, 0, 0] },
                      { text: 'DELIVERED ACROSS EGYPT', fontSize: 5.5, color: PDF.disabled, characterSpacing: 2.2, margin: [0, 4, 0, 0] },
                    ],
                  },
                ],
                columnGap: 0, width: '*',
              },
              // Invoice meta
              {
                stack: [
                  { text: 'TAX INVOICE', fontSize: 19, bold: true, color: PDF.textDark, alignment: 'right', characterSpacing: 2 },
                  { text: invoiceNumber, fontSize: 11, color: PDF.textDark, alignment: 'right', margin: [0, 6, 0, 0] },
                  { text: creationDate.shortEN, fontSize: 9, color: PDF.disabled, alignment: 'right', margin: [0, 3, 0, 0] },
                ],
                width: 'auto',
              },
            ],
            margin: [0, 0, 0, 16],
          },

          // ── Divider ──────────────────────────────────────────────────────
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.55, lineColor: PDF.line }], margin: [0, 0, 0, 16] },

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
              { text: `Security Hash: ${securityHash}`, fontSize: 7, color: PDF.disabled, alignment: 'right', margin: [0, 3, 0, 0] },
            ],
            margin: [0, 0, 0, 16],
          },

          // ── Billed-to / Order details ─────────────────────────────────────
          {
            columns: [
              // Left: customer
              {
                stack: [
                  { text: 'BILLED TO', fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
                  T(orderData.customerName || 'Guest', { fontSize: 13, bold: true, color: PDF.textDark }),
                  orderData.customerEmail ? { text: orderData.customerEmail, fontSize: 9, color: PDF.textMuted, margin: [0, 4, 0, 0] } : {},
                  orderData.customerPhone ? { text: String(orderData.customerPhone), fontSize: 9, color: PDF.textMuted, margin: [0, 2, 0, 0] } : {},
                  orderData.governorate   ? T(orderData.governorate, { fontSize: 9, color: PDF.textMuted, margin: [0, 2, 0, 0] }) : {},
                ],
                width: '*',
              },
              // Right: order details table
              {
                stack: [
                  { text: 'ORDER DETAILS', fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
                  {
                    table: {
                      widths: [72, '*'],
                      body: [
                        [
                          { text: 'Invoice #', fontSize: 9, color: PDF.disabled, border: [false,false,false,false], margin: [0,0,0,4] },
                          { text: invoiceNumber, fontSize: 9, bold: true, border: [false,false,false,false], margin: [0,0,0,4] },
                        ],
                        [
                          { text: 'Order ID', fontSize: 9, color: PDF.disabled, border: [false,false,false,false], margin: [0,0,0,4] },
                          { text: orderId, fontSize: 7.5, border: [false,false,false,false], margin: [0,0,0,4] },
                        ],
                        [
                          { text: 'Date', fontSize: 9, color: PDF.disabled, border: [false,false,false,false], margin: [0,0,0,4] },
                          { text: creationDate.shortEN, fontSize: 9, border: [false,false,false,false], margin: [0,0,0,4] },
                        ],
                        [
                          { text: 'Payment', fontSize: 9, color: PDF.disabled, border: [false,false,false,false], margin: [0,0,0,4] },
                          T(orderData.paymentMethod || 'N/A', { fontSize: 9, border: [false,false,false,false], margin: [0,0,0,4] }),
                        ],
                        [
                          { text: 'Status', fontSize: 9, color: PDF.disabled, border: [false,false,false,false] },
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
          { text: 'ITEMS', fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
          {
            table: {
              headerRows: 1,
              widths: ['*', 36, 88, 88],
              body: [
                // Header
                [
                  { text: 'DESCRIPTION', bold: true, fontSize: 8, color: PDF.card, border: [false,false,false,false], margin: [0, 2, 0, 2] },
                  { text: 'QTY',  bold: true, fontSize: 8, color: PDF.card, alignment: 'center', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                  { text: 'UNIT PRICE', bold: true, fontSize: 8, color: PDF.card, alignment: 'right', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                  { text: 'AMOUNT', bold: true, fontSize: 8, color: PDF.card, alignment: 'right', border: [false,false,false,false], margin: [0, 2, 0, 2] },
                ],
                // Rows
                ...items.map(item => [
                  {
                    ...T(item.name || 'Product', {
                      fontSize: 10.5, bold: true, color: PDF.textDark,
                      border: [false,false,false,false], margin: [0, 4, 0, 4],
                    }),
                    border: [false,false,false,false],
                  },
                  { text: String(item.quantity || 1), fontSize: 10, alignment: 'center', color: PDF.textMuted, border: [false,false,false,false], margin: [0, 4, 0, 4] },
                  { text: formatPrice(item.price), fontSize: 10, alignment: 'right', color: PDF.textMuted, border: [false,false,false,false], margin: [0, 4, 0, 4] },
                  { text: formatPrice((item.price || 0) * (item.quantity || 1)), fontSize: 10.5, alignment: 'right', bold: true, color: PDF.textDark, border: [false,false,false,false], margin: [0, 4, 0, 4] },
                ]),
              ],
            },
            layout: {
              fillColor: (row) => row === 0 ? PDF.textDark : (row % 2 === 0 ? PDF.stone : null),
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.4,
              vLineWidth: () => 0,
              hLineColor: () => PDF.line,
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
                  { text: 'PAYMENT NOTES', fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
                  { text: 'Thank you for choosing ProActive Store.', fontSize: 9, color: PDF.textMuted, margin: [0, 0, 0, 4] },
                  { text: 'Every piece is quality-checked before it ships.', fontSize: 8.5, color: PDF.disabled, margin: [0, 0, 0, 3] },
                  { text: 'For questions, contact proactive.store.eg@gmail.com', fontSize: 8.5, color: PDF.disabled, margin: [0, 0, 0, 3] },
                  ...(isPaidStatus ? [
                    {
                      columns: [
                        { canvas: [{ type: 'ellipse', x: 4, y: 4, r1: 3.5, r2: 3.5, color: PDF.success }], width: 12 },
                        { text: 'Payment received. No further action required.', fontSize: 8, color: PDF.success, margin: [0, 1, 0, 0] },
                      ],
                      columnGap: 4, margin: [0, 8, 0, 0],
                    },
                  ] : [
                    {
                      columns: [
                        { canvas: [{ type: 'ellipse', x: 4, y: 4, r1: 3.5, r2: 3.5, color: PDF.textDark }], width: 12 },
                        { text: 'Payment pending. Please complete payment.', fontSize: 8, color: PDF.textDark, margin: [0, 1, 0, 0] },
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
                      { text: 'Subtotal', fontSize: 9.5, color: PDF.textMuted },
                      { text: formatPrice(subtotal), fontSize: 9.5, alignment: 'right', color: PDF.textMuted },
                    ],
                    margin: [0, 0, 0, 6],
                  },
                  discount > 0 ? {
                    columns: [
                      { text: 'Discount', fontSize: 9.5, color: PDF.textMuted },
                      { text: `−${formatPrice(discount)}`, fontSize: 9.5, alignment: 'right', color: PDF.success, bold: true },
                    ],
                    margin: [0, 0, 0, 6],
                  } : {},
                  {
                    columns: [
                      { text: 'Shipping', fontSize: 9.5, color: PDF.textMuted },
                      { text: shipping === 0 ? 'FREE' : formatPrice(shipping), fontSize: 9.5, alignment: 'right', color: shipping === 0 ? PDF.success : PDF.textMuted, bold: shipping === 0 },
                    ],
                    margin: [0, 0, 0, 6],
                  },
                  // Gold divider
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: PDF.line }], margin: [0, 4, 0, 10] },
                  // Grand total
                  {
                    columns: [
                      { text: 'TOTAL DUE', fontSize: 9, bold: true, color: PDF.textDark, characterSpacing: 1.5 },
                      { text: formatPrice(total), fontSize: 15, alignment: 'right', color: PDF.textDark, bold: true },
                    ],
                    margin: [0, 0, 0, 0],
                  },
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 2, lineColor: PDF.textDark }], margin: [0, 8, 0, 0] },
                ],
              },
            ],
            margin: [0, 0, 0, 24],
          },

          // ── Footer divider ────────────────────────────────────────────────
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.5, lineColor: PDF.line }], margin: [0, 0, 0, 12] },

          // ── Footer ────────────────────────────────────────────────────────
          {
            columns: [
              {
                stack: [
                  { text: 'ProActive Store · Fashion', fontSize: 8, color: PDF.disabled },
                  { text: 'proactive.store.eg@gmail.com', fontSize: 7.5, color: PDF.disabled, margin: [0, 2, 0, 0] },
                ],
              },
              {
                stack: [
                  { text: `Hash: ${securityHash}`, fontSize: 7, color: PDF.disabled, alignment: 'right' },
                  { text: `${creationDate.iso.slice(0, 19).replace('T', ' ')} UTC`, fontSize: 6.5, color: PDF.disabled, alignment: 'right', margin: [0, 2, 0, 0] },
                  { text: 'Computer-generated · No signature required', fontSize: 6.5, color: '#ccc', italics: true, alignment: 'right', margin: [0, 2, 0, 0] },
                ],
              },
            ],
          },
        ],

        defaultStyle: { font: 'Roboto', fontSize: 10.5, color: PDF.textDark, lineHeight: 1.3 },
      }

      pdfMake.createPdf(doc).download(`ProActive_Invoice_${invoiceNumber}_${creationDate.file}.pdf`)
      showToast('Invoice downloaded successfully ✓', 'success')
    } catch (err) {
      console.error('PDF generation error:', err)
      showToast('PDF generation failed. Try printing instead.', 'error')
    } finally {
      setPdfLoading(false)
    }
  }, [orderData, orderId, invoiceNumber, securityHash, creationDate, formatPrice, safePrice, isPaid, showToast, pdfLoading])

  const handlePrint = useCallback(() => window.print(), [])

  // ── Print: the receipt IS the document; controls, banner and toast are not ──
  const printCss = `@media print { .no-print { display: none !important; } }`

  // ── Invalid state ────────────────────────────────────────────────────────
  if (verificationStatus === 'invalid') {
    return (
      <>
        <style>{printCss}</style>
        <StepHeader title={t('orderNotFound') || 'Order Not Found'} step={3} of={3} backHref="/home" />
        <div className="pa-receipt" style={{ maxWidth: 520, marginInline: 'auto', width: '100%', alignItems: 'center', textAlign: 'center' }}>
          <div className="pa-callout pa-callout--error" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <b aria-hidden="true" style={{ fontSize: 26 }}>✕</b>
            <b>{t('orderNotFound') || 'Order Not Found'}</b>
            <span className="pa-subtitle">{t('orderInfoMissing') || 'No order information was found. Please return to the shop and try again.'}</span>
            <Button onClick={() => navigate('/home')}>
              ← {t('returnHome') || 'Return Home'}
            </Button>
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

  const ar = lang === 'ar'
  const L = (key, en, fallback) => {
    const v = t(key)
    return v && v !== key ? v : (ar ? fallback : en)
  }

  const timeline = [
    L('orderPlaced', 'Order placed', 'تم الطلب'),
    L('orderConfirmed', 'Confirmed', 'تم التأكيد'),
    L('orderShipped', 'Shipped', 'تم الشحن'),
    L('orderDelivered', 'Delivered', 'تم التوصيل')
  ]
  const timelineDone = verificationStatus === 'verified' ? 2 : verificationStatus === 'pending' ? 1 : 0

  const infoRow = (key, value) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span className="pa-subtitle">{key}</span>
      <bdi style={{ textAlign: 'end' }}>{value}</bdi>
    </div>
  )

  return (
    <>
      <style>{printCss}</style>
      <ConfettiBurst active={confetti} theme={theme} />

      <StepHeader
        title={t('orderConfirmed') || 'Order Confirmed!'}
        step={3}
        of={3}
        backHref="/home"
      />

      <div className="pa-receipt" style={{ maxWidth: 860, marginInline: 'auto', width: '100%' }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SecurityLayer orderId={orderId} securityHash={securityHash} isDark={theme === 'dark'} />

          {/* Success / status banner */}
          <div className={`pa-callout no-print ${isPaid ? 'pa-ok' : ''}`} role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <b aria-hidden="true" style={{ fontSize: 20, lineHeight: 1.2 }}>{bannerConfig.icon}</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 auto' }}>
              <b>{bannerConfig.title}</b>
              <span className="pa-subtitle">{bannerConfig.body}</span>
            </div>
            <div className="pa-subtitle" style={{ textAlign: 'end' }}>
              <div><bdi>{invoiceNumber}</bdi></div>
              <div>{creationDate.short}</div>
            </div>
          </div>

          {/* Order timeline */}
          <div className="pa-timeline no-print" aria-hidden="true">
            {timeline.map((label, i) => (
              <span key={label} data-done={i < timelineDone}>{label}</span>
            ))}
          </div>

          {/* Billed to */}
          <div className="pa-block">
            <div className="pa-group-title">{t('billedTo') || 'Billed To'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {infoRow(t('name') || 'Name', orderData?.customerName || 'Guest')}
              {orderData?.customerEmail && infoRow(t('email') || 'Email', orderData.customerEmail)}
              {orderData?.customerPhone && infoRow(t('phoneNumber') || 'Phone', orderData.customerPhone)}
              {orderData?.governorate && infoRow(t('region') || 'Region', orderData.governorate)}
            </div>
          </div>

          {/* Order details */}
          <div className="pa-block">
            <div className="pa-group-title">{t('orderDetails') || 'Order Details'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {infoRow(t('invoiceNumber') || 'Invoice', invoiceNumber)}
              {infoRow(t('orderId') || 'Order ID', orderId)}
              {infoRow(t('date') || 'Date', creationDate.short)}
              {infoRow(t('paymentMethod') || 'Payment', orderData?.paymentMethod || 'N/A')}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span className="pa-subtitle">{t('status') || 'Status'}</span>
                <StatusPill
                  status={isPaid ? 'delivered' : 'pending'}
                  label={isPaid ? (t('paid') || 'Paid') : (t('pending') || 'Pending')}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="pa-block">
            <div className="pa-group-title">{t('items') || 'Items'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(orderData?.items || []).map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: 12, alignItems: 'baseline' }}>
                  <span>{item.name}</span>
                  <span className="pa-subtitle">×{item.quantity || 1}</span>
                  <span className="pa-subtitle">{formatPrice(item.price)}</span>
                  <bdi>{formatPrice((item.price || 0) * (item.quantity || 1))}</bdi>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <Summary
            rows={[
              { label: t('subtotal'), value: formatPrice(orderData?.subtotal) },
              ...(discount > 0
                ? [{ label: t('discount'), value: `−${formatPrice(discount)}`, tone: 'discount' }]
                : []),
              {
                label: t('shipping'),
                value: shipping === 0 ? (t('free') || 'FREE') : formatPrice(shipping)
              },
              { label: t('totalDue'), value: formatPrice(orderData?.totalPrice), tone: 'total' }
            ]}
          />

          {/* Footer */}
          <div className="pa-callout" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>
              {t('thankYouOrder') || 'Thank you for your order'}, {orderData?.customerName?.split(' ')[0] || (t('valuedCustomer') || 'Customer')}.
            </span>
            <span className="pa-subtitle">ProActive Store · Fashion · proactive.store.eg@gmail.com</span>
            <span className="pa-subtitle">Hash: <bdi>{securityHash}</bdi> · <bdi>{orderId}</bdi></span>
            <span className="pa-subtitle"><bdi>{creationDate.iso.slice(0, 19).replace('T', ' ')}</bdi> UTC</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px 32px' }}>
        <Button variant="outline" onClick={() => navigate('/home')}>
          ← {t('backToShop') || 'Back to Shop'}
        </Button>
        <Button variant="outline" onClick={generatePDF} disabled={pdfLoading}>
          {pdfLoading ? '…' : '⬇'} {t('downloadPdf') || 'Download PDF'}
        </Button>
        <Button onClick={handlePrint}>
          🖨 {t('print') || 'Print'}
        </Button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`pa-callout no-print ${toast.type === 'success' ? 'pa-ok' : 'pa-callout--error'}`} role="status" style={{ position: 'fixed', insetInline: 16, bottom: 88, zIndex: 10000 }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
    </>
  )
}
