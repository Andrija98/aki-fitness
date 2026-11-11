// NBS IPS QR kod za uplatu na račun (kao QR na računu za struju). Čiste funkcije (testovi u e2e/membership.spec.js).
// Za ovaj QR ne treba ugovor sa bankom: klijent ga skenira u svojoj m-banking aplikaciji i dobije popunjen nalog.
//
// Format (NBS standard): K:PR|V:01|C:1|R:<18 cifara>|N:<primalac>|I:RSD<iznos,dd>|SF:<šifra>|S:<svrha>
// Polja su odvojena znakom "|", pa se on ne sme pojaviti u vrednostima.

export const PAYMENT_CODE = '289'; // šifra plaćanja: transakcije po nalogu građana (bezgotovinsko)

// "160-123456-78" → "160000000012345678": banka (3) + partija dopunjena nulama (13) + kontrolni broj (2).
// Vraća null ako oblik nije ispravan.
export function normalizeAccount(input) {
  const raw = String(input ?? '').replace(/\s+/g, ''); // razmaci iz kopiranog broja ("160 0000000123456 78") se ignorišu
  const parts = raw.split('-');
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const [bank, middle, control] = parts;
    if (bank.length !== 3 || control.length !== 2 || middle.length > 13) return null;
    return bank + middle.padStart(13, '0') + control;
  }
  return /^\d{18}$/.test(raw) ? raw : null;
}

// Kontrolni broj računa: ISO 7064, MOD 97-10 (ceo broj od 18 cifara mod 97 mora biti 1).
export function isValidAccount(account) {
  if (!/^\d{18}$/.test(account ?? '')) return false;
  let rest = 0;
  for (const digit of account) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1;
}

// "160000000012345678" → "160-0000000123456-78" (za prikaz)
export function formatAccount(account) {
  return account ? `${account.slice(0, 3)}-${account.slice(3, 16)}-${account.slice(16)}` : '';
}

const clean = (text, max) => String(text ?? '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Tekst QR koda. amountRsd: ceo broj ili decimalni; null ako podaci za uplatu nisu potpuni.
export function ipsPayload({ account, payeeName, amountRsd, purpose }) {
  if (!isValidAccount(account) || !clean(payeeName, 70) || !(amountRsd > 0)) return null;
  const amount = Number(amountRsd).toFixed(2).replace('.', ',');
  return [
    'K:PR', 'V:01', 'C:1',
    `R:${account}`,
    `N:${clean(payeeName, 70)}`,
    `I:RSD${amount}`,
    `SF:${PAYMENT_CODE}`,
    `S:${clean(purpose, 35)}`,
  ].join('|');
}
