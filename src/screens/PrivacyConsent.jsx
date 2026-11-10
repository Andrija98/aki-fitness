// Pristanak na obradu podataka, pre onboardinga i pre svega ostalog. Prikazuje se novim korisnicima i svima
// čiji je pristanak za stariju verziju politike (updated). Bez pristanka može samo da se odjavi.

import { useState } from 'react';
import { acceptPrivacy, signOut } from '../data/api.js';
import { href } from '../lib/router.js';
import { APP_NAME, PRIVACY_CHANGES, PRIVACY_VERSION, TRAINER_NAME } from '../config.js';

export default function PrivacyConsent({ updated, onDone }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    if (!agreed || busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptPrivacy(PRIVACY_VERSION);
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
          {updated && <p className="editor-note" role="note">Politika privatnosti je izmenjena. {PRIVACY_CHANGES}</p>}
          <p className="muted" style={{ margin: 0 }}>
            Da bi {TRAINER_NAME} mogao da ti pravi plan treninga i ishrane, aplikacija čuva tvoje podatke o telu i zdravlju:
            težinu, mere, visinu, godište, ishranu i fotografije napretka. Vidiš ih samo ti i {TRAINER_NAME}, a čuvaju se u Evropskoj uniji.
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
