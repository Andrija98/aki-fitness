// Trener: podaci za uplatu članarine (primalac, račun, cena). Kad se registruje delatnost, ovde se menja broj računa.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getBillingSettings, saveBillingSettings } from '../data/api.js';
import { formatAccount, ipsPayload, isValidAccount, normalizeAccount } from '../lib/ips.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';
import IpsQr from '../components/IpsQr.jsx';

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);

export default function BillingSettings() {
  const { data, error, reload } = useData(getBillingSettings);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  return <Form initial={data} />;
}

function Form({ initial }) {
  const [form, setForm] = useState({
    payeeName: initial.payeeName,
    account: initial.account ? formatAccount(initial.account) : '',
    price: initial.priceRsd != null ? String(initial.priceRsd) : '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Vraća poruku o grešci ili gotove podatke.
  function validate() {
    const payeeName = form.payeeName.trim();
    const account = form.account.trim() === '' ? '' : normalizeAccount(form.account);
    if (account === null) return 'Broj računa: 18 cifara, npr. 160-0000000123456-78.';
    if (account && !isValidAccount(account)) return 'Broj računa nije ispravan (kontrolni broj se ne slaže). Proveri ga u aplikaciji banke.';
    if (account && !payeeName) return 'Unesi ime primaoca, kako piše u banci.';
    if (payeeName.length > 70) return 'Ime primaoca može imati najviše 70 znakova.';
    const priceRsd = form.price.trim() === '' ? null : wholeNumber(form.price);
    if (priceRsd !== null && !(priceRsd >= 1 && priceRsd <= 1000000)) return 'Cena mora biti ceo broj dinara (1–1.000.000).';
    return { payeeName, account, priceRsd };
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const result = validate();
    if (typeof result === 'string') return setError(result);
    setBusy(true);
    setError('');
    try {
      await saveBillingSettings(result);
      toast('Podaci za uplatu sačuvani');
      back('profil');
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  const preview = validate();
  const payload = typeof preview === 'string' ? null
    : ipsPayload({ account: preview.account, payeeName: preview.payeeName, amountRsd: preview.priceRsd, purpose: 'Članarina (provera)' });

  return (
    <form className="screen" onSubmit={save}>
      <div className="row between">
        <button className="round-btn" type="button" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="screen-title">Naplata</h1>
        <p className="muted" style={{ margin: 0 }}>Podaci za uplatu članarine. Klijenti ih vide na ekranu Članarina, zajedno sa IPS QR kodom.</p>
      </div>

      <div className="col" style={{ gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="billing-name">Primalac</label>
          <input id="billing-name" className="text-input" maxLength={70} value={form.payeeName}
            onChange={(e) => set('payeeName', e.target.value)} placeholder="Ime i prezime, kako piše u banci" />
        </div>
        <div>
          <label className="field-label" htmlFor="billing-account">Broj računa</label>
          <input id="billing-account" className="text-input" inputMode="numeric" value={form.account}
            onChange={(e) => set('account', e.target.value)} placeholder="160-0000000123456-78" />
        </div>
        <div>
          <label className="field-label" htmlFor="billing-price">Mesečna cena (RSD)</label>
          <input id="billing-price" className="text-input" inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </div>
      </div>

      {payload && (
        <section className="surface col" style={{ gap: 10 }} aria-label="Provera QR koda">
          <span style={{ fontWeight: 700 }}>Provera</span>
          <span className="small muted">Skeniraj kod svojom aplikacijom banke (bez plaćanja) i proveri da li su primalac, račun i iznos tačni.</span>
          <IpsQr payload={payload} alt="IPS QR kod za proveru" />
        </section>
      )}

      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn pill-btn--accent" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj'}</button>
    </form>
  );
}
