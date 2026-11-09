// Postavljanje nove lozinke. Isti ekran za promenu iz Profila i za oporavak preko linka iz mejla.

import { useState } from 'react';
import { updatePassword } from '../data/api.js';

const MIN_LENGTH = 8;

function errorMessage(error) {
  if (error?.code === 'same_password') return 'Nova lozinka mora da se razlikuje od stare.';
  if (error?.code === 'weak_password') return 'Lozinka je preslaba. Izaberi dužu.';
  return 'Promena nije uspela. Proveri internet i pokušaj ponovo.';
}

export default function NewPassword({ onDone, onCancel }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_LENGTH) return setError(`Lozinka mora da ima najmanje ${MIN_LENGTH} znakova.`);
    if (password !== repeat) return setError('Lozinke se ne poklapaju.');
    setBusy(true);
    setError('');
    try {
      await updatePassword(password);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="screen screen--no-tabbar" onSubmit={submit}>
      <div className="ob-blob" aria-hidden="true" />
      <div className="ob-content login-content">
        <div className="col" style={{ gap: 8 }}>
          <h1 className="ob-title">Nova lozinka</h1>
          <p className="muted" style={{ margin: 0 }}>Izaberi lozinku koju znaš samo ti.</p>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="new-password">Nova lozinka</label>
            <input id="new-password" className="text-input" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="repeat-password">Ponovi lozinku</label>
            <input id="repeat-password" className="text-input" type="password" autoComplete="new-password" value={repeat}
              onChange={(e) => setRepeat(e.target.value)} />
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
        </div>
      </div>

      <div className="ob-footer">
        <button className="pill-btn" type="submit" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj lozinku'}</button>
        {onCancel && <button className="text-btn" type="button" onClick={onCancel}>Odustani</button>}
      </div>
    </form>
  );
}
