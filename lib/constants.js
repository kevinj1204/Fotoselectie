// Gedeelde constanten (client + server)

// Alfabetisch, Dutch Caribbean altijd als laatste.
export const PROVINCES = [
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland',
  'Dutch Caribbean',
];

export const CATEGORIES = ['Teen', 'Miss'];

export const CATEGORY_LABELS = {
  Teen: 'Teen (jonger dan 18 jaar)',
  Miss: 'Miss (18 jaar en ouder)',
};

export const PHOTO_PREFIX = 'TLP';
export const PHOTO_MAX_DIGITS = 6;
export const MAX_EXTRA_PHOTOS = 50;
export const DEFAULT_EXTRA_PRICE = 15;

// Huisstijl: pas hier naam/teksten aan. Kleuren staan in app/globals.css (:root).
export const BRAND = {
  name: 'Miss Nederland',
  appTitle: 'Fotoselectie',
  organiser: 'de organisatie van Miss Nederland',
};
