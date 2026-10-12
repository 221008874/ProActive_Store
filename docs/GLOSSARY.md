# ProActive Fashion — Egyptian Arabic UX Glossary

**Source of truth for all user-facing strings.** Every `t('key')` / `L('key', 'EN', 'AR')` in the codebase must resolve to a value listed here. If a string is not here, it does not exist.

---

## 1. Digit & number style

| Context | Rule | Example |
|---|---|---|
| Prices, quantities, phone numbers, order numbers, coupon codes, PINs | **Western digits (0–9) only** | `1,299 ج.م` · `01012345678` · `#ORD-2026-0042` |
| Static Arabic body copy | Western digits (consistent with prices) | `٣` never appears in rendered UI |

**Rationale:** Mixed digit styles break visual rhythm and confuse screen readers. The server and client both fold Arabic-Indic (`٠-٩`) to Western on input so the stored value is always Western.

---

## 2. Currency label

| Language | Label | Placement |
|---|---|---|
| Arabic | `ج.م` | suffixed, narrow no-break space: `1,299 ج.م` |
| English | `EGP` | suffixed, narrow no-break space: `EGP 1,299` |

**Implementation:** `formatEGP(amount, lang)` in `src/ui/format.js` is the **single source**. Never concatenate `"EGP"` / `"ج.م"` manually.

---

## 3. Core nouns (Egyptian Arabic)

