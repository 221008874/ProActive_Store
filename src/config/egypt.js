// Static Egyptian governorate reference data.
// Kept in one place so the checkout form, shipping calculation and admin
// dashboard all agree on the same ids and display names.

export const EGYPT_GOVERNORATES = [
  { id: 'cairo', name: 'Cairo', nameAr: 'القاهرة' },
  { id: 'giza', name: 'Giza', nameAr: 'الجيزة' },
  { id: 'alexandria', name: 'Alexandria', nameAr: 'الإسكندرية' },
  { id: 'qalyubia', name: 'Qalyubia', nameAr: 'القليوبية' },
  { id: 'monufia', name: 'Monufia', nameAr: 'المنوفية' },
  { id: 'gharbia', name: 'Gharbia', nameAr: 'الغربية' },
  { id: 'dakahlia', name: 'Dakahlia', nameAr: 'الدقهلية' },
  { id: 'sharkia', name: 'Sharqia', nameAr: 'الشرقية' },
  { id: 'beheira', name: 'Beheira', nameAr: 'البحيرة' },
  { id: 'kafr_sheikh', name: 'Kafr El Sheikh', nameAr: 'كفر الشيخ' },
  { id: 'damietta', name: 'Damietta', nameAr: 'دمياط' },
  { id: 'port_said', name: 'Port Said', nameAr: 'بورسعيد' },
  { id: 'ismailia', name: 'Ismailia', nameAr: 'الإسماعيلية' },
  { id: 'suez', name: 'Suez', nameAr: 'السويس' },
  { id: 'matrouh', name: 'Matrouh', nameAr: 'مطروح' },
  { id: 'north_sinai', name: 'North Sinai', nameAr: 'شمال سيناء' },
  { id: 'south_sinai', name: 'South Sinai', nameAr: 'جنوب سيناء' },
  { id: 'faiyum', name: 'Faiyum', nameAr: 'الفيوم' },
  { id: 'beni_suef', name: 'Beni Suef', nameAr: 'بني سويف' },
  { id: 'minya', name: 'Minya', nameAr: 'المنيا' },
  { id: 'asyut', name: 'Asyut', nameAr: 'أسيوط' },
  { id: 'sohag', name: 'Sohag', nameAr: 'سوهاج' },
  { id: 'qena', name: 'Qena', nameAr: 'قنا' },
  { id: 'luxor', name: 'Luxor', nameAr: 'الأقصر' },
  { id: 'aswan', name: 'Aswan', nameAr: 'أسوان' },
  { id: 'red_sea', name: 'Red Sea', nameAr: 'البحر الأحمر' },
  { id: 'new_valley', name: 'New Valley', nameAr: 'الوادي الجديد' }
]

export const GOVERNORATE_FALLBACK_COST = 50

const GOVERNORATES_BY_ID = new Map(EGYPT_GOVERNORATES.map((gov) => [gov.id, gov]))

export function getGovernorate(id) {
  return GOVERNORATES_BY_ID.get(id)
}

export function isGovernorateId(id) {
  return GOVERNORATES_BY_ID.has(id)
}

// Accepts either 'ar' or 'en'. Falls back to the raw id when the governorate
// is unknown, so an unexpected id still renders instead of going blank.
export function resolveGovernorateName(id, lang = 'en') {
  const governorate = GOVERNORATES_BY_ID.get(id)
  if (!governorate) return id
  return lang === 'ar' ? governorate.nameAr : governorate.name
}

// Used when the Firestore read of egp_governorate_costs fails, so checkout can
// still price a delivery instead of blocking on a network error.
export function defaultGovernorateCosts() {
  const costs = {}
  for (const governorate of EGYPT_GOVERNORATES) {
    costs[governorate.id] = GOVERNORATE_FALLBACK_COST
  }
  return costs
}