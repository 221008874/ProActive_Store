// Coupon rejection copy.
//
// /api/coupon/preview answers with a `reason` code rather than a sentence, so
// the UI owns the wording in both languages. These are the reasons the server
// can return; an unmapped one falls back to the generic line rather than
// showing a raw code.

export const COUPON_REJECTIONS = {
  UNKNOWN: { en: 'That coupon does not exist.', ar: 'كود الخصم غير موجود' },
  INACTIVE: { en: 'That coupon is switched off.', ar: 'كود الخصم غير مفعل' },
  EXPIRED: { en: 'That coupon has expired.', ar: 'انتهت صلاحية كود الخصم' },
  EXHAUSTED: { en: 'That coupon has been fully used.', ar: 'تم استخدام كود الخصم بالكامل' },
  MIN_ORDER: { en: 'Your bag is below this coupon\u2019s minimum.', ar: 'إجمالي السلة أقل من الحد الأدنى لهذا الكود' },
  INVALID: { en: 'That coupon is not valid.', ar: 'كود الخصم غير صالح' }
}

/** The message for a reason code, in the requested language. */
export function couponRejectionMessage(reason, lang = 'en', fallback) {
  const entry = COUPON_REJECTIONS[reason]
  if (!entry) return fallback
  return lang === 'ar' ? entry.ar : entry.en
}