| English key | Arabic value | Notes |
|---|---|---|
| Bag / Cart | الشنطة | Used in header, tab bar, drawer, toasts, PDP |
| Product | منتج | Category/page titles |
| Collection | تشكيلة | Not "قسم" (that's a category) |
| Category | قسم | Admin/filters only |
| Order | طلب | Customer-facing |
| Order (admin) | طلب | Same word, context disambiguates |
| Checkout | إتمام الطلب | Not "دفع" (COD is payment on delivery) |
| Coupon / Code | كود | Short, familiar |
| Discount | خصم | |
| Size | مقاس | |
| Colour / Color | لون | |
| Variant | تركيبة | Colour + size combo |
| Stock | مخزون | |
| Sold out | نفذت | Badge text |
| Delivery / Shipping | شحن | |
| Governorate | محافظة | |
| City / Area | مدينة / منطقة | |
| Street / Address | العنوان / الشارع | |
| Building / Floor | العمارة / الدور | |
| Notes for courier | ملاحظات للمندوب | |
| Map pin | حدد مكان بابك | Optional helper, not required |
| WhatsApp | واتساب | |
| Call | اتصل | |
| Search | بحث | |
| Filter | تصفية | |
| Sort | ترتيب | |
| Newest | الأحدث | |
| Best selling | الأكثر مبيعاً | |
| Price: low to high | السعر: من الأقل للأعلى | |
| Price: high to low | السعر: من الأعلى للأقل | |
| Sale | تخفيضات | |
| New arrivals | جديدنا | |
| Saved / Wishlist | المحفوظات | Heart icon |
| Account | حسابي | |
| Orders | طلباتي | |
| Settings | الإعدادات | |
| Language | اللغة | |
| Theme / Appearance | المظهر | |
| Log out | خروج | |
| Log in / Sign in | دخول | |
| Guest checkout | متابعة كضيف | No accounts |
| Cash on delivery | دفع عند الاستلام | |
| Amount to pay | المبلغ المطلوب | Big text on review |
| Subtotal | المجموع الفرعي | |
| Shipping | الشحن | |
| Discount | الخصم | |
| Total | الإجمالي | |
| Continue | كمل | Primary CTA |
| Back | رجوع | |
| Save / Apply | تطبيق | |
| Cancel | إلغاء | |
| Delete | حذف | |
| Archive | أرشفة | |
| Edit | تعديل | |
| Duplicate | نسخ | |
| Publish | نشر | |
| Unpublish | إلغاء النشر | |
| Pending | في الانتظار | Order status |
| Confirmed | تم التأكيد | |
| Shipped | تم الشحن | |
| Delivered | تم التوصيل | |
| Cancelled | ملغي | |
| Refunded | مسترد | |
| Pending (coupon) | قيد الانتظار | Coupon status |
| Active | مفعل | |
| Expired | منتهي | |
| Exhausted | مستهلك | |

---

## 4. Verbs / Actions (Egyptian Arabic)

| English | Arabic |
|---|---|
| Add to bag | أضف للشنطة |
| Remove from bag | احذف من الشنطة |
| Update quantity | غيّر الكمية |
| Apply coupon | طبق الكوبون |
| Remove coupon | احذف الكوبون |
| Continue shopping | كمل تسوق |
| Go to bag / Go to cart | روح للعربة |
| Proceed to checkout | كمل لإتمام الطلب |
| Place order | اطلب دلوقتي |
| Call | اتصل |
| Message on WhatsApp | راسلنا على واتساب |
| Ask about size | اسأل على المقاس |
| Save address | احفظ العنوان |
| Use my saved address | استخدم عنواني المحفوظ |
| Pin location | حدد مكان بابك |
| Search | ابحث |
| Filter | صفّي |
| Sort | رتب |
| Clear all filters | امسح كل الفلاتر |
| Apply filters | طبق الفلاتر |
| Reset | إعادة تعيين |
| Confirm | تأكيد |
| Cancel order | إلغاء الطلب |
| Track order | تتبع الطلب |
| Reorder | إعادة طلب |
| Download receipt | تحميل الإيصال |
| Share order | مشاركة الطلب |

---

## 5. Form validation messages (Egyptian Arabic)

| Key | Arabic |
|---|---|
| nameRequired | الاسم بالكامل مطلوب |
| validPhoneRequired | أدخل رقم مصري يبدأ بـ 010/011/012/015 (١١ رقم) |
| validEmailRequired | يرجى إدخال إيميل صحيح |
| addressTooShort | العنوان لازم يكون ١٠ حروف على الأقل |
| selectGovernorate | اختار محافظتك |
| addressRequired | العنوان التفصيلي مطلوب |
| minimumOrderNotMet | الحد الأدنى للطلب كذا ج.م |
| couponExpired | الكوبون ده منتهي |
| couponExhausted | الكوبون ده خلص استخداماته |
| couponMinOrder | الكوبون ده محتاج طلب أكبر |
| couponInvalid | كود الكوبون غير صحيح |
| outOfStock | نفذت الكمية |
| onlyAvailable | متاح كذا بس |
| cartEmpty | عربيتك فاضية |
| ordersClosed | الطلبات مقفولة دلوقتي |
| rateLimited | طلبات كتير، جرب بعد شوية |
| captchaFailed | التحقق فشل، جرب تاني |

---

## 6. Status / state copy (Egyptian Arabic)

| Key | Arabic |
|---|---|
| loading | جاري التحميل… |
| saving | جاري الحفظ… |
| publishing | جاري النشر… |
| published | تم النشر |
| draft | مسودة |
| publishedLive | منشور |
| unpublished | غير منشور |
| noResults | مفيش نتائج |
| noProducts | مفيش منتجات |
| noOrders | مفيش طلبات |
| noCoupons | مفيش أكواد |
| emptyBag | عربيتك فاضية |
| emptySaved | مفيش منتجات محفوظة |
| offline | أنت أوفلين — البيانات قديمة |
| retry | جرب تاني |
| fixFormErrors | صلح الأخطاء دي: |
| fixFields | أصلح {count} حقل عشان تكمل |

---

## 7. Prohibited patterns (do not use)

| Pattern | Why | Use instead |
|---|---|---|
| Emoji in user-facing strings (❌ ✅ ⚠️ 🎉 ✕ 🛍️ 🛒 💡 🏠) | Not professional; screen readers announce them literally | Words + design system status colours |
| Mixed digit styles (Western in prices, Arabic-Indic in body) | Breaks rhythm, confuses SR | Western everywhere |
| `carta` / `السلة` / `العربة` for bag | Inconsistent | `الشنطة` only |
| `دفع` for checkout | Implies payment now (COD is on delivery) | `إتمام الطلب` |
| Mixed currency labels (`EGP` in AR, `ج.م` in EN) | Confusing | `formatEGP(amount, lang)` only |
| `L('key', 'EN', 'AR')` inline for new strings | Not translatable centrally | Add to `strings.js` first |
| Arabic-Indic digits in rendered copy (`١٢٣`) | Inconsistent with prices | Western `123` only |

---

## 8. How to add a new string

1. Open `src/i18n/strings.js`
2. Add the key in **both** `ar` and `en` blocks, grouped by feature
3. Use the Arabic/English values from this glossary
4. Use `t('key')` or `L('key', 'EN', 'AR')` in components
5. Run `npm test` — the i18n test will fail if a key is missing from either language

---

## 9. Currency formatting reference

```js
import { formatEGP } from '../ui/format'

// Correct
formatEGP(1299, 'ar')  // "1,299 ج.م"
formatEGP(1299, 'en')  // "EGP 1,299"

// Wrong
"EGP " + amount
amount + " ج.م"
amount.toLocaleString() + " EGP"
```

---

## 9. Version

| Date | Change |
|---|---|
| 2026-10-12 | Initial glossary extracted from audit; digit style, currency, core nouns, verbs, validation, prohibited patterns |