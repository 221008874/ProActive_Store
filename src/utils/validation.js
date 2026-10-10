// Delivery form validation. Pure: takes the form values and returns the errors
// map, so the rules can be tested without mounting the checkout page.

const PHONE_REGEX = /^\+?[\d\s\-()]{10,}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_ADDRESS_LENGTH = 10

export function validateDeliveryForm(formData, { t }) {
  const errors = {}

  if (!formData.name.trim()) {
    errors.name = t('nameRequired')
  }

  if (!formData.phone.trim() || !PHONE_REGEX.test(formData.phone)) {
    errors.phone = t('validPhoneRequired')
  }

  if (!formData.email?.trim() || !EMAIL_REGEX.test(formData.email)) {
    errors.email = t('validEmailRequired') || 'Valid email required'
  }

  if (!formData.address.trim() || formData.address.trim().length < MIN_ADDRESS_LENGTH) {
    errors.address = t('addressTooShort') || 'Address must be at least 10 characters'
  }

// Governorate is required - it prices every delivery.
    if (!formData.governorate) {
    errors.governorate = t('selectGovernorate') || 'Please select your governorate'
  }

  if (!formData.latitude || !formData.longitude) {
    errors.location = t('locationRequired')
  }

  return { errors, isValid: Object.keys(errors).length === 0 }
}