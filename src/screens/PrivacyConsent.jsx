// Pristanak na obradu podataka, pre onboardinga i pre svega ostalog. Važi i za postojeće korisnike
// (prikazuje se dok u profilu nema privacy_accepted_at). Bez pristanka može samo da se odjavi.

import { useState } from 'react';
import { acceptPrivacy, signOut } from '../data/api.js';
import { href } from '../lib/router.js';
import { APP_NAME, TRAINER_NAME } from '../config.js';

export default function PrivacyConsent({ onDone }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    if (!agreed || busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptPrivacy();
      onDone();
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--no-tabbar">
      <div className="ob-blob" aria-hidden="true" />
      <div className="ob-content">
        <div className="col" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 600, color: 'var(--color-accent-700)' }}>{APP_NAME}</span>
          <h1 className="ob-title">Tvoji podaci</h1>
          <p className="muted" style={{ margin: 0 }}>
            Da bi {TRAINER_NAME} mogao da ti pravi plan treninga i ishrane, aplikacija čuva tvoje podatke o telu i zdravlju:
            težinu, mere, visinu, godište i ishranu. Vidiš ih samo ti i {TRAINER_NAME}, a čuvaju se u Evropskoj uniji.
          </p>
          <a href={href('privatnost')} style={{ fontWeight: 700 }}>Pročitaj celu politiku privatnosti</a>
        </div>

        <label className="pref-row surface">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>Saglasan sam sa obradom mojih podataka, uključujući podatke o zdravlju, kako je opisano u politici privatnosti.</span>
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
      </div>

      <div className="ob-footer">
        <button className="pill-btn" disabled={!agreed || busy} onClick={accept}>{busy ? 'Sačekaj…' : 'Prihvatam i nastavljam'}</button>
        <button className="text-btn" type="button" onClick={() => signOut()}>Ne prihvatam, odjavi me</button>
      </div>
    </main>
  );
}
