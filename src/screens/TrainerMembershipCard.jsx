// Trener, u profilu klijenta: stanje članarine, evidencija uplate i poništavanje poslednje uplate.
// Produženje se računa od dana uplate (ne od dana unosa), pa trenerovo kašnjenje sa unosom ne kraći klijenta.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import { addMembershipPayment, deleteMembershipPayment, getBillingSettings, getMembershipPayments } from '../data/api.js';
import { extendPaidUntil, membershipLabel, membershipStatus, paidUntilOf } from '../lib/membership.js';
import { dateKey, formatDate, formatNumber } from '../lib/format.js';

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);

async function load(clientId) {
  const [payments, billing] = await Promise.all([getMembershipPayments(clientId), getBillingSettings()]);
  return { payments, billing };
}

export default function TrainerMembershipCard({ clientId }) {
  const { data, error, reload } = useData(() => load(clientId), [clientId]);
  if (error || !data) return null; // greška se ne prikazuje dvaput: napredak ispod već ima ekran "Nema veze"
  return <Card key={data.payments[0]?.id ?? 'prazno'} clientId={clientId} {...data} onSaved={reload} />;
}

function Card({ clientId, payments, billing, onSaved }) {
  const today = dateKey(new Date());
  const paidUntil = paidUntilOf(payments);
  const status = membershipStatus(paidUntil, today);
  const [form, setForm] = useState({ amount: billing.priceRsd ? String(billing.priceRsd) : '', months: '1', paidOn: today, note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const months = wholeNumber(form.months);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(form.paidOn) && form.paidOn <= today;
  const newPaidUntil = months >= 1 && months <= 24 && validDate ? extendPaidUntil(paidUntil, form.paidOn, months) : null;

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast(message);
      onSaved();
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    if (busy) return;
    const amount = wholeNumber(form.amount);
    if (!(amount >= 0 && amount <= 1000000)) return setError('Iznos mora biti ceo broj dinara (0–1.000.000).');
    if (!(months >= 1 && months <= 24)) return setError('Broj meseci mora biti od 1 do 24.');
    if (!validDate) return setError('Datum uplate ne može biti u budućnosti.');
    run(() => addMembershipPayment(clientId, {
      paidOn: form.paidOn, amountRsd: amount, months, periodEnd: newPaidUntil, note: form.note.trim(),
    }), 'Uplata evidentirana');
  }

  const last = payments[0];
  return (
    <form className="surface col" style={{ gap: 12 }} onSubmit={save} aria-label="Članarina klijenta">
      <span className="kicker" style={{ color: 'var(--color-accent-700)' }}>Članarina</span>
      <span style={{ fontWeight: 700 }}>{membershipLabel(status)}</span>
      {paidUntil
        ? <span className="small muted">Plaćeno do {formatDate(paidUntil)}</span>
        : <span className="small muted">Nema evidentiranih uplata: klijent ima pristup bez ograničenja dok ne evidentiraš prvu.</span>}

      <div className="editor-grid">
        <div>
          <label className="field-label" htmlFor="pay-amount">Iznos (RSD)</label>
          <input id="pay-amount" className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="numeric"
            value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="pay-months">Meseci</label>
          <input id="pay-months" className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="numeric"
            value={form.months} onChange={(e) => set('months', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="pay-date">Datum uplate</label>
        <input id="pay-date" type="date" className="text-input" style={{ background: 'var(--color-neutral-100)' }} max={today}
          value={form.paidOn} onChange={(e) => set('paidOn', e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="pay-note">Napomena (po želji)</label>
        <input id="pay-note" className="text-input" style={{ background: 'var(--color-neutral-100)' }} maxLength={200}
          value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="npr. uplata iz Intese" />
      </div>
      {newPaidUntil && <span className="small" style={{ fontWeight: 600 }}>Novo plaćeno do: {formatDate(newPaidUntil)}</span>}
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn" disabled={busy}>Evidentiraj uplatu</button>

      {last && (
        <div className="col" style={{ gap: 6 }}>
          <span className="small muted">
            Poslednja uplata: {formatDate(last.paidOn)} · {formatNumber(last.amountRsd, 0)} RSD · do {formatDate(last.periodEnd)}
          </span>
          {confirmUndo ? (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="text-btn" onClick={() => setConfirmUndo(false)}>Ne</button>
              <button type="button" className="text-btn" disabled={busy}
                onClick={() => run(() => deleteMembershipPayment(last.id), 'Uplata poništena')}>Da, poništi</button>
            </div>
          ) : (
            <button type="button" className="text-btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setConfirmUndo(true)}>
              Poništi poslednju uplatu
            </button>
          )}
        </div>
      )}
    </form>
  );
}
