// Brisanje sa proverom upotrebe (vežba, trening, program).
// 1) "Obriši …" proveri da li se stavka negde koristi. 2) Ako se koristi, prikaže razloge i šta da se uradi umesto toga.
// 3) Ako ne, traži potvrdu. Baza i sama odbija brisanje upotrebljenog (strani ključevi), pa i trka završi jasnom porukom.

import { useState } from 'react';

// checkUsage(): Promise<string[]> (prazno = može da se obriše); onDelete(): Promise (posle uspeha sam pozivalac ide dalje)
export default function DeleteControl({ label, checkUsage, onDelete }) {
  const [state, setState] = useState('idle'); // idle | checking | blocked | confirm | deleting
  const [reasons, setReasons] = useState([]);
  const [error, setError] = useState('');

  async function start() {
    setState('checking');
    setError('');
    try {
      const found = await checkUsage();
      setReasons(found);
      setState(found.length ? 'blocked' : 'confirm');
    } catch {
      setError('Provera nije uspela. Proveri internet i pokušaj ponovo.');
      setState('idle');
    }
  }

  async function confirm() {
    setState('deleting');
    try {
      await onDelete();
    } catch (e) {
      if (e?.inUse) {
        setReasons(['U međuvremenu je počelo da se koristi, pa ne može da se obriše.']);
        setState('blocked');
      } else {
        setError('Nije obrisano. Proveri internet i pokušaj ponovo.');
        setState('confirm');
      }
    }
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      {state === 'blocked' && (
        <div className="editor-note" role="note">
          <span style={{ display: 'block', marginBottom: 4 }}>Ne može da se obriše:</span>
          {reasons.map((r) => <span key={r} style={{ display: 'block', fontWeight: 500 }}>• {r}</span>)}
        </div>
      )}
      {error && <p className="login-error" role="alert">{error}</p>}
      {state === 'confirm' || state === 'deleting' ? (
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="pill-btn" style={{ flex: 1, background: 'var(--color-surface)', color: 'var(--color-text)' }}
            disabled={state === 'deleting'} onClick={() => setState('idle')}>Ne</button>
          <button type="button" className="pill-btn pill-btn--accent" style={{ flex: 1 }} disabled={state === 'deleting'} onClick={confirm}>
            {state === 'deleting' ? 'Brišem…' : 'Da, obriši'}
          </button>
        </div>
      ) : (
        state !== 'blocked' && (
          <button type="button" className="text-btn" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} disabled={state === 'checking'} onClick={start}>
            {label}
          </button>
        )
      )}
    </div>
  );
}
