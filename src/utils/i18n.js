// Bilingual field resolution.
//
// Every user-facing field on a product, category or collection is stored as
// {ar, en}. The UI must never read `product.title` directly - it reads a
// string, not the object, and renders "[object Object]".

export function loc(field, lang = "en") {
  if (field === null || field === undefined) return "";
  if (typeof field === "string" || typeof field === "number") return String(field);
  if (Array.isArray(field)) return field.map((f) => loc(f, lang)).filter(Boolean).join(", ");

  if (typeof field === "object") {
    const preferred = field[lang];
    if (preferred !== undefined && preferred !== null && preferred !== "") return String(preferred);
    const fallback = lang === "ar" ? field.en : field.ar;
    if (fallback !== undefined && fallback !== null && fallback !== "") return String(fallback);
    return "";
  }

  return "";
}

// Orders and products may predate the bilingual migration and still hold a
// plain string. loc() handles that, but this makes the intent explicit at the
// call site where legacy documents are read.
export function isLocalized(field) {
  return Boolean(field && typeof field === "object" && !Array.isArray(field) && ("ar" in field || "en" in field));
}