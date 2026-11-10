// Ishrana (klijent): dnevni cilj, nedeljni plan i kvačice "pojeo sam".

import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import {
  getFoodPreferences, getFoods, getMealChecks, getMealPlan, getMealTemplates, getNutrition, replaceMealPlan, saveBodyData, setMealCheck,
} from '../data/api.js';
import { ACTIVITY, MIN_AGE, ageFromBirthYear, calculateTargets, goalSummary } from '../lib/nutrition.js';
import { generatePlan, inputsKey, itemsToDays, planToItems, weekdayIndex } from '../lib/mealPlan.js';
import { navigate } from '../lib/router.js';
import { currentWeek, dateKey, DAY_NAMES, formatNumber, GOAL_LABEL } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';
import LoadError from '../components/LoadError.jsx';
import Icon from '../components/Icon.jsx';
import DayPicker from '../components/DayPicker.jsx';

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
      {target && <WeekPlan target={target} />}
    </div>
  );
}

const MACRO_BARS = [
  ['Proteini', 'protein', 'var(--color-accent-2-600)'],
  ['UH', 'carbs', 'var(--color-accent)'],
  ['Masti', 'fat', 'var(--color-neutral-700)'],
];

async function loadPlanInputs() {
  const week = currentWeek();
  const [templates, foods, likedIds, plan, checks] = await Promise.all([
    getMealTemplates(), getFoods(), getFoodPreferences(), getMealPlan(), getMealChecks(dateKey(week[0]), dateKey(week[6])),
  ]);
  return { templates, foods, likedIds, plan, checks };
}

function WeekPlan({ target }) {
  const { data, error } = useData(loadPlanInputs);
  if (error || !data) return null;
  return <WeekPlanView target={target} {...data} />;
}

