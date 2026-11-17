// Tijdhulpjes. Deadlines worden ingevoerd en getoond in Nederlandse tijd (Europe/Amsterdam).
export const TZ = 'Europe/Amsterdam';
export const TZ_CARIBBEAN = 'America/Curacao';

function tzOffsetMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - date.getTime()) / 60000;
}

/** "2026-12-01T18:00" (Nederlandse tijd) -> Date (UTC) */
export function amsterdamLocalToDate(local) {
  if (!local) return null;
  const m = String(local).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = new Date(naive - tzOffsetMinutes(new Date(naive), TZ) * 60000);
  guess = new Date(naive - tzOffsetMinutes(guess, TZ) * 60000);
  return guess;
}

/** Date/ISO -> "2026-12-01T18:00" in Nederlandse tijd (voor <input type="datetime-local">) */
export function dateToAmsterdamLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatDateTime(value, timeZone = TZ) {
  if (!value) return '–';
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function formatShort(value, timeZone = TZ) {
  if (!value) return '–';
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function isPast(value) {
  return !!value && new Date(value).getTime() < Date.now();
}
