// Prijava email + lozinka. Posle uspeha useAuth dobije sesiju i App sam prikaže aplikaciju.

import { useState } from 'react';
import { signIn } from '../data/api.js';
import { APP_NAME, TRAINER_NAME } from '../config.js';

function errorMessage(error) {
  if (error?.code === 'invalid_credentials') return 'Pogrešan email ili lozinka.';
  if (error?.status === 429) return 'Previše pokušaja. Sačekaj malo pa probaj ponovo.';
  return 'Prijava nije uspela. Proveri internet i pokušaj ponovo.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
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
          <span className="small" style={{ fontWeight: 600, color: 'var(--color-accent-700)' }}>{APP_NAME}</span>
          <h1 className="ob-title">Prijavi se</h1>
          <p className="muted" style={{ margin: 0 }}>Nalog ti otvara {TRAINER_NAME}. Unesi email i lozinku.</p>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" className="text-input" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="ime@primer.com" />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Lozinka</label>
            <input id="password" className="text-input" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
        </div>
      </div>

      <div className="ob-footer">
        <button className="pill-btn" type="submit" disabled={!canSubmit}>{busy ? 'Prijavljujem…' : 'Prijavi se'}</button>
      </div>
    </form>
  );
}
