// Onboarding u 4 koraka: ime → cilj i mesto → nivo i učestalost → težina.
// Isti ekran služi i za izmenu ciljeva iz profila (kad postoji `initial`).

import { useState } from 'react';
import { saveProfile } from '../data/api.js';
import { navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { TRAINER_NAME } from '../config.js';

const GOALS = [
  { id: 'mrsavljenje', title: 'Mršavljenje', sub: 'Sagorevanje masti, lakše telo', sign: '−', iconBg: 'var(--color-accent-200)', iconInk: 'var(--color-accent-800)' },
  { id: 'snaga', title: 'Snaga i mišići', sub: 'Jače telo, više mišićne mase', sign: '+', iconBg: 'var(--color-accent-2-200)', iconInk: 'var(--color-accent-2-800)' },
  { id: 'kondicija', title: 'Kondicija i energija', sub: 'Izdržljivost za svaki dan', sign: '~', iconBg: 'var(--color-accent-200)', iconInk: 'var(--color-accent-800)' },
];
const LOCATIONS = [['kuca', 'Kod kuće'], ['teretana', 'Teretana'], ['oba', 'Oba']];
const LEVELS = [
  { id: 'pocetnik', title: 'Početnik', sub: 'Tek počinjem ili se vraćam posle pauze', sign: '1' },
  { id: 'srednji', title: 'Srednji', sub: 'Treniram redovno nekoliko meseci', sign: '2' },
  { id: 'napredni', title: 'Napredni', sub: 'Treniram godinama, znam tehniku', sign: '3' },
];
const STEPS = 4;

export default function Onboarding({ initial, onDone }) {
  const editing = Boolean(initial);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    goal: initial?.goal ?? 'mrsavljenje',
    location: initial?.location ?? 'kuca',
    level: initial?.level ?? 'pocetnik',
    perWeek: initial?.perWeek ?? 3,
    weightKg: initial?.weightKg ?? '',
  });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const canContinue = step !== 1 || form.name.trim().length > 0;

  async function next() {
    if (step < STEPS) return setStep(step + 1);
    if (saving) return;
    const weight = parseFloat(String(form.weightKg).replace(',', '.'));
    // Poruka stoji na ekranu, a ne u toast-u: toast se ne prikazuje dok je onboarding otvoren.
    setSaving(true);
    setSaveError('');
    try {
      await saveProfile({ ...form, name: form.name.trim(), weightKg: Number.isFinite(weight) ? weight : null });
    } catch {
      setSaveError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      return setSaving(false);
    }
    if (editing) {
      toast('Ciljevi sačuvani');
      navigate('profil');
    }
    onDone();
  }

  return (
    <div className="screen screen--no-tabbar">
      <div className="ob-blob" aria-hidden="true" />
      <div className="ob-content">
        <div className="row between">
          <div className="ob-steps" aria-label={`Korak ${step} od ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, i) => <span key={i} className={i < step ? 'on' : ''} />)}
          </div>
          {(step > 1 || editing) && (
            <button className="text-btn" onClick={() => (step > 1 ? setStep(step - 1) : navigate('profil'))}>Nazad</button>
          )}
        </div>

        {step === 1 && (
          <>
            <Header step={1} title="Kako se zoveš?" sub={`${TRAINER_NAME} voli da zna s kim trenira.`} />
            <div>
              <label className="field-label" htmlFor="name">Ime</label>
              <input id="name" className="text-input" value={form.name} autoComplete="given-name"
                onChange={(e) => set('name', e.target.value)} placeholder="npr. Marija" />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Header step={2} title="Šta želiš da postigneš?" sub={`${TRAINER_NAME} će prilagoditi program tvom cilju.`} />
            <div className="col" style={{ gap: 10 }} role="radiogroup" aria-label="Cilj">
              {GOALS.map((g) => <Option key={g.id} item={g} on={form.goal === g.id} onPick={() => set('goal', g.id)} />)}
            </div>
            <div className="col" style={{ gap: 10 }}>
              <span className="field-label" style={{ margin: 0 }}>Gde treniraš?</span>
              <div className="chips" role="radiogroup" aria-label="Gde treniraš">
                {LOCATIONS.map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={form.location === id}
                    className={`chip chip--sage ${form.location === id ? 'on' : ''}`} onClick={() => set('location', id)}>{label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Header step={3} title="Koliko si iskusan?" sub="Da ne krenemo ni prelako ni preteško." />
            <div className="col" style={{ gap: 10 }} role="radiogroup" aria-label="Nivo">
              {LEVELS.map((l) => (
                <Option key={l.id} item={{ ...l, iconBg: 'var(--color-neutral-100)', iconInk: 'var(--color-text)' }}
                  on={form.level === l.id} onPick={() => set('level', l.id)} />
              ))}
            </div>
            <div className="col" style={{ gap: 10 }}>
              <span className="field-label" style={{ margin: 0 }}>Koliko puta nedeljno?</span>
              <div className="chips" role="radiogroup" aria-label="Treninga nedeljno">
                {[2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={form.perWeek === n}
                    className={`chip chip--sage ${form.perWeek === n ? 'on' : ''}`} onClick={() => set('perWeek', n)}>{n}×</button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Header step={4} title="Tvoja težina danas" sub="Opciono. Služi samo da pratiš napredak, vidiš je samo ti i trener." />
            <div>
              <label className="field-label" htmlFor="weight">Težina (kg)</label>
              <input id="weight" className="text-input" inputMode="decimal" value={form.weightKg}
                onChange={(e) => set('weightKg', e.target.value)} placeholder="npr. 72,5" />
            </div>
          </>
        )}
      </div>

      <div className="ob-footer">
        {saveError && <p className="login-error" role="alert">{saveError}</p>}
        <button className="pill-btn" disabled={!canContinue || saving} onClick={next}>
          {step < STEPS ? 'Nastavi' : editing ? 'Sačuvaj' : 'Kreni sa treningom'}
        </button>
        {step === 4 && !editing && (
          <button className="text-btn" onClick={next}>Preskoči za sada</button>
        )}
      </div>
    </div>
  );
}

function Header({ step, title, sub }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="small" style={{ fontWeight: 600, color: 'var(--color-accent-700)' }}>Korak {step} od {STEPS}</span>
      <h1 className="ob-title">{title}</h1>
      <p className="muted" style={{ margin: 0 }}>{sub}</p>
    </div>
  );
}

function Option({ item, on, onPick }) {
  return (
    <button className={`option ${on ? 'on' : ''}`} role="radio" aria-checked={on} onClick={onPick}>
      <span className="option-icon" style={{ background: item.iconBg, color: item.iconInk }}>{item.sign}</span>
      <span className="col" style={{ flex: 1 }}>
        <span className="option-title">{item.title}</span>
        <span className="option-sub">{item.sub}</span>
      </span>
      <span className="option-radio" aria-hidden="true" />
    </button>
  );
}
