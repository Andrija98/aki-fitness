// Pomoćne funkcije za datume i brojeve (srpski format).

export const DAY_LETTERS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N']; // ponedeljak → nedelja

export function formatLongDate(d = new Date()) {
  const s = d.toLocaleDateString('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
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

export function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
