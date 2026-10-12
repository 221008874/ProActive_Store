// Analytics: the GA4 funnel events the design's steps map to.
//
//   view_item_list   a grid or row of products renders
//   view_item        a product page renders
//   select_item      the shopper picks a colour or size
//   add_to_cart      a line is added
//   begin_checkout   Bag -> Delivery
//   purchase         an order is placed (the only money event)
//
// Everything is a no-op until VITE_GA_MEASUREMENT_ID is set, so the store
// never loads a tracker it was not configured for. A consent banner (when
// one exists) gates tracking through setAnalyticsConsent(false); with no
// banner the default is allowed, which matches the current site.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const CONSENT_KEY = 'pa_analytics_consent'

let loaderInjected = false

function consentGranted() {
  try {
    return localStorage.getItem(CONSENT_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setAnalyticsConsent(enabled) {
  try {
    localStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false')
  } catch {
    // private mode: consent cannot be remembered
  }
}

function load() {
  if (!GA_ID || loaderInjected || typeof document === 'undefined') return
  loaderInjected = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { anonymize_ip: true })
}

export function trackEvent(name, params = {}) {
  if (!GA_ID || !consentGranted()) return
  load()
  window.gtag?.('event', name, params)
}

const id = (line) => `${line.productId}:${line.variantId ?? ''}`

const line = (item) => ({
  item_id: item.variantId ? id(item) : item.id ?? item.productId,
  item_name: typeof item.title === 'object' ? item.title.en ?? item.title.ar : item.title ?? item.name,
  item_variant: [item.color, item.size].filter(Boolean).join(' / ') || undefined,
  price: Number(item.unitPrice ?? item.price ?? 0),
  quantity: Number(item.qty ?? item.quantity ?? 1)
})

export const analytics = {
  viewItemList(items = [], listName = 'catalog') {
    trackEvent('view_item_list', {
      item_list_name: listName,
      items: items.slice(0, 20).map((item) => ({ item_id: item.id ?? item.slug, item_name: typeof item.title === 'object' ? item.title.en ?? item.title.ar : item.title, price: Number(item.price ?? 0) }))
    })
  },

  viewItem(product) {
    if (!product) return
    trackEvent('view_item', {
      currency: 'EGP',
      value: Number(product.price ?? 0),
      items: [{ item_id: product.id, item_name: typeof product.title === 'object' ? product.title.en ?? product.title.ar : product.title, price: Number(product.price ?? 0) }]
    })
  },

  selectItem(product, color, size) {
    if (!product) return
    trackEvent('select_item', {
      item_list_name: 'product',
      items: [{ item_id: product.id, item_variant: [color, size].filter(Boolean).join(' / ') || undefined }]
    })
  },

  addToCart(item, quantity = 1) {
    if (!item) return
    trackEvent('add_to_cart', { currency: 'EGP', value: Number(item.price ?? 0) * quantity, items: [{ ...line(item), quantity }] })
  },

  beginCheckout(items = [], value) {
    trackEvent('begin_checkout', { currency: 'EGP', value: Number(value ?? 0), items: items.map(line) })
  },

  purchase(order) {
    if (!order) return
    trackEvent('purchase', {
      transaction_id: order.orderNumber ?? order.orderId,
      currency: 'EGP',
      value: Number(order.totalPrice ?? order.total ?? 0),
      items: (order.items ?? []).map(line)
    })
  },

  whatsappClick(action) {
    trackEvent('whatsapp_click', { action })
  }
}