// Nedeljni plan je sačuvan u bazi. Dok nije zaključan, pravi se ponovo čim se promene ulazi (otisak inputsKey).
function WeekPlanView({ target, templates, foods, likedIds, plan, checks: initialChecks }) {
  const week = currentWeek();
  const todayIndex = weekdayIndex();
  const [day, setDay] = useState(todayIndex);
  const [checks, setChecks] = useState(initialChecks);
  const savedKey = useRef(null);
  // Obroci čija kvačica se upravo upisuje. Ref, ne state: drugi brz dodir stiže pre ponovnog crtanja.
  const pending = useRef(new Set());

  const hasFoods = foods.some((f) => f.verified && f.active);
  const key = inputsKey({ target, templates, foods, likedIds });
  const upToDate = Boolean(plan && (plan.locked || plan.inputsKey === key));
  const canGenerate = !plan?.locked && hasFoods && likedIds.length > 0;
  // Ulazi se ne menjaju dok je ekran otvoren (dolaze iz jednog učitavanja), pa je otisak dovoljan kao zavisnost.
  const generated = useMemo(
    () => (!upToDate && canGenerate ? generatePlan({ target, templates, foods, likedIds }) : null),
    [key, upToDate, canGenerate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Nov plan se prikazuje odmah, a čuva u pozadini.
  useEffect(() => {
    if (!generated || savedKey.current === key) return;
    savedKey.current = key;
    const items = planToItems(generated.days);
    if (!items.length) return; // nijedna namirnica ne odgovara obrocima: nema šta da se čuva
    const { kcal, protein, carbs, fat } = target;
    replaceMealPlan({ target: { kcal, protein, carbs, fat }, inputsKey: key, items })
      .catch(() => toast('Plan nije sačuvan. Proveri internet.'));
  }, [generated, key, target]);

  const days = upToDate ? itemsToDays({ items: plan.items, foods, templates }) : generated?.days;
  if (!days) {
    if (!hasFoods) return <div className="surface"><span className="small muted">{TRAINER_NAME} još priprema namirnice za plan ishrane.</span></div>;
    return (
      <div className="surface col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700 }}>Plan obroka</span>
        <span className="small muted">Izaberi namirnice koje voliš, pa ti pravimo plan doručka, užina, ručka i večere prema tvom cilju.</span>
        <button className="pill-btn pill-btn--accent" onClick={() => navigate('ishrana', 'namirnice')}>Izaberi namirnice koje voliš</button>
      </div>
    );
  }

  const date = dateKey(week[day]);
  const isFuture = day > todayIndex;
  const dayChecks = checks.filter((c) => c.date === date);
  const isChecked = (mealType) => dayChecks.some((c) => c.mealType === mealType);
  const eaten = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const c of dayChecks) for (const m of Object.keys(eaten)) eaten[m] += c[m];
  const left = target.kcal - eaten.kcal;
  const pct = Math.min(100, Math.round((eaten.kcal / target.kcal) * 100));
  const plannedDay = days[day];

  // Kvačica se prikaže odmah; ako upis ne uspe, vraća se kako je bilo.
  // Dok upis traje, novi dodir na isti obrok se ignoriše: "upiši" i "obriši" bi inače mogli da stignu obrnutim redom.
  async function toggle(meal) {
    const pendingKey = `${date}|${meal.mealType}`;
    if (pending.current.has(pendingKey)) return;
    pending.current.add(pendingKey);
    const was = isChecked(meal.mealType);
    const old = dayChecks.find((c) => c.mealType === meal.mealType);
    const row = {
      date, mealType: meal.mealType, kcal: Math.round(meal.totals.kcal), protein: Math.round(meal.totals.protein),
      carbs: Math.round(meal.totals.carbs), fat: Math.round(meal.totals.fat),
    };
    const without = (cs) => cs.filter((c) => !(c.date === date && c.mealType === meal.mealType));
    setChecks((cs) => (was ? without(cs) : [...cs, row]));
    try {
      await setMealCheck(date, meal.mealType, was ? null : meal.totals);
    } catch {
      setChecks((cs) => (was ? [...without(cs), old] : without(cs)));
      toast('Nije sačuvano. Proveri internet.');
    } finally {
      pending.current.delete(pendingKey);
    }
  }

  return (
    <section className="col" style={{ gap: 14 }} aria-label="Plan ishrane">
      <DayPicker value={day} onChange={setDay} today={todayIndex} />

      <div className="surface row plan-summary">
        <div className="kcal-ring" style={{ '--pct': `${pct}%` }}>
          <span className="kcal-ring-inner">
            <span className="kcal-ring-value">{formatNumber(Math.abs(left), 0)}</span>
            <span className="kcal-ring-label">{left < 0 ? 'kcal preko' : 'kcal preostalo'}</span>
          </span>
        </div>
        <div className="col" style={{ gap: 9, flex: 1, minWidth: 0 }}>
          {MACRO_BARS.map(([label, macro, color]) => (
            <div key={macro} className="col" style={{ gap: 4 }}>
              <span className="row between small">
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span>{Math.round(eaten[macro])} / {target[macro]} g</span>
              </span>
              <span className="macro-bar"><span style={{ width: `${Math.min(100, (eaten[macro] / target[macro]) * 100)}%`, background: color }} /></span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <span>{day === todayIndex ? 'Plan za danas' : `Plan: ${DAY_NAMES[day].toLowerCase()}`}</span>
        <span className="small muted">{formatNumber(plannedDay.totals.kcal, 0)} kcal</span>
      </div>
      {plannedDay.meals.map((m) => {
        const checked = isChecked(m.mealType);
        return (
          <div key={m.mealType} className="surface row meal-card">
            <div className="col" style={{ gap: 6, flex: 1, minWidth: 0 }}>
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
            {!isFuture && (
              <button type="button" className={`meal-check${checked ? ' on' : ''}`} aria-pressed={checked}
                aria-label={`Pojeo sam: ${m.label}`} onClick={() => toggle(m)}>
                <span className="meal-check-dot" aria-hidden="true">{checked && <Icon name="check" />}</span>
              </button>
            )}
          </div>
        );
      })}
      <span className="small muted">Gramaže su za namirnice u sirovom / suvom stanju.</span>
      {plan?.locked
        ? <span className="small muted">Plan je pripremio {TRAINER_NAME}. Za izmene mu piši u porukama.</span>
        : <button className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }} onClick={() => navigate('ishrana', 'namirnice')}>Promeni namirnice</button>}
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
