// Profil: statistike, težina, članarina (placeholder do faze 3) i podešavanja.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { navigate, back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getSessions, getWeights, addWeight, signOut } from '../data/api.js';
import { dayStreak, formatDuration, formatNumber } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';
import Icon from '../components/Icon.jsx';

async function load() {
  const [sessions, weights] = await Promise.all([getSessions(), getWeights()]);
  return { sessions, weights };
}

export default function Profile({ profile }) {
  const { data, reload } = useData(load);
  const [weight, setWeight] = useState('');
  if (!data) return null;

  const { sessions, weights } = data;
  const totalSec = sessions.reduce((s, x) => s + (x.durationSec || 0), 0);
  const since = new Date(profile.createdAt).toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' });
  const lastWeight = weights.at(-1);

  async function saveWeight(e) {
    e.preventDefault();
    const kg = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) return toast('Unesi ispravnu težinu');
    await addWeight(kg);
    setWeight('');
    toast('Težina upisana');
    reload();
  }

  async function logout() {
    try {
      await signOut();
      navigate('pocetna');
    } catch {
      toast('Odjava nije uspela');
    }
  }

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('pocetna')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>

      <div className="row" style={{ gap: 16 }}>
        <span className="avatar" style={{ width: 76, height: 76, fontSize: 32 }} aria-hidden="true">{profile.name.charAt(0).toUpperCase()}</span>
        <div className="col">
          <h1 className="screen-title" style={{ fontSize: 28 }}>{profile.name}</h1>
          <span className="muted">Član od {since}</span>
        </div>
      </div>

      <div className="stat-grid">
        <div><span className="stat-value">{sessions.length}</span><span className="stat-label">Treninga</span></div>
        <div><span className="stat-value">{dayStreak(sessions)}</span><span className="stat-label">Dana zaredom</span></div>
        <div><span className="stat-value">{formatDuration(totalSec)}</span><span className="stat-label">Ukupno</span></div>
      </div>

      <form className="surface col" style={{ gap: 10 }} onSubmit={saveWeight}>
        <div className="row between">
          <span style={{ fontWeight: 700 }}>Težina</span>
          <span className="muted small">{lastWeight ? `poslednje: ${formatNumber(lastWeight.kg)} kg` : 'još nije upisana'}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="decimal" value={weight}
            onChange={(e) => setWeight(e.target.value)} placeholder="kg danas" aria-label="Težina danas u kilogramima" />
          <button className="round-btn round-btn--accent" style={{ width: 56, height: 56 }} aria-label="Upiši težinu"><Icon name="check" /></button>
        </div>
      </form>

      <div className="membership">
        <span className="kicker" style={{ color: 'var(--color-accent-300)' }}>Tvoja članarina</span>
        <span className="heading" style={{ fontSize: 26, lineHeight: 1.1 }}>Probni pristup</span>
        <div className="col small" style={{ gap: 6, fontSize: 14 }}>
          <span>✓ Video programi</span>
          <span>✓ Praćenje treninga</span>
          <span style={{ opacity: 0.6 }}>Lični plan ishrane i poruke sa {TRAINER_NAME}jem uskoro</span>
        </div>
      </div>

      <div className="list">
        <button onClick={() => navigate('ciljevi')}><span>Moji ciljevi</span><Icon name="chevronRight" size={18} style={{ color: 'var(--color-neutral-600)' }} /></button>
        <button onClick={() => navigate('treninzi')}><span>Promeni program</span><Icon name="chevronRight" size={18} style={{ color: 'var(--color-neutral-600)' }} /></button>
        {profile.role === 'trainer' && <button onClick={() => navigate('klijenti')}><span>Klijenti</span><Icon name="chevronRight" size={18} style={{ color: 'var(--color-neutral-600)' }} /></button>}
        {profile.role === 'trainer' && <button onClick={() => navigate('trener-treninzi')}><span>Uređivanje treninga</span><Icon name="chevronRight" size={18} style={{ color: 'var(--color-neutral-600)' }} /></button>}
        {profile.role === 'trainer' && <button onClick={() => navigate('vezbe')}><span>Vežbe</span><Icon name="chevronRight" size={18} style={{ color: 'var(--color-neutral-600)' }} /></button>}
        <button onClick={() => navigate('lozinka')}><span>Promeni lozinku</span><Icon name="chevronRight" size={18} style={{ color: 'var(--color-neutral-600)' }} /></button>
        <button onClick={logout}><span>Odjavi se</span></button>
      </div>
    </div>
  );
}
