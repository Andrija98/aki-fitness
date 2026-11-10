// Prijava email + lozinka i zahtev za link kad je lozinka zaboravljena.
// Posle uspešne prijave useAuth dobije sesiju i App sam prikaže aplikaciju.

import { useState } from 'react';
import { requestPasswordReset, signIn } from '../data/api.js';
import { APP_NAME, TRAINER_NAME } from '../config.js';
import { href } from '../lib/router.js';

function errorMessage(error) {
  if (error?.code === 'invalid_credentials') return 'Pogrešan email ili lozinka.';
  if (error?.status === 429) return 'Previše pokušaja. Sačekaj malo pa probaj ponovo.';
  return 'Nije uspelo. Proveri internet i pokušaj ponovo.';
}

// Supabase vraća korisnika sa greškom u adresi kad je link iz mejla istekao ili već iskorišćen.
const expiredLink = () => window.location.hash.includes('error_code=');

export default function Login() {
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => (expiredLink() ? 'Link je istekao ili je već iskorišćen. Zatraži novi.' : ''));
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && (forgot || password.length > 0) && !busy;

  function switchMode(next) {
    setForgot(next);
    setError('');
    setSent(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      if (forgot) {
        await requestPasswordReset(email.trim());
        setSent(true);
        setBusy(false);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const idleLabel = forgot ? 'Pošalji link' : 'Prijavi se';

  return (
    <form className="screen screen--no-tabbar" onSubmit={submit}>
      <div className="ob-blob" aria-hidden="true" />
      <div className="ob-content login-content">
        <div className="col" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 600, color: 'var(--color-accent-700)' }}>{APP_NAME}</span>
          <h1 className="ob-title">{forgot ? 'Zaboravljena lozinka' : 'Prijavi se'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {forgot ? 'Unesi email naloga i poslaćemo ti link za novu lozinku.' : `Nalog ti otvara ${TRAINER_NAME}. Unesi email i lozinku.`}
          </p>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" className="text-input" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="ime@primer.com" />
          </div>
          {!forgot && (
            <div>
              <label className="field-label" htmlFor="password">Lozinka</label>
              <input id="password" className="text-input" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {error && <p className="login-error" role="alert">{error}</p>}
          {sent && <p className="muted" role="status" style={{ margin: 0 }}>Ako nalog postoji, poslali smo link na taj email.</p>}
        </div>
      </div>

      <div className="ob-footer">
        <button className="pill-btn" type="submit" disabled={!canSubmit}>{busy ? 'Sačekaj…' : idleLabel}</button>
        <button className="text-btn" type="button" onClick={() => switchMode(!forgot)}>
          {forgot ? 'Nazad na prijavu' : 'Zaboravljena lozinka?'}
        </button>
        <a className="small muted" href={href('privatnost')} style={{ textAlign: 'center' }}>Politika privatnosti</a>
      </div>
    </form>
  );
}
