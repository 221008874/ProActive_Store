// Delivery — step 2 of checkout.
//
// The address, then the pin. Validation is per-field and runs on submit, so a
// shopper is not told about an error while they are still typing it. The phone
// number follows the Egyptian mobile format exactly, because a courier who
// cannot reach the shopper is a failed delivery.

import { useLanguage } from '../../context/LanguageContext'
import { Button, Checkbox, Field, Select, formatEGP } from '../../ui'
import LocationPicker from '../../components/LocationPicker'
import { validateDeliveryForm } from '../../utils/validation'

const label = (t, lang) => (key, en, ar) => {
  if (key) {
    const v = t(key)
    if (v && v !== key) return v
  }
  return lang === 'ar' ? ar : en
}

export default function DeliveryStep({ checkout }) {
  const { t, lang } = useLanguage()
  const L = label(t, lang)

  const {
    address, setField, chooseGovernorate, governorateDocs, loadingGovernorates,
    shipping, setStep, formErrors, setFormErrors, showMap
  } = checkout

  // Only governorates the owner marked active, named in the shopper's language.
  const governorates = Object.entries(governorateDocs)
    .filter(([, g]) => g.active !== false)
    .map(([id, g]) => ({
      id,
      name: g.name ? (g.name[lang] ?? g.name.en ?? id) : id,
      cost: Number(g.cost ?? 0)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const submit = (e) => {
    e.preventDefault()
    const { errors, isValid } = validateDeliveryForm(address, { t })
    setFormErrors(errors)
    if (isValid) setStep(3)
  }

  return (
    <form className="pa-checkout" onSubmit={submit} noValidate>
      <div className="pa-checkout__section">
        <Field
          id="d-name"
          label={L('fullName', 'Full name', 'الاسم بالكامل')}
          value={address.name}
          onChange={(e) => setField('name', e.target.value)}
          error={formErrors.name}
          autoComplete="name"
          required
        />
        <Field
          id="d-phone"
          label={L('mobile', 'Mobile number', 'رقم الموبايل')}
          value={address.phone}
          onChange={(e) => setField('phone', e.target.value)}
          error={formErrors.phone}
          hint={L('mobileHint', 'Egyptian number, e.g. 01012345678', 'رقم مصري، مثل 01012345678')}
          inputMode="tel"
          className="pa-input--phone"
          autoComplete="tel"
          required
        />
        <Field
          id="d-email"
          label={`${L('email', 'Email', 'البريد الإلكتروني')} (${L('optional', 'optional', 'اختياري')})`}
          type="email"
          value={address.email}
          onChange={(e) => setField('email', e.target.value)}
          error={formErrors.email}
          autoComplete="email"
        />
      </div>

      <div className="pa-checkout__section">
        <div className="pa-checkout__row">
          <Select
            id="d-gov"
            label={L('governorate', 'Governorate', 'المحافظة')}
            value={address.governorate}
            onChange={(e) => chooseGovernorate(e.target.value)}
            error={formErrors.governorate}
            disabled={loadingGovernorates}
            required
          >
            <option value="">{L('chooseGovernorate', 'Choose a governorate', 'اختار محافظة')}</option>
            {governorates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.cost > 0 ? ` — ${formatEGP(g.cost, lang)}` : ` — ${L('free', 'free', 'مجاني')}`}
              </option>
            ))}
          </Select>
          <Field
            id="d-city"
            label={L('cityArea', 'City / area', 'المدينة / المنطقة')}
            value={address.city}
            onChange={(e) => setField('city', e.target.value)}
            error={formErrors.city}
            autoComplete="address-level2"
          />
        </div>
        <Field
          id="d-street"
          label={L('street', 'Street', 'الشارع')}
          value={address.address}
          onChange={(e) => setField('address', e.target.value)}
          error={formErrors.address}
          autoComplete="address-line1"
          required
        />
        <div className="pa-checkout__row">
          <Field
            id="d-building"
            label={L('building', 'Building / floor', 'العمارة / الدور')}
            value={address.building}
            onChange={(e) => setField('building', e.target.value)}
            error={formErrors.building}
            autoComplete="address-line2"
          />
          <Field
            id="d-notes"
            label={L('notes', 'Notes for the courier', 'ملاحظات للمندوب')}
            value={address.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>
      </div>

      {shipping?.available && (
        <div className="pa-callout" style={{ margin: '0 var(--pa-gutter)' }}>
          {L('shippingTo', 'Shipping to', 'الشحن إلى')}{' '}
          <b>{governorates.find((g) => g.id === address.governorate)?.name}</b>:{' '}
          <bdi>{formatEGP(shipping.cost, lang)}</bdi>
        </div>
      )}

      {/* The map is only worth showing once there is a governorate to deliver
          inside; before that the pin means nothing. */}
      {showMap && (
        <div className="pa-checkout__section">
          <div className="pa-group-title">{L('pinLocation', 'Pin your door', 'حدد مكان بابك')}</div>
          <LocationPicker
            value={address.latitude && address.longitude ? { lat: address.latitude, lng: address.longitude } : null}
            onChange={({ lat, lng }) => { setField('latitude', lat); setField('longitude', lng) }}
            labels={{
              search: L('search', 'Search', 'بحث'),
              searchPlaceholder: L('searchArea', 'Area, street, or landmark', 'منطقة، شارع، أو معلم'),
              searchButton: L('search', 'Search', 'بحث'),
              searching: L('searching', 'Searching…', 'جاري البحث…'),
              noResults: L('noPlaces', 'No places matched', 'مفيش أماكن مطابقة'),
              searchFailed: L('searchFailed', 'Search failed. Try again.', 'البحث فشل. جرب تاني.'),
              dragHint: L('dragPin', 'Drag the pin to your door', 'اسحب الدبوس لبابك'),
              useMyLocation: L('useMyLocation', 'Use my location', 'استخدم موقعي'),
              locationDenied: L('locationDenied', 'Location unavailable. Search or drag the pin instead.', 'الموقع مش متاح. دور أو اسحب الدبوس.'),
              loading: L('findingYou', 'Finding you…', 'جاري تحديد موقعك…')
            }}
          />
        </div>
      )}

      <div className="pa-checkout__foot">
        <Button type="button" variant="outline" onClick={() => setStep(1)}>{L('back', 'Back', 'رجوع')}</Button>
        <Button type="submit" size="lg" block>{L('continue', 'Continue', 'كمل')}</Button>
      </div>
    </form>
  )
}
