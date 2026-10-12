// Delivery form validation. Pure: takes the form values and returns the errors
// map, so the rules can be tested without mounting the checkout page.
//
// These rules mirror what /api/placeOrder enforces, so a form that passes here
// is a form the server accepts. The two that matter most:
//
//   - the phone must be an Egyptian mobile number. The server rejects anything
//     else with BAD_CUSTOMER, and a courier who cannot reach the shopper is a
//     failed delivery.
//   - email is optional. The order model stores null rather than a fake
//     address, so an empty field is not an error and a malformed one is.
//
// Vodafone (010), Etisalat (011), Orange (012), WE (015) and the four-digit
// 015x ranges the regulator has since opened.
const PHONE_REGEX = /^01[0125]\d{8}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_ADDRESS_LENGTH = 10

// Arabic-Indic → Western digits, so shoppers typing on an Arabic keyboard are
// never rejected with a cryptic "invalid phone". Kept here so both client and
// server (orderCore.js) share the same folding.
const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
function foldArabicIndic(s) {
  return String(s).replace(/[٠-٩]/g, (ch) => ARABIC_INDIC.indexOf(ch))
}

export function validateDeliveryForm(formData, { t }) {
  const errors = {}
  const rawPhone = String(formData.phone ?? '').replace(/[\s-]/g, '')
  const phone = foldArabicIndic(rawPhone)

  if (!String(formData.name ?? '').trim()) {
    errors.name = t('nameRequired')
  }

  if (!phone || !PHONE_REGEX.test(phone)) {
    errors.phone = t('validPhoneRequired') || 'Enter an Egyptian mobile starting with 010/011/012/015 (11 digits)'
  }

  const email = String(formData.email ?? '').trim()
  if (email && !EMAIL_REGEX.test(email)) {
    errors.email = t('validEmailRequired') || 'Valid email required'
  }

  const address = String(formData.address ?? '').trim()
  if (!address || address.length < MIN_ADDRESS_LENGTH) {
    errors.address = t('addressTooShort') || 'Address must be at least 10 characters'
  }

  // Governorate is required - it prices every delivery.
  if (!formData.governorate) {
    errors.governorate = t('selectGovernorate') || 'Please select your governorate'
  }

  // A pin is optional: a typed street address is a deliverable order, and the
  // map is an aid rather than a requirement.
  return { errors, isValid: Object.keys(errors).length === 0 }
}

export { foldArabicIndic }