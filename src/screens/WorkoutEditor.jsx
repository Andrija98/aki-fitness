// Trener: novi trening ili izmena postojećeg. workoutId = 'novi' za novi trening.
// Treninzi se ne brišu: na njih su vezani programi i odrađeni treninzi klijenata.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getExercises, getWorkout, getWorkoutUsage, saveWorkout } from '../data/api.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

let nextKey = 0;
const newKey = () => `item-${nextKey++}`;

async function load(workoutId) {
  const isNew = workoutId === 'novi';
  const [exercises, workout, usage] = await Promise.all([
    getExercises(),
    isNew ? null : getWorkout(workoutId),
    isNew ? 0 : getWorkoutUsage(workoutId),
  ]);
  return { exercises, workout, usage, isNew };
}

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
const decimal = (v) => Number(String(v).trim().replace(',', '.'));

export default function WorkoutEditor({ workoutId }) {
  const { data, error, reload } = useData(() => load(workoutId), [workoutId]);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  if (!data.isNew && !data.workout) return <div className="screen"><p>Trening nije pronađen.</p></div>;
  return <Editor {...data} />;
}

function Editor({ exercises, workout, usage, isNew }) {
  const [form, setForm] = useState({
    title: workout?.title ?? '',
    minutes: workout?.minutes != null ? String(workout.minutes) : '',
    equipment: workout?.equipment ?? '',
  });
  const [items, setItems] = useState(() => (workout?.items ?? []).map((it) => ({
    key: newKey(),
    exerciseId: it.exerciseId,
    sets: String(it.sets),
    mode: it.seconds != null ? 'seconds' : 'reps',
    amount: String(it.seconds ?? it.reps ?? ''),
    kg: it.kg != null ? String(it.kg) : '',
    rest: String(it.rest ?? 60),
  })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const nameOf = (id) => exercises.find((e) => e.id === id)?.name ?? 'Vežba';
  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  function addItem() {
    const used = new Set(items.map((it) => it.exerciseId));
    const next = exercises.find((e) => !used.has(e.id)) ?? exercises[0];
    setItems([...items, { key: newKey(), exerciseId: next.id, sets: '3', mode: 'reps', amount: '10', kg: '', rest: '60' }]);
  }

  function move(index, delta) {
    const list = [...items];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    setItems(list);
  }

  // Vraća poruku o grešci ili gotov objekat za čuvanje.
  function validate() {
    const title = form.title.trim();
    if (!title) return 'Unesi naziv treninga.';
    const minutes = form.minutes.trim() === '' ? null : wholeNumber(form.minutes);
    if (minutes !== null && !(minutes >= 1 && minutes <= 300)) return 'Trajanje mora biti od 1 do 300 minuta.';
    if (!items.length) return 'Dodaj bar jednu vežbu.';
    if (new Set(items.map((it) => it.exerciseId)).size !== items.length) return 'Ista vežba je dvaput u treningu.';

    const prepared = [];
    for (const [i, it] of items.entries()) {
      const label = `Vežba ${i + 1}`;
      const sets = wholeNumber(it.sets);
      if (!(sets >= 1 && sets <= 20)) return `${label}: serije moraju biti od 1 do 20.`;
      const amount = wholeNumber(it.amount);
      if (!(amount >= 1 && amount <= 999)) return `${label}: unesi ${it.mode === 'seconds' ? 'sekunde' : 'ponavljanja'} (1–999).`;
      const kg = it.kg.trim() === '' ? null : decimal(it.kg);
      if (kg !== null && !(kg >= 0 && kg <= 999.9)) return `${label}: kilaža mora biti od 0 do 999,9.`;
      const rest = wholeNumber(it.rest);
      if (!(rest >= 0 && rest <= 600)) return `${label}: pauza mora biti od 0 do 600 sekundi.`;
      prepared.push({
        exerciseId: it.exerciseId,
        sets,
        reps: it.mode === 'reps' ? amount : null,
        seconds: it.mode === 'seconds' ? amount : null,
        kg,
        rest,
      });
    }
    return { id: workout?.id, title, minutes, equipment: form.equipment.trim() || null, items: prepared };
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const result = validate();
    if (typeof result === 'string') return setError(result);
    setBusy(true);
    setError('');
    try {
      await saveWorkout(result);
      toast('Trening sačuvan');
      navigate('trener-treninzi');
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  return (
    <form className="screen screen--no-tabbar" onSubmit={save}>
      <div className="row between">
        <button className="round-btn" type="button" onClick={() => back('trener-treninzi')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <h1 className="screen-title">{isNew ? 'Novi trening' : 'Izmena treninga'}</h1>
      {usage > 0 && (
        <p className="editor-note" role="note">Ovaj trening koristi programa: {usage}. Izmene odmah vide svi klijenti tih programa.</p>
      )}

      <div className="col" style={{ gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="workout-title">Naziv treninga</label>
          <input id="workout-title" className="text-input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="editor-grid">
          <div>
            <label className="field-label" htmlFor="workout-minutes">Trajanje (min)</label>
            <input id="workout-minutes" className="text-input" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="workout-equipment">Oprema</label>
            <input id="workout-equipment" className="text-input" maxLength={60} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="npr. bučice" />
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 12 }}>
        <div className="section-head"><span>Vežbe</span></div>
        {items.map((it, i) => {
          const n = i + 1;
          const name = nameOf(it.exerciseId);
          const amountLabel = it.mode === 'seconds' ? 'Sekundi' : 'Ponavljanja';
          return (
            <div key={it.key} className="surface col" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="workout-num">{n}</span>
                <select className="text-input" style={{ background: 'var(--color-neutral-100)' }} aria-label={`Vežba ${n}`} value={it.exerciseId}
                  onChange={(e) => update(it.key, { exerciseId: e.target.value })}>
                  {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>

              <div className="chips" role="radiogroup" aria-label={`Mera za vežbu ${n}`}>
                {[['reps', 'Ponavljanja'], ['seconds', 'Sekunde']].map(([mode, label]) => (
                  <button key={mode} type="button" role="radio" aria-checked={it.mode === mode}
                    className={`chip chip--sage ${it.mode === mode ? 'on' : ''}`} onClick={() => update(it.key, { mode })}>{label}</button>
                ))}
              </div>

              <div className="editor-grid">
                <NumberField label="Serije" n={n} value={it.sets} onChange={(v) => update(it.key, { sets: v })} />
                <NumberField label={amountLabel} n={n} value={it.amount} onChange={(v) => update(it.key, { amount: v })} />
                <NumberField label="Kilaža (kg)" n={n} value={it.kg} decimal onChange={(v) => update(it.key, { kg: v })} placeholder="—" />
                <NumberField label="Pauza (s)" n={n} value={it.rest} onChange={(v) => update(it.key, { rest: v })} />
              </div>

              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="round-btn editor-move" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Pomeri gore: ${name}`}><Icon name="chevronUp" /></button>
                <button type="button" className="round-btn editor-move" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Pomeri dole: ${name}`}><Icon name="chevronDown" /></button>
                <button type="button" className="text-btn" style={{ marginLeft: 'auto' }} onClick={() => setItems(items.filter((x) => x.key !== it.key))} aria-label={`Ukloni: ${name}`}>Ukloni</button>
              </div>
            </div>
          );
        })}
        <button type="button" className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }} onClick={addItem}>
          <Icon name="plus" size={18} /> Dodaj vežbu
        </button>
      </div>

      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn pill-btn--accent" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj trening'}</button>
    </form>
  );
}

function NumberField({ label, n, value, onChange, decimal: isDecimal, placeholder }) {
  const id = `${label}-${n}`.replace(/\W+/g, '-');
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode={isDecimal ? 'decimal' : 'numeric'}
        aria-label={`${label}, vežba ${n}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
