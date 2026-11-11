// Pomoćne funkcije za datume i brojeve (srpski format).

export const DAY_LETTERS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N']; // ponedeljak → nedelja
export const DAY_NAMES = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

export function formatLongDate(d = new Date()) {
  const s = d.toLocaleDateString('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Prima i "YYYY-MM-DD" iz baze; podne sprečava da vremenska zona prebaci datum na susedni dan.
export function formatShortDate(d) {
  const date = typeof d === 'string' && d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  return date.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' });
}

// Pun datum, npr. "10. decembar 2026." (članarina). Prima "YYYY-MM-DD".
export function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' });
}

// "Danas", "Juče" ili kratak datum, za razdvajanje poruka po danima.
export function formatDayLabel(d) {
  const key = dateKey(d);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dateKey(new Date())) return 'Danas';
  if (key === dateKey(yesterday)) return 'Juče';
  return formatShortDate(d);
}

export function formatTime(d) {
  return new Date(d).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(n, decimals = 1) {
  return Number(n).toLocaleString('sr-RS', { maximumFractionDigits: decimals });
}

export function dateKey(d) {
  return new Date(d).toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

// Dani tekuće nedelje (od ponedeljka), kao Date objekti.
export function currentWeek(now = new Date()) {
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Broj uzastopnih dana sa treningom, računajući do danas (ili juče, ako danas još nije bilo).
export function dayStreak(sessions) {
  const days = new Set(sessions.map((s) => dateKey(s.date)));
  const d = new Date();
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function formatDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

export function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GOAL_LABEL = { mrsavljenje: 'Mršavljenje', snaga: 'Snaga i mišići', kondicija: 'Kondicija i energija' };

// Cilj stavke treninga, npr. "4 serije × 10–12 ponavljanja" ili "3 serije × 30 s".
export function formatTarget({ sets, reps, repsMax, seconds }) {
  const lastDigit = sets % 10;
  const teens = sets % 100 >= 12 && sets % 100 <= 14;
  const setWord = lastDigit === 1 && sets % 100 !== 11 ? 'serija' : lastDigit >= 2 && lastDigit <= 4 && !teens ? 'serije' : 'serija';
  if (seconds != null) return `${sets} ${setWord} × ${seconds} s`;
  const amount = repsMax ? `${reps}–${repsMax}` : `${reps}`;
  return `${sets} ${setWord} × ${amount} ponavljanja`;
}

export function formatDaysAgo(d) {
  const startOfDay = (x) => new Date(dateKey(x) + 'T12:00:00').getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'danas';
  if (days === 1) return 'juče';
  return `pre ${days} ${days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana'}`;
}

// YouTube i Bunny linkovi: src/lib/video.js
