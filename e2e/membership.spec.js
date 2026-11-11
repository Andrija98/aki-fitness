// Članarina i IPS QR: čiste funkcije, bez browsera i baze.

import { test, expect } from '@playwright/test';
import { addMonths, extendPaidUntil, membershipLabel, membershipStatus, paidUntilOf, GRACE_DAYS } from '../src/lib/membership.js';
import { formatAccount, ipsPayload, isValidAccount, normalizeAccount } from '../src/lib/ips.js';

test('stanje članarine po danima: upozorenje 5 dana pre, pristup još 5 dana posle isteka', () => {
  const paid = '2026-11-10';
  expect(membershipStatus(null, '2026-11-01')).toMatchObject({ state: 'free', hasAccess: true });
  expect(membershipStatus(paid, '2026-11-04')).toMatchObject({ state: 'active', daysLeft: 6 });
  expect(membershipStatus(paid, '2026-11-05')).toMatchObject({ state: 'expiring', daysLeft: 5 });
  expect(membershipStatus(paid, '2026-11-10')).toMatchObject({ state: 'expiring', daysLeft: 0, hasAccess: true });
  expect(membershipStatus(paid, '2026-11-11')).toMatchObject({ state: 'grace', graceLeft: 4, hasAccess: true });
  expect(membershipStatus(paid, '2026-11-15')).toMatchObject({ state: 'grace', graceLeft: 0, hasAccess: true });
  expect(membershipStatus(paid, '2026-11-16')).toMatchObject({ state: 'locked', hasAccess: false });
  expect(GRACE_DAYS).toBe(5);
});

test('granica preko kraja meseca i godine', () => {
  expect(membershipStatus('2026-12-30', '2027-01-04')).toMatchObject({ state: 'grace', graceLeft: 0 });
  expect(membershipStatus('2026-12-30', '2027-01-05')).toMatchObject({ state: 'locked' });
});

test('produženje: nastavlja se na važeću članarinu, a posle isteka kreće od danas', () => {
  expect(extendPaidUntil(null, '2026-11-11', 1)).toBe('2026-12-10');           // prva uplata
  expect(extendPaidUntil('2026-12-10', '2026-12-08', 1)).toBe('2027-01-10');   // plaćeno unapred
  expect(extendPaidUntil('2026-12-10', '2026-12-10', 1)).toBe('2027-01-10');   // na dan isteka
  expect(extendPaidUntil('2026-11-10', '2026-11-13', 1)).toBe('2026-12-12');   // kasni 3 dana: mesec od danas
  expect(extendPaidUntil('2026-11-10', '2026-11-11', 3)).toBe('2027-02-10');   // tri meseca
});

test('meseci različite dužine', () => {
  expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
  expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // prestupna
  expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  expect(extendPaidUntil(null, '2027-01-31', 1)).toBe('2027-02-27');
});

test('plaćeno do je najkasniji kraj perioda, a tekst stanja ima pravilne oblike', () => {
  expect(paidUntilOf([])).toBeNull();
  expect(paidUntilOf([{ periodEnd: '2026-12-10' }, { periodEnd: '2027-01-10' }, { periodEnd: '2026-11-10' }])).toBe('2027-01-10');
  expect(membershipLabel(membershipStatus('2026-11-10', '2026-11-09'))).toBe('Članarina ističe za 1 dan');
  expect(membershipLabel(membershipStatus('2026-11-10', '2026-11-07'))).toBe('Članarina ističe za 3 dana');
  expect(membershipLabel(membershipStatus('2026-11-10', '2026-11-10'))).toBe('Članarina ističe danas');
  expect(membershipLabel(membershipStatus('2026-11-10', '2026-11-12'))).toBe('Članarina je istekla, pristup još 3 dana');
  expect(membershipLabel(membershipStatus('2026-11-10', '2026-11-15'))).toBe('Članarina je istekla, danas je poslednji dan pristupa');
});

// Ispravan broj računa za test: kontrolni broj po MOD 97-10 (98 − (osnova × 100) mod 97).
function withControl(base16) {
  const control = 98n - ((BigInt(base16) * 100n) % 97n);
  return base16 + String(control).padStart(2, '0');
}

test('broj računa: crtice, dopuna nulama i kontrolni broj', () => {
  const account = withControl('1600000000123456');
  expect(isValidAccount(account)).toBe(true);
  expect(isValidAccount(account.slice(0, 17) + ((Number(account[17]) + 1) % 10))).toBe(false); // jedna cifra pogrešna
  expect(isValidAccount('12345')).toBe(false);
  expect(normalizeAccount(`160-123456-${account.slice(16)}`)).toBe(account);
  expect(normalizeAccount(account)).toBe(account);
  expect(normalizeAccount(` ${account.slice(0, 3)} ${account.slice(3, 16)} ${account.slice(16)} `)).toBe(account); // razmaci
  expect(normalizeAccount('160-12-3')).toBeNull();
  expect(normalizeAccount('abc')).toBeNull();
  expect(formatAccount(account)).toBe(`160-0000000123456-${account.slice(16)}`);
});

test('IPS QR sadržaj po NBS standardu, bez znaka koji razdvaja polja', () => {
  const account = withControl('1600000000123456');
  expect(ipsPayload({ account, payeeName: 'Aki Trener', amountRsd: 2500, purpose: 'Članarina Tester' }))
    .toBe(`K:PR|V:01|C:1|R:${account}|N:Aki Trener|I:RSD2500,00|SF:289|S:Članarina Tester`);
  expect(ipsPayload({ account, payeeName: 'A|B', amountRsd: 1999.5, purpose: 'x|y' })).toContain('N:A B|I:RSD1999,50|SF:289|S:x y');
  expect(ipsPayload({ account, payeeName: 'Aki', amountRsd: 100, purpose: 'Članarina '.repeat(10) }).split('S:')[1].length).toBeLessThanOrEqual(35);
  expect(ipsPayload({ account: '160000000012345600', payeeName: 'Aki', amountRsd: 100, purpose: 'x' })).toBeNull(); // loš kontrolni broj
  expect(ipsPayload({ account, payeeName: '', amountRsd: 100, purpose: 'x' })).toBeNull();
  expect(ipsPayload({ account, payeeName: 'Aki', amountRsd: 0, purpose: 'x' })).toBeNull();
});
