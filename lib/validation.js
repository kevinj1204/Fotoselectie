// Validatie die zowel in de browser als op de server wordt gebruikt.
import { PROVINCES, CATEGORIES, PHOTO_PREFIX, PHOTO_MAX_DIGITS, MAX_EXTRA_PHOTOS } from './constants';

/** Houdt alleen cijfers over (spaties, letters, TLP-prefix etc. verdwijnen). Voorloopnullen blijven staan. */
export function digitsOnly(value) {
  let s = String(value ?? '').toUpperCase().replace(/\s+/g, '');
  if (s.startsWith(PHOTO_PREFIX)) s = s.slice(PHOTO_PREFIX.length);
  return s.replace(/[^0-9]/g, '').slice(0, PHOTO_MAX_DIGITS);
}

/** Volledige code, bv. "024" -> "TLP024". Lege invoer -> "". */
export function toPhotoCode(digits) {
  const d = digitsOnly(digits);
  return d ? PHOTO_PREFIX + d : '';
}

export function isValidPhotoCode(code) {
  return new RegExp(`^${PHOTO_PREFIX}[0-9]{1,${PHOTO_MAX_DIGITS}}$`).test(String(code || ''));
}

export function cleanText(v, max = 100) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanParticipantNumber(v) {
  // Optioneel (alleen door beheer in te vullen). Tekst; voorloopnullen blijven behouden.
  return String(v ?? '').replace(/\s+/g, '').replace(/[^0-9A-Za-z\-\/]/g, '').slice(0, 20);
}

/**
 * Valideert een inzending. Geeft { values, errors } terug.
 * errors is een object veld -> foutmelding (Nederlands). extra-fouten: errors.extra[index].
 */
export function validateSubmission(input) {
  const errors = {};
  const values = {
    participant_number: cleanParticipantNumber(input.participant_number),
    first_name: cleanText(input.first_name, 80),
    last_name: cleanText(input.last_name, 80),
    category: CATEGORIES.includes(input.category) ? input.category : '',
    province: PROVINCES.includes(input.province) ? input.province : '',
    photo_code: toPhotoCode(input.photo_code),
    extra_photo_codes: Array.isArray(input.extra_photo_codes)
      ? input.extra_photo_codes.map(toPhotoCode)
      : [],
  };

  if (!values.first_name) errors.first_name = 'Vul je voornaam in.';
  if (!values.last_name) errors.last_name = 'Vul je achternaam in.';
  if (!values.category) errors.category = 'Kies Teen of Miss.';
  if (!values.province) errors.province = 'Kies je provincie of regio.';
  if (!values.photo_code) errors.photo_code = 'Vul de cijfers van je gekozen foto in.';
  else if (!isValidPhotoCode(values.photo_code)) errors.photo_code = 'Dit fotonummer is ongeldig.';

  if (values.extra_photo_codes.length > MAX_EXTRA_PHOTOS) {
    errors.extra_general = `Je kunt maximaal ${MAX_EXTRA_PHOTOS} extra foto's toevoegen.`;
  }
  const extraErrors = [];
  const seen = new Set(values.photo_code ? [values.photo_code] : []);
  values.extra_photo_codes.forEach((code, i) => {
    if (!code) extraErrors[i] = "Vul een fotonummer in of verwijder dit extra veld.";
    else if (!isValidPhotoCode(code)) extraErrors[i] = 'Dit fotonummer is ongeldig.';
    else if (code === values.photo_code) extraErrors[i] = `${code} is al je hoofdkeuze. Kies een andere foto.`;
    else if (seen.has(code)) extraErrors[i] = `${code} heb je al toegevoegd.`;
    if (code) seen.add(code);
  });
  if (extraErrors.some(Boolean)) errors.extra = extraErrors;

  return { values, errors };
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function isValidHttpsUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && !!u.hostname && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function formatEuro(amount) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0);
}

/** Kort bedrag: € 15 of € 12,50 */
export function formatEuroShort(amount) {
  const n = Number(amount) || 0;
  return Number.isInteger(n) ? `€ ${n}` : formatEuro(n);
}
