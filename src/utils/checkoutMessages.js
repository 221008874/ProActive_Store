// Checkout rejection copy.
//
// /api/placeOrder answers with a code rather than a sentence, so the UI owns
// the wording. classifyCheckoutError (utils/checkoutErrors.js) produces the
// keys; this says what each one means in two languages. Kept apart from the
// classifier so the taxonomy and the prose can be edited independently, and so
// a component can re-export nothing.

export const CHECKOUT_REJECTION_COPY = {
  outOfStock: { en: 'One of these just sold out. Choose another size.', ar: 'واحد من دول خلص. اختار مقاس تاني.' },
  unavailable: { en: 'One of these is no longer available.', ar: 'واحد من دول مش متاح.' },
  couponInvalid: { en: 'That coupon is no longer valid.', ar: 'كود الخصم ده مش صالح.' },
  belowMinimum: { en: 'Your order is below the minimum for this governorate.', ar: 'الطلب أقل من الحد الأدنى للمحافظة دي.' },
  governorateUnavailable: { en: 'We do not deliver there yet.', ar: 'بنوصل للمحافظة دي لسه.' },
  rateLimited: { en: 'Too many orders from this number recently. Try again later.', ar: 'طلبات كتير من الرقم ده مؤخراً. جرب بعدين.' },
  blocked: { en: 'This number cannot place orders.', ar: 'الرقم ده مش بيقدر يطلب.' },
  ordersClosed: { en: 'The store is not taking orders right now.', ar: 'المتجر مش بياخد طلبات دلوقتي.' },
  badCustomer: { en: 'Check the name and phone number.', ar: 'راجع الاسم ورقم الموبايل.' },
  badAddress: { en: 'Check the delivery address.', ar: 'راجع عنوان التوصيل.' },
  badQuantity: { en: 'Check the quantities.', ar: 'راجع الكميات.' },
  cartEmpty: { en: 'Your bag is empty.', ar: 'العربية فاضية' },
  captchaRequired: { en: 'Please confirm you are not a robot.', ar: 'من فضلك أكّد إنك مش روبوت.' },
  captchaFailed: { en: 'That check did not pass. Try again.', ar: 'التحقق ده فشل. جرب تاني.' },
  internal: { en: 'Something went wrong on our side. Nothing was charged.', ar: 'حدث خطأ من جهتنا. مفيش حاجة اتخصمت.' },
  generic: { en: 'Something went wrong. Try again.', ar: 'حدث خطأ. جرب تاني.' }
}

/** The message for a rejection key, in the requested language. */
export function checkoutRejectionMessage(key, lang = 'en') {
  const entry = CHECKOUT_REJECTION_COPY[key] ?? CHECKOUT_REJECTION_COPY.generic
  return lang === 'ar' ? entry.ar : entry.en
}
