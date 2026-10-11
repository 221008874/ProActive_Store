// Server-side invoice renderer.
//
// The storefront generates its invoice in the shopper's browser
// (src/pages/OrderSuccess.jsx). That copy is for the customer to download at
// checkout and is never archived. This module renders the same A4 tax
// invoice on the server, from the ORDER DOCUMENT IN FIRESTORE, so the copy
// that lands in the document store is authoritative:
//
//   - real orderNumber and real createdAt (the browser copy stamps the render
//     time, and its invoice number came from the order id tail)
//   - the full delivery address - street, city, building, notes and pin; the
//     browser copy only ever rendered the governorate
//   - the coupon, source and status that were actually stored
//   - a deterministic security hash derived from the order id, so the same
//     order always archives with the same marker
//
// Everything client-side (canvas, fetch of the Cairo font from Google's CDN)
// is replaced here by committed base64 assets - a serverless function must
// not depend on a third party to produce an archived legal document.

import { createHash } from "node:crypto";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { CAIRO_TTF_B64, LOGO_PNG_B64 } from "./assets.js";

// The board palette, LIGHT always: the archived PDF is a document, not a
// themed screen. Mirrors COLORS.light in src/config/themes.js.
const PDF = {
  textDark: "#121212",
  textMuted: "#5B5B5B",
  textLight: "#5B5B5B",
  text: "#121212",
  heading: "#121212",
  link: "#121212",
  border: "#E4E1DA",
  disabled: "#8A8780",
  success: "#1B7F4B",
  danger: "#C8102E",
  warning: "#B45309",
  line: "#E4E1DA",
  stone: "#F4F2EE",
  card: "#FFFFFF",
  background: "#FFFFFF",
  surface: "#F4F2EE",
  overlay: "rgba(18, 18, 18, 0.05)"
};

const STORE_EMAIL = "proactive.store.eg@gmail.com";

function hasArabic(str) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || "");
}

// The order's createdAt is a Firestore Timestamp; the fake used in tests
// writes a sentinel. Both, plus Date and epoch ms, resolve to epoch ms.
export function toMillis(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return null;
}

