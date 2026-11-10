// Ishrana (klijent): dnevni cilj i plan za danas.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import { getFoodPreferences, getFoods, getMealTemplates, getNutrition, saveBodyData } from '../data/api.js';
import { ACTIVITY, GOAL_LABEL, MIN_AGE, ageFromBirthYear, calculateTargets, goalSummary } from '../lib/nutrition.js';
import { generatePlan, weekdayIndex } from '../lib/mealPlan.js';
import { navigate } from '../lib/router.js';
import { formatNumber } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';
import LoadError from '../components/LoadError.jsx';

// Cilj koji važi: trenerov ako ga je postavio, inače preporuka po formuli.
export function currentTarget(n) {
  const computed = calculateTargets({
    sex: n.sex,
    age: n.birthYear ? ageFromBirthYear(n.birthYear) : null,
    heightCm: n.heightCm,
    weightKg: n.weightKg,
    activity: n.activity,
    goal: n.goal,
  });
  return { computed, target: n.override ?? (computed && !computed.minor ? computed : null) };
}

export function TargetTiles({ target }) {
  return (
    <div className="col" style={{ gap: 12 }}>
      <span className="target-kcal">{formatNumber(target.kcal, 0)} <span className="small muted">kcal dnevno</span></span>
      <div className="stat-grid">
        <div><span className="stat-value">{target.protein} g</span><span className="stat-label">Proteini</span></div>
        <div><span className="stat-value">{target.carbs} g</span><span className="stat-label">Ugljeni hidrati</span></div>
        <div><span className="stat-value">{target.fat} g</span><span className="stat-label">Masti</span></div>
      </div>
    </div>
  );
}

export default function Nutrition() {
  const { data, error, reload } = useData(() => getNutrition());
  const [editing, setEditing] = useState(false);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;

  const hasBodyData = data.sex && data.birthYear && data.heightCm && data.activity && data.weightKg;
  if (editing || (!hasBodyData && !data.override)) {
    return <BodyForm initial={data} onSaved={() => { setEditing(false); reload(); }} onCancel={hasBodyData ? () => setEditing(false) : null} />;
  }

  const { computed, target } = currentTarget(data);
  return (
    <div className="screen">
      <h1 className="screen-title">Ishrana</h1>
      <div className="surface col" style={{ gap: 14 }}>
        <span className="kicker" style={{ color: 'var(--color-accent-700)' }}>Tvoj dnevni cilj</span>
        {target ? <TargetTiles target={target} /> : (
          <p style={{ margin: 0 }}>{computed?.minor
            ? `Za mlađe od ${MIN_AGE} godina ne računamo cilj po formuli. Dogovori se sa ${TRAINER_NAME}jem.`
            : 'Fale podaci za računanje.'}</p>
        )}
        {target && !data.override && computed && <span className="small" style={{ fontWeight: 600 }}>{goalSummary(data.goal, computed)}</span>}
        {target && data.override && <span className="small" style={{ fontWeight: 600 }}>{GOAL_LABEL[data.goal]}</span>}
        {target && !data.override && computed && computed.proteinBasisKg < data.weightKg && (
          <span className="small muted">Proteini su računati za {computed.proteinBasisKg} kg, zdravu težinu za tvoju visinu.</span>
        )}
        <span className="small muted">
          {data.override ? `Cilj postavio ${TRAINER_NAME}.` : `Preporuka po formuli. ${TRAINER_NAME} može da je prilagodi.`}
        </span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Okvirna preporuka, nije medicinski savet. Ako imaš zdravstvene tegobe, posavetuj se sa lekarom.</p>
      <button className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }} onClick={() => setEditing(true)}>Izmeni podatke</button>
      {target && <TodayPlan target={target} />}
    </div>
  );
}

async function loadPlanInputs() {
  const [templates, foods, likedIds] = await Promise.all([getMealTemplates(), getFoods(), getFoodPreferences()]);
  return { templates, foods, likedIds };
}

// Plan za danas, izračunat iz izbora namirnica. U sledećem koraku plan se čuva i dobija kvačice.
function TodayPlan({ target }) {
  const { data, error } = useData(loadPlanInputs);
  if (error || !data) return null;

  const hasFoods = data.foods.some((f) => f.verified && f.active);
  if (!hasFoods) {
    return <div className="surface"><span className="small muted">{TRAINER_NAME} još priprema namirnice za plan ishrane.</span></div>;
  }
  if (!data.likedIds.length) {
    return (
      <div className="surface col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700 }}>Plan obroka</span>
        <span className="small muted">Izaberi namirnice koje voliš, pa ti pravimo plan doručka, užina, ručka i večere prema tvom cilju.</span>
        <button className="pill-btn pill-btn--accent" onClick={() => navigate('ishrana', 'namirnice')}>Izaberi namirnice koje voliš</button>
      </div>
    );
  }

  const { days } = generatePlan({ target, templates: data.templates, foods: data.foods, likedIds: data.likedIds });
  const today = days[weekdayIndex()];
  return (
    <section className="col" style={{ gap: 10 }} aria-label="Plan za danas">
      <div className="section-head">
        <span>Plan za danas</span>
        <span className="small muted">{formatNumber(today.totals.kcal, 0)} kcal</span>
      </div>
      {today.meals.map((m) => (
        <div key={m.mealType} className="surface col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 700, color: 'var(--color-neutral-600)' }}>
            {m.label.toUpperCase()}{m.timeHint ? ` · ${m.timeHint}` : ''} · {formatNumber(m.totals.kcal, 0)} kcal
          </span>
          {m.items.map((it) => (
            <span key={it.foodId} className="row between" style={{ gap: 8 }}>
              <span>{it.name}{it.suggested && <span className="small muted"> · predlog trenera</span>}</span>
              <span style={{ fontWeight: 700 }}>{it.grams} g</span>
            </span>
          ))}
        </div>
      ))}
      <span className="small muted">Gramaže su za namirnice u sirovom / suvom stanju.</span>
      <button className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }} onClick={() => navigate('ishrana', 'namirnice')}>Promeni namirnice</button>
    </section>
  );
}

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);

function BodyForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({
    sex: initial.sex ?? '',
    birthYear: initial.birthYear ? String(initial.birthYear) : '',
    heightCm: initial.heightCm ? String(initial.heightCm) : '',
    weightKg: initial.weightKg ? String(initial.weightKg).replace('.', ',') : '',
    activity: initial.activity ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const thisYear = new Date().getFullYear();
    const birthYear = wholeNumber(form.birthYear);
    const heightCm = wholeNumber(form.heightCm);
    const weightKg = parseFloat(form.weightKg.replace(',', '.'));
    if (!form.sex) return setError('Izaberi pol.');
    if (!(birthYear >= 1900 && birthYear <= thisYear)) return setError('Unesi ispravnu godinu rođenja.');
    if (!(heightCm >= 100 && heightCm <= 250)) return setError('Visina mora biti od 100 do 250 cm.');
    if (!(weightKg >= 20 && weightKg <= 400)) return setError('Unesi ispravnu težinu.');
    if (!form.activity) return setError('Izaberi koliko si aktivan.');
    setBusy(true);
    setError('');
    try {
      await saveBodyData({ sex: form.sex, birthYear, heightCm, activity: form.activity, weightKg });
      toast('Podaci sačuvani');
      onSaved();
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={save}>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="screen-title">Izračunaj dnevni cilj</h1>
        <p className="muted" style={{ margin: 0 }}>Na osnovu ovih podataka računamo koliko ti kalorija i makroa treba dnevno. Vidiš ih samo ti i {TRAINER_NAME}.</p>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>Pol</span>
        <div className="chips" role="radiogroup" aria-label="Pol">
          {[['m', 'Muški'], ['z', 'Ženski']].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={form.sex === id}
              className={`chip chip--sage ${form.sex === id ? 'on' : ''}`} onClick={() => set('sex', id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="editor-grid">
        <div>
          <label className="field-label" htmlFor="birth-year">Godina rođenja</label>
          <input id="birth-year" className="text-input" inputMode="numeric" value={form.birthYear} onChange={(e) => set('birthYear', e.target.value)} placeholder="npr. 1995" />
        </div>
        <div>
          <label className="field-label" htmlFor="height">Visina (cm)</label>
          <input id="height" className="text-input" inputMode="numeric" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="body-weight">Težina (kg)</label>
        <input id="body-weight" className="text-input" inputMode="decimal" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />
      </div>

      <div className="col" style={{ gap: 10 }} role="radiogroup" aria-label="Aktivnost">
        <span className="field-label" style={{ margin: 0 }}>Koliko si aktivan?</span>
        {ACTIVITY.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={form.activity === a.id}
            className={`option ${form.activity === a.id ? 'on' : ''}`} onClick={() => set('activity', a.id)}>
            <span className="col" style={{ flex: 1 }}>
              <span className="option-title">{a.label}</span>
              <span className="option-sub">{a.hint}</span>
            </span>
            <span className="option-radio" aria-hidden="true" />
          </button>
        ))}
      </div>

      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="ob-footer">
        <button className="pill-btn" disabled={busy}>{busy ? 'Čuvam…' : 'Izračunaj'}</button>
        {onCancel && <button className="text-btn" type="button" onClick={onCancel}>Odustani</button>}
      </div>
    </form>
  );
}
