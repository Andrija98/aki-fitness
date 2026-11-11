// Klijent: članarina. Stanje, IPS QR kod za uplatu na račun i dugme "Uplata je poslata" (poruka treneru).
// Uplatu evidentira trener kad je vidi u banci; tek tada se članarina produžava.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getBillingSettings, getMembershipPayments, sendMessage } from '../data/api.js';
import { membershipLabel, membershipStatus, paidUntilOf } from '../lib/membership.js';
import { formatAccount, ipsPayload } from '../lib/ips.js';
import { dateKey, formatDate, formatNumber } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';
import IpsQr from '../components/IpsQr.jsx';

// 1 mesec, 2–4 meseca, 5+ meseci (11–14 meseci), 21 mesec…
function monthsLabel(n) {
  const last = n % 10;
  const teens = n % 100 >= 11 && n % 100 <= 14;
  if (last === 1 && !teens) return `${n} mesec`;
  if (last >= 2 && last <= 4 && !teens) return `${n} meseca`;
  return `${n} meseci`;
}

async function load() {
  const [payments, billing] = await Promise.all([getMembershipPayments(), getBillingSettings()]);
  return { payments, billing };
}

export default function Membership({ profile }) {
  const { data, error, reload } = useData(load);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  const { payments, billing } = data;
  const status = membershipStatus(paidUntilOf(payments), dateKey(new Date()));
  const payload = ipsPayload({
    account: billing.account, payeeName: billing.payeeName, amountRsd: billing.priceRsd, purpose: `Članarina ${profile.name}`,
  });

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <h1 className="screen-title">Članarina</h1>

      <div className="membership">
        <span className="kicker" style={{ color: 'var(--color-accent-300)' }}>Tvoja članarina</span>
        <span className="heading" style={{ fontSize: 24, lineHeight: 1.15 }}>{membershipLabel(status)}</span>
        {status.paidUntil && <span className="small">Plaćeno do {formatDate(status.paidUntil)}</span>}
        {status.state === 'free' && <span className="small">Nemaš evidentiranu uplatu. Pristup je otvoren dok {TRAINER_NAME} ne evidentira prvu.</span>}
      </div>

      {payload ? <PaymentInfo payload={payload} billing={billing} purpose={`Članarina ${profile.name}`} /> : (
        <p className="muted" style={{ margin: 0 }}>Podaci za uplatu još nisu podešeni. Javi se {TRAINER_NAME}ju u porukama.</p>
      )}

      {payments.length > 0 && (
        <section className="col" style={{ gap: 8 }} aria-label="Uplate">
          <div className="section-head"><span>Uplate</span></div>
          {payments.map((p) => (
            <div key={p.id} className="log-line">
              <span className="col">
                <span style={{ fontWeight: 600 }}>{formatDate(p.paidOn)}</span>
                <span className="small muted">{monthsLabel(p.months)} · do {formatDate(p.periodEnd)}</span>
              </span>
              <span className="muted">{formatNumber(p.amountRsd, 0)} RSD</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function PaymentInfo({ payload, billing, purpose }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(formatAccount(billing.account));
      toast('Broj računa kopiran');
    } catch {
      toast(formatAccount(billing.account));
    }
  }

  async function notifyTrainer() {
    if (busy || sent) return;
    setBusy(true);
    try {
      await sendMessage(`Uplata članarine je poslata: ${formatNumber(billing.priceRsd, 0)} RSD (${purpose}).`);
      setSent(true);
      toast(`Poruka poslata ${TRAINER_NAME}ju`);
    } catch {
      toast('Poruka nije poslata. Proveri internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface col" style={{ gap: 12 }} aria-label="Uplata">
      <div className="row between">
        <span style={{ fontWeight: 700 }}>Mesečna članarina</span>
        <span className="heading" style={{ fontSize: 22 }}>{formatNumber(billing.priceRsd, 0)} RSD</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Otvori aplikaciju svoje banke, izaberi plaćanje QR kodom i skeniraj kod. Ako plaćaš sa istog telefona,
        sačuvaj sliku koda i učitaj je u aplikaciji banke.
      </p>
      <IpsQr payload={payload} alt="IPS QR kod za uplatu članarine" />

      <div className="col small" style={{ gap: 4 }}>
        <span><span className="muted">Primalac:</span> <strong>{billing.payeeName}</strong></span>
        <span className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span><span className="muted">Račun:</span> <strong>{formatAccount(billing.account)}</strong></span>
          <button type="button" className="text-btn" style={{ padding: '0 4px', minHeight: 36 }} onClick={copyAccount}>Kopiraj</button>
        </span>
        <span><span className="muted">Svrha:</span> {purpose}</span>
      </div>

      <button type="button" className="pill-btn pill-btn--accent" disabled={busy || sent} onClick={notifyTrainer}>
        {sent ? 'Poruka poslata' : 'Uplata je poslata'}
      </button>
      <span className="small muted">Članarina se produžava kad {TRAINER_NAME} vidi uplatu i evidentira je.</span>
      <button type="button" className="text-btn" onClick={() => navigate('poruke')}>Pitanje o uplati? Piši {TRAINER_NAME}ju</button>
    </section>
  );
}
