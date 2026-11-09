// Trener: novi program ili izmena postojećeg. programId = 'novi' za novi program.
// Programi se ne brišu (na njih su vezani odrađeni treninzi); nacrt služi i kao arhiva.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getProgram, getProgramClientCount, getWorkoutsOverview, saveProgram } from '../data/api.js';
import Icon from '../components/Icon.jsx';

const LOCATIONS = [['kuca', 'Kod kuće'], ['teretana', 'Teretana']];
const LEVELS = ['Početnik', 'Srednji', 'Napredni', 'Svi nivoi'];
const TONES = [['accent', 'Narandžasta'], ['sage', 'Zelena'], ['neutral', 'Neutralna']];

let nextKey = 0;
const newKey = () => `slot-${nextKey++}`;
const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);

async function load(programId) {
  const isNew = programId === 'novi';
  const [workouts, program, clientCount] = await Promise.all([
    getWorkoutsOverview(),
    isNew ? null : getProgram(programId),
    isNew ? 0 : getProgramClientCount(programId),
  ]);
  return { workouts, program, clientCount, isNew };
}

export default function ProgramEditor({ programId }) {
  const { data } = useData(() => load(programId), [programId]);
  if (!data) return null;
  if (!data.isNew && !data.program) return <div className="screen"><p>Program nije pronađen.</p></div>;
  return <Editor {...data} />;
}

function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="field-label" style={{ margin: 0 }}>{label}</span>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id}
            className={`chip chip--sage ${value === id ? 'on' : ''}`} onClick={() => onChange(id)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function Editor({ workouts, program, clientCount, isNew }) {
  const [form, setForm] = useState({
    title: program?.title ?? '',
    description: program?.description ?? '',
    weeks: program ? String(program.weeks) : '4',
    perWeek: program ? String(program.perWeek) : '3',
    location: program?.location ?? 'kuca',
    level: program?.level ?? 'Početnik',
    tone: program?.tone ?? 'accent',
    published: program?.published ?? false,
  });
  const [slots, setSlots] = useState(() => (program?.schedule ?? []).map((workoutId) => ({ key: newKey(), workoutId })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Nivo koji nije na listi (npr. upisan ranije) i dalje mora da se vidi kao izabran.
  const levels = LEVELS.includes(form.level) ? LEVELS : [...LEVELS, form.level];

  function move(index, delta) {
    const list = [...slots];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    setSlots(list);
  }

  function validate() {
    const title = form.title.trim();
    if (!title) return 'Unesi naziv programa.';
    const weeks = wholeNumber(form.weeks);
    if (!(weeks >= 1 && weeks <= 52)) return 'Broj nedelja mora biti od 1 do 52.';
    const perWeek = wholeNumber(form.perWeek);
    if (!(perWeek >= 1 && perWeek <= 7)) return 'Treninga nedeljno mora biti od 1 do 7.';
    if (!slots.length) return 'Dodaj bar jedan trening u raspored.';
    return {
      id: program?.id,
      title,
      description: form.description.trim() || null,
      weeks,
      perWeek,
      location: form.location,
      level: form.level,
      tone: form.tone,
      published: form.published,
      schedule: slots.map((s) => s.workoutId),
    };
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const result = validate();
    if (typeof result === 'string') return setError(result);
    setBusy(true);
    setError('');
    try {
      await saveProgram(result);
      toast('Program sačuvan');
      navigate('trener-programi');
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  const unpublishing = program?.published && !form.published && clientCount > 0;

  return (
    <form className="screen screen--no-tabbar" onSubmit={save}>
      <div className="row between">
        <button className="round-btn" type="button" onClick={() => back('trener-programi')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <h1 className="screen-title">{isNew ? 'Novi program' : 'Izmena programa'}</h1>
      {clientCount > 0 && (
        <p className="editor-note" role="note">
          Ovaj program trenutno radi klijenata: {clientCount}. Promena rasporeda im pomera sledeći trening.
        </p>
      )}

      <div className="col" style={{ gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="program-title">Naziv programa</label>
          <input id="program-title" className="text-input" maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="program-description">Opis</label>
          <textarea id="program-description" className="text-input editor-textarea" maxLength={400} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="editor-grid">
          <div>
            <label className="field-label" htmlFor="program-weeks">Broj nedelja</label>
            <input id="program-weeks" className="text-input" inputMode="numeric" value={form.weeks} onChange={(e) => set('weeks', e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="program-per-week">Treninga nedeljno</label>
            <input id="program-per-week" className="text-input" inputMode="numeric" value={form.perWeek} onChange={(e) => set('perWeek', e.target.value)} />
          </div>
        </div>
        <ChoiceGroup label="Mesto" options={LOCATIONS} value={form.location} onChange={(v) => set('location', v)} />
        <ChoiceGroup label="Nivo" options={levels.map((l) => [l, l])} value={form.level} onChange={(v) => set('level', v)} />
        <ChoiceGroup label="Boja kartice" options={TONES} value={form.tone} onChange={(v) => set('tone', v)} />
      </div>

      <div className="col" style={{ gap: 12 }}>
        <div className="section-head"><span>Raspored</span><span className="small muted">ponavlja se</span></div>
        {slots.map((slot, i) => {
          const n = i + 1;
          return (
            <div key={slot.key} className="surface row" style={{ gap: 8 }}>
              <span className="workout-num">{n}</span>
              <select className="text-input" style={{ background: 'var(--color-neutral-100)', flex: 1, minWidth: 0 }} aria-label={`Trening ${n} u rasporedu`} value={slot.workoutId}
                onChange={(e) => setSlots(slots.map((s) => (s.key === slot.key ? { ...s, workoutId: e.target.value } : s)))}>
                {workouts.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
              <div className="col" style={{ gap: 4 }}>
                <button type="button" className="round-btn editor-move" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Pomeri gore trening ${n}`}><Icon name="chevronUp" /></button>
                <button type="button" className="round-btn editor-move" disabled={i === slots.length - 1} onClick={() => move(i, 1)} aria-label={`Pomeri dole trening ${n}`}><Icon name="chevronDown" /></button>
              </div>
              <button type="button" className="round-btn editor-move" onClick={() => setSlots(slots.filter((s) => s.key !== slot.key))} aria-label={`Ukloni trening ${n}`}><Icon name="x" size={18} /></button>
            </div>
          );
        })}
        <button type="button" className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
          disabled={!workouts.length} onClick={() => setSlots([...slots, { key: newKey(), workoutId: workouts[0].id }])}>
          <Icon name="plus" size={18} /> Dodaj trening
        </button>
      </div>

      <label className="surface row editor-switch">
        <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
        <span className="col">
          <span style={{ fontWeight: 700 }}>Objavljen</span>
          <span className="small muted">Klijenti vide samo objavljene programe.</span>
        </span>
      </label>
      {unpublishing && (
        <p className="editor-note" role="note">Kad skineš objavu, klijenti koji rade ovaj program na Početnoj dobijaju "Izaberi program". Njihova istorija ostaje.</p>
      )}

      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn pill-btn--accent" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj program'}</button>
    </form>
  );
}