function dateShortEN(ms) {
  return new Date(ms ?? Date.now()).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatPrice(price) {
  const amount = Number(price) || 0;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} EGP`;
}

// Deterministic: the archived bill for an order always carries the same
// security marker (the browser copy mixed a render-time timestamp in, so a
// re-download produced a different hash).
export function securityHashFor(orderId) {
  return createHash("sha256").update(String(orderId)).digest("hex").slice(0, 8).toUpperCase();
}

function buildPdfBackground(securityHash, W = 595, H = 842) {
  const gold = PDF.disabled;
  const shapes = [];

  for (let x = -H; x < W + H; x += 20) {
    shapes.push({
      type: "line",
      x1: x,
      y1: 0,
      x2: x + H,
      y2: H,
      lineWidth: 0.12,
      lineColor: gold
    });
  }

  [50, 90, 132, 178, 228, 280, 336].forEach((r) => {
    shapes.push({
      type: "ellipse",
      x: W / 2,
      y: H / 2,
      r1: r,
      r2: r,
      lineWidth: 0.18,
      lineColor: gold,
      dash: { length: 3, space: 9 }
    });
  });

  const corners = [
    [36, 36],
    [W - 36, 36],
    [36, H - 36],
    [W - 36, H - 36]
  ];
  corners.forEach(([cx, cy]) => {
    [8, 16, 26, 38].forEach((r) => {
      shapes.push({
        type: "ellipse",
        x: cx,
        y: cy,
        r1: r,
        r2: r,
        lineWidth: 0.16,
        lineColor: gold,
        dash: { length: 2, space: 5 }
      });
    });
  });

  shapes.push({ type: "rect", x: 8, y: 8, w: W - 16, h: H - 16, lineWidth: 0.6, lineColor: gold });
  shapes.push({ type: "rect", x: 14, y: 14, w: W - 28, h: H - 28, lineWidth: 0.18, lineColor: gold });

  const brackets = [
    { x: 14, y: 14, dx: 24, dy: 24 },
    { x: W - 14, y: 14, dx: -24, dy: 24 },
    { x: 14, y: H - 14, dx: 24, dy: -24 },
    { x: W - 14, y: H - 14, dx: -24, dy: -24 }
  ];
  brackets.forEach(({ x, y, dx, dy }) => {
    shapes.push({ type: "line", x1: x, y1: y, x2: x + dx, y2: y, lineWidth: 1.2, lineColor: gold });
    shapes.push({ type: "line", x1: x, y1: y, x2: x, y2: y + dy, lineWidth: 1.2, lineColor: gold });
  });

  const textRows = Array.from({ length: 28 }, (_, i) => ({
    text: `PROACTIVE STORE · SECURE · ${securityHash} · NOT FOR REPRODUCTION · `.repeat(4),
    fontSize: 5,
    color: gold,
    opacity: 0.042,
    absolutePosition: { x: 0, y: 18 + i * 30 },
    characterSpacing: 0.6
  }));

  return [{ canvas: shapes, opacity: 0.055, absolutePosition: { x: 0, y: 0 } }, ...textRows];
}

// Address as one readable block: street, city, governorate; the pin and any
// delivery notes are appended because they are part of what the courier needs.
function addressLines(address = {}) {
  const lines = [];
  if (address.street) lines.push(String(address.street));
  const cityGov = [address.city, address.governorate].filter(Boolean).join(", ");
  if (cityGov) lines.push(cityGov);
  if (address.building) lines.push(`Building: ${address.building}`);
  const pin =
    Number.isFinite(Number(address.lat)) && Number.isFinite(Number(address.lng))
      ? `Pin: ${Number(address.lat).toFixed(5)}, ${Number(address.lng).toFixed(5)}`
      : null;
  if (pin) lines.push(pin);
  if (address.notes) lines.push(`Notes: ${String(address.notes).slice(0, 200)}`);
  return lines;
}

const PAYMENT_LABELS = {
  cod: "Cash on delivery",
  card: "Card"
};

function paymentSettled(status) {
  return status === "delivered";
}

function statusLabel(status) {
  return String(status || "pending").toUpperCase();
}

// The doc definition. Pure data: everything the layout needs is passed in,
// which is also what the unit tests assert against (no PDF rendering).
export function buildInvoiceDoc({ order, orderId }) {
  const o = order ?? {};
  const orderNumber = o.orderNumber || "UNKNOWN";
  const invoiceNumber = orderNumber;
  const securityHash = securityHashFor(orderId);
  const createdAtMs = toMillis(o.createdAt) ?? Date.now();
  const creationDate = {
    shortEN: dateShortEN(createdAtMs),
    iso: new Date(createdAtMs).toISOString(),
    file: new Date(createdAtMs).toISOString().slice(0, 10)
  };

  const customer = o.customer ?? {};
  const address = o.address ?? {};
  const items = Array.isArray(o.items) ? o.items : [];
  const subtotal = Number(o.subtotal) || 0;
  const discount = Number(o.discount) || 0;
  const shipping = Number(o.shippingCost) || 0;
  const total = Number(o.total) || 0;
  const settled = paymentSettled(o.status);
  const statusColor = settled ? PDF.success : PDF.textDark;

  const T = (text, style = {}) => {
    const str = String(text ?? "");
    const arabic = hasArabic(str);
    return {
      text: str,
      font: arabic ? "Cairo" : "Roboto",
      alignment: arabic ? "right" : style.alignment || "left",
      ...style
    };
  };

  const addressBlock = addressLines(address);

  const doc = {
    pageSize: "A4",
    pageMargins: [44, 44, 44, 52],
    background: () => buildPdfBackground(securityHash),
    info: {
      title: `Invoice ${invoiceNumber}`,
      author: "ProActive Store",
      subject: "Tax Invoice",
      creator: "ProActive Store Secure System",
      creationDate: new Date(createdAtMs)
    },

    content: [
      {
        canvas: [{ type: "rect", x: 0, y: 0, w: 507, h: 4, r: 0, color: PDF.textDark }],
        margin: [0, 0, 0, 20]
      },

      {
        columns: [
          {
            columns: [
              { image: `data:image/png;base64,${LOGO_PNG_B64}`, width: 46, height: 46, margin: [0, 0, 10, 0] },
              {
                canvas: [{ type: "line", x1: 0, y1: 4, x2: 0, y2: 38, lineWidth: 0.8, lineColor: PDF.textDark }],
                width: 12,
                margin: [0, 6, 10, 0]
              },
              {
                stack: [
                  { text: "PROACTIVE STORE", fontSize: 16, bold: true, color: PDF.textDark },
                  { text: "FASHION", fontSize: 16, bold: true, color: PDF.textDark, margin: [0, -3, 0, 0] },
                  {
                    text: "DELIVERED ACROSS EGYPT",
                    fontSize: 5.5,
                    color: PDF.disabled,
                    characterSpacing: 2.2,
                    margin: [0, 4, 0, 0]
                  }
                ]
              }
            ],
            columnGap: 0,
            width: "*"
          },
          {
            stack: [
              { text: "TAX INVOICE", fontSize: 19, bold: true, color: PDF.textDark, alignment: "right", characterSpacing: 2 },
              { text: invoiceNumber, fontSize: 11, color: PDF.textDark, alignment: "right", margin: [0, 6, 0, 0] },
              { text: creationDate.shortEN, fontSize: 9, color: PDF.disabled, alignment: "right", margin: [0, 3, 0, 0] }
            ],
            width: "auto"
          }
        ],
        margin: [0, 0, 0, 16]
      },

      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.55, lineColor: PDF.line }
        ],
        margin: [0, 0, 0, 16]
      },

      {
        columns: [
          {
            stack: [
              {
                columns: [
                  { canvas: [{ type: "ellipse", x: 5, y: 5, r1: 4, r2: 4, color: statusColor }], width: 14 },
                  {
                    text: settled ? "PAYMENT CONFIRMED" : "PAYMENT PENDING",
                    fontSize: 8,
                    bold: true,
                    color: statusColor,
                    margin: [0, 2, 0, 0]
                  }
                ],
                columnGap: 4
              }
            ],
            width: "*"
          },
          {
            text: `Security Hash: ${securityHash}`,
            fontSize: 7,
            color: PDF.disabled,
            alignment: "right",
            margin: [0, 3, 0, 0]
          }
        ],
        margin: [0, 0, 0, 16]
      },

      {
        columns: [
          {
            stack: [
              { text: "BILLED TO", fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
              T(customer.name || "Guest", { fontSize: 13, bold: true, color: PDF.textDark }),
              customer.email ? { text: String(customer.email), fontSize: 9, color: PDF.textMuted, margin: [0, 4, 0, 0] } : {},
              customer.phone ? { text: String(customer.phone), fontSize: 9, color: PDF.textMuted, margin: [0, 2, 0, 0] } : {},
              ...addressBlock.map((line, i) =>
                T(line, { fontSize: 9, color: i === addressBlock.length - 1 && line.startsWith("Pin:") ? PDF.disabled : PDF.textMuted, margin: [0, 2, 0, 0] })
              )
            ],
            width: "*"
          },
          {
            stack: [
              { text: "ORDER DETAILS", fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
              {
                table: {
                  widths: [72, "*"],
                  body: [
                    [
                      { text: "Invoice #", fontSize: 9, color: PDF.disabled, border: [false, false, false, false], margin: [0, 0, 0, 4] },
                      { text: invoiceNumber, fontSize: 9, bold: true, border: [false, false, false, false], margin: [0, 0, 0, 4] }
                    ],
                    [
                      { text: "Order ID", fontSize: 9, color: PDF.disabled, border: [false, false, false, false], margin: [0, 0, 0, 4] },
                      { text: String(orderId), fontSize: 7.5, border: [false, false, false, false], margin: [0, 0, 0, 4] }
                    ],
                    [
                      { text: "Date", fontSize: 9, color: PDF.disabled, border: [false, false, false, false], margin: [0, 0, 0, 4] },
                      { text: creationDate.shortEN, fontSize: 9, border: [false, false, false, false], margin: [0, 0, 0, 4] }
                    ],
                    [
                      { text: "Payment", fontSize: 9, color: PDF.disabled, border: [false, false, false, false], margin: [0, 0, 0, 4] },
                      T(PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod ?? "N/A", {
                        fontSize: 9,
                        border: [false, false, false, false],
                        margin: [0, 0, 0, 4]
                      })
                    ],
                    [
                      { text: "Status", fontSize: 9, color: PDF.disabled, border: [false, false, false, false] },
                      { text: statusLabel(o.status), fontSize: 9, bold: true, color: statusColor, border: [false, false, false, false] }
                    ]
                  ]
                },
                layout: "noBorders"
              }
            ],
            width: 220
          }
        ],
        margin: [0, 0, 0, 22]
      },

      { text: "ITEMS", fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ["*", 36, 88, 88],
          body: [
            [
              { text: "DESCRIPTION", bold: true, fontSize: 8, color: PDF.card, border: [false, false, false, false], margin: [0, 2, 0, 2] },
              { text: "QTY", bold: true, fontSize: 8, color: PDF.card, alignment: "center", border: [false, false, false, false], margin: [0, 2, 0, 2] },
              { text: "UNIT PRICE", bold: true, fontSize: 8, color: PDF.card, alignment: "right", border: [false, false, false, false], margin: [0, 2, 0, 2] },
              { text: "AMOUNT", bold: true, fontSize: 8, color: PDF.card, alignment: "right", border: [false, false, false, false], margin: [0, 2, 0, 2] }
            ],
            ...items.map((item) => [
              {
                ...T(`${item.title ?? "Product"}${item.color || item.size ? ` · ${[item.color, item.size].filter(Boolean).join(" / ")}` : ""}`, {
                  fontSize: 10.5,
                  bold: true,
                  color: PDF.textDark,
                  border: [false, false, false, false],
                  margin: [0, 4, 0, 4]
                }),
                border: [false, false, false, false]
              },
              { text: String(item.qty || 1), fontSize: 10, alignment: "center", color: PDF.textMuted, border: [false, false, false, false], margin: [0, 4, 0, 4] },
              { text: formatPrice(item.unitPrice), fontSize: 10, alignment: "right", color: PDF.textMuted, border: [false, false, false, false], margin: [0, 4, 0, 4] },
              {
                text: formatPrice(Number(item.lineTotal ?? (Number(item.unitPrice) || 0) * (Number(item.qty) || 0))),
                fontSize: 10.5,
                alignment: "right",
                bold: true,
                color: PDF.textDark,
                border: [false, false, false, false],
                margin: [0, 4, 0, 4]
              }
            ])
          ]
        },
        layout: {
          fillColor: (row) => (row === 0 ? PDF.textDark : row % 2 === 0 ? PDF.stone : null),
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.4),
          vLineWidth: () => 0,
          hLineColor: () => PDF.line,
          paddingTop: () => 0,
          paddingBottom: () => 0,
          paddingLeft: () => 12,
          paddingRight: () => 12
        },
        margin: [0, 0, 0, 20]
      },

      {
        columns: [
          {
            stack: [
              { text: "PAYMENT NOTES", fontSize: 7, bold: true, color: PDF.textDark, characterSpacing: 2, margin: [0, 0, 0, 8] },
              { text: "Thank you for choosing ProActive Store.", fontSize: 9, color: PDF.textMuted, margin: [0, 0, 0, 4] },
              { text: "Every piece is quality-checked before it ships.", fontSize: 8.5, color: PDF.disabled, margin: [0, 0, 0, 3] },
              { text: `For questions, contact ${STORE_EMAIL}`, fontSize: 8.5, color: PDF.disabled, margin: [0, 0, 0, 3] },
              {
                columns: [
                  {
                    canvas: [
                      {
                        type: "ellipse",
                        x: 4,
                        y: 4,
                        r1: 3.5,
                        r2: 3.5,
                        color: settled ? PDF.success : PDF.textDark
                      }
                    ],
                    width: 12
                  },
                  {
                    text: settled ? "Payment received. No further action required." : "Cash on delivery - payment is due on receipt.",
                    fontSize: 8,
                    color: settled ? PDF.success : PDF.textDark,
                    margin: [0, 1, 0, 0]
                  }
                ],
                columnGap: 4,
                margin: [0, 8, 0, 0]
              }
            ],
            width: "*"
          },
          {
            width: 220,
            stack: [
              {
                columns: [
                  { text: "Subtotal", fontSize: 9.5, color: PDF.textMuted },
                  { text: formatPrice(subtotal), fontSize: 9.5, alignment: "right", color: PDF.textMuted }
                ],
                margin: [0, 0, 0, 6]
              },
              discount > 0
                ? {
                    columns: [
                      {
                        text: o.coupon?.code ? `Discount (${String(o.coupon.code).slice(0, 20)})` : "Discount",
                        fontSize: 9.5,
                        color: PDF.textMuted
                      },
                      { text: `−${formatPrice(discount)}`, fontSize: 9.5, alignment: "right", color: PDF.success, bold: true }
                    ],
                    margin: [0, 0, 0, 6]
                  }
                : {},
              {
                columns: [
                  { text: "Shipping", fontSize: 9.5, color: PDF.textMuted },
                  {
                    text: shipping === 0 ? "FREE" : formatPrice(shipping),
                    fontSize: 9.5,
                    alignment: "right",
                    color: shipping === 0 ? PDF.success : PDF.textMuted,
                    bold: shipping === 0
                  }
                ],
                margin: [0, 0, 0, 6]
              },
              {
                canvas: [
                  { type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: PDF.line }
                ],
                margin: [0, 4, 0, 10]
              },
              {
                columns: [
                  { text: "TOTAL DUE", fontSize: 9, bold: true, color: PDF.textDark, characterSpacing: 1.5 },
                  { text: formatPrice(total), fontSize: 15, alignment: "right", color: PDF.textDark, bold: true }
                ],
                margin: [0, 0, 0, 0]
              },
              {
                canvas: [
                  { type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 2, lineColor: PDF.textDark }
                ],
                margin: [0, 8, 0, 0]
              }
            ]
          }
        ],
        margin: [0, 0, 0, 24]
      },

      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.5, lineColor: PDF.line }
        ],
        margin: [0, 0, 0, 12]
      },

      {
        columns: [
          {
            stack: [
              { text: "ProActive Store · Fashion", fontSize: 8, color: PDF.disabled },
              { text: STORE_EMAIL, fontSize: 7.5, color: PDF.disabled, margin: [0, 2, 0, 0] },
              o.source ? { text: `Source: ${String(o.source).slice(0, 20)}`, fontSize: 7, color: PDF.disabled, margin: [0, 2, 0, 0] } : {}
            ]
          },
          {
            stack: [
              { text: `Hash: ${securityHash}`, fontSize: 7, color: PDF.disabled, alignment: "right" },
              {
                text: `${creationDate.iso.slice(0, 19).replace("T", " ")} UTC`,
                fontSize: 6.5,
                color: PDF.disabled,
                alignment: "right",
                margin: [0, 2, 0, 0]
              },
              {
                text: "Computer-generated · No signature required",
                fontSize: 6.5,
                color: "#ccc",
                italics: true,
                alignment: "right",
                margin: [0, 2, 0, 0]
              }
            ]
          }
        ]
      }
    ],

    defaultStyle: { font: "Roboto", fontSize: 10.5, color: PDF.textDark, lineHeight: 1.3 }
  };

  return {
    doc,
    meta: {
      invoiceNumber,
      orderNumber,
      securityHash,
      createdAtMs,
      createdAtIso: creationDate.iso
    }
  };
}

let fontsReady = false;

// Roboto comes from pdfmake's bundled vfs (its standard font container is not
// reliably registered under every runner), Cairo from the committed asset.
// Both are base64 maps keyed by file name, which is what the virtual file
// system expects.
function ensureFonts() {
  if (fontsReady) return;
  pdfMake.addVirtualFileSystem({ ...pdfFonts, "Cairo-Regular.ttf": CAIRO_TTF_B64 });
  pdfMake.fonts = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf"
    },
    Cairo: {
      normal: "Cairo-Regular.ttf",
      bold: "Cairo-Regular.ttf",
      italics: "Cairo-Regular.ttf",
      bolditalics: "Cairo-Regular.ttf"
    }
  };
  fontsReady = true;
}

// Renders the invoice to bytes. Node-only (getBuffer); the browser copy uses
// .download() instead. getBuffer resolves to a Uint8Array under some module
// runners and a Buffer under node, so it is normalised here - callers (and
// the sha256 over the bytes) always get the same thing.
export async function renderInvoice({ order, orderId }) {
  ensureFonts();
  const { doc, meta } = buildInvoiceDoc({ order, orderId });
  const raw = await pdfMake.createPdf(doc).getBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return { buffer, ...meta };
}
