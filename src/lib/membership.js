// Članarina: stanje i produženje. Čiste funkcije nad datumima "YYYY-MM-DD" (testovi u e2e/membership.spec.js).
//
// "Plaćeno do 10." znači pristup zaključno sa 10. Posle toga još GRACE_DAYS dana punog pristupa (11.–15.),
// a zaključava se tek 16. Klijent bez ijedne evidentirane uplate nema ograničenja (postojeći nalozi).

export const WARN_DAYS = 5;  // toliko dana pre isteka počinje upozorenje
export const GRACE_DAYS = 5; // toliko dana posle isteka pristup još radi

const DAY_MS = 86400000;
const toUtc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Broj dana od a do b (b − a), oba "YYYY-MM-DD".
export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function addDays(iso, days) {
  return toIso(toUtc(iso) + days * DAY_MS);
}

// Isti dan za n meseci; ako taj dan ne postoji (31. januar + 1 mesec), poslednji dan tog meseca.
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const firstOfTarget = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(d, lastDay));
  return toIso(firstOfTarget.getTime());
}

// state: 'free' (nema uplata, bez ograničenja) | 'active' | 'expiring' | 'grace' | 'locked'
export function membershipStatus(paidUntil, today) {
  if (!paidUntil) return { state: 'free', hasAccess: true };
  const daysLeft = daysBetween(today, paidUntil);
  if (daysLeft > WARN_DAYS) return { state: 'active', hasAccess: true, paidUntil, daysLeft };
  if (daysLeft >= 0) return { state: 'expiring', hasAccess: true, paidUntil, daysLeft };
  const graceLeft = GRACE_DAYS + daysLeft; // daysLeft je ovde negativan: koliko dana je prošlo od isteka
  if (graceLeft >= 0) return { state: 'grace', hasAccess: true, paidUntil, graceLeft };
  return { state: 'locked', hasAccess: false, paidUntil };
}

// Novi "plaćeno do" posle uplate za n meseci. Ako članarina još važi, nastavlja se na nju
// (plaćeno do 10. decembra + 1 mesec = 10. januar). Ako je istekla, kreće od danas, pa kašnjenje
// ne "pojede" deo plaćenog meseca (uplata 13. novembra = do 12. decembra).
export function extendPaidUntil(paidUntil, today, months) {
  const start = paidUntil && paidUntil >= today ? addDays(paidUntil, 1) : today;
  return addDays(addMonths(start, months), -1);
}

// Najkasniji period_end među uplatama, ili null.
export function paidUntilOf(payments) {
  return payments.reduce((max, p) => (!max || p.periodEnd > max ? p.periodEnd : max), null);
}

// Kratak tekst stanja, za trake i oznake.
export function membershipLabel(status) {
  const days = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana'}`;
  switch (status.state) {
    case 'expiring': return status.daysLeft === 0 ? 'Članarina ističe danas' : `Članarina ističe za ${days(status.daysLeft)}`;
    case 'grace': return status.graceLeft === 0 ? 'Članarina je istekla, danas je poslednji dan pristupa' : `Članarina je istekla, pristup još ${days(status.graceLeft)}`;
    case 'locked': return 'Članarina je istekla';
    case 'active': return 'Članarina je aktivna';
    default: return 'Članarina nije aktivirana';
  }
}
