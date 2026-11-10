// Trener, u profilu klijenta: nedeljni plan ishrane, izmena grama i zaključavanje.
// Zaključan plan klijentov generator više ne dira; otključan se pravi ponovo kad klijent promeni namirnice ili cilj.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import {
  getFoodPreferences, getFoods, getMealChecks, getMealPlan, getMealTemplates, getNutrition, saveMealPlanGrams, setMealPlanLocked,
} from '../data/api.js';
import { generatePlan, itemsToDays, weekdayIndex } from '../lib/mealPlan.js';
import { currentWeek, dateKey, formatNumber } from '../lib/format.js';
import DayPicker from '../components/DayPicker.jsx';
import { currentTarget } from './Nutrition.jsx';

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
const validGrams = (n) => n >= 1 && n <= 2000;

async function load(clientId) {
  const week = currentWeek();
  const [plan, foods, templates, checks, nutrition, likedIds] = await Promise.all([
    getMealPlan(clientId), getFoods(), getMealTemplates(), getMealChecks(dateKey(week[0]), dateKey(week[6]), clientId),
    getNutrition(clientId), getFoodPreferences(clientId),
  ]);
  return { plan, foods, templates, checks, nutrition, likedIds };
}

export default function TrainerMealPlanCard({ clientId }) {
  const { data, error, reload } = useData(() => load(clientId), [clientId]);
  if (error || !data) return null; // greška se ne prikazuje dvaput: napredak ispod već ima ekran "Nema veze"
  return <Card key={`${data.plan?.id}-${data.plan?.locked}`} {...data} onSaved={reload} />;
}

function Card({ plan, foods, templates, checks, nutrition, likedIds, onSaved }) {
  const todayIndex = weekdayIndex();
  const [day, setDay] = useState(todayIndex);
  const [grams, setGrams] = useState(() => Object.fromEntries((plan?.items ?? []).map((i) => [i.id, String(i.grams)])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const kicker = <span className="kicker" style={{ color: 'var(--color-accent-700)' }}>Ishrana: plan</span>;
  if (!plan) {
    return (
      <section className="surface col" style={{ gap: 8 }} aria-label="Plan ishrane klijenta">
        {kicker}
        <span className="small muted">Klijent još nema plan: nije izabrao namirnice ili još nije otvorio Ishranu.</span>
      </section>
    );
  }

  // Zbirovi se računaju uživo iz upisanih grama; neispravan unos se računa po staroj vrednosti.
  const typed = (item) => {
    const n = wholeNumber(grams[item.id]);
    return validGrams(n) ? n : item.grams;
  };
  const days = itemsToDays({ items: plan.items.map((i) => ({ ...i, grams: typed(i) })), foods, templates });
  const itemFor = (mealType, foodId) => plan.items.find((i) => i.weekday === day && i.mealType === mealType && i.foodId === foodId);
  const target = currentTarget(nutrition).target ?? plan.target;
  // Upozorenja generatora (npr. preuske granice porcija) imaju smisla samo dok generator pravi plan.
  const warnings = !plan.locked && likedIds.length ? generatePlan({ target, templates, foods, likedIds }).warnings : [];
  const plannedSoFar = days.slice(0, todayIndex + 1).reduce((n, d) => n + d.meals.length, 0);
  const changes = plan.items.filter((i) => grams[i.id] !== String(i.grams));
  const selected = days[day];

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast(message);
      onSaved();
    } catch {
      setError('Nije sačuvano. Proveri internet, osveži stranicu i pokušaj ponovo.');
      setBusy(false);
    }
  }

  function save() {
    if (busy) return;
    const values = changes.map((i) => ({ id: i.id, grams: wholeNumber(grams[i.id]) }));
    if (values.some((v) => !validGrams(v.grams))) return setError('Gramaža mora biti ceo broj od 1 do 2000.');
    run(() => saveMealPlanGrams(plan.id, values), plan.locked ? 'Izmene sačuvane' : 'Plan sačuvan i zaključan');
  }

  return (
    <section className="surface col" style={{ gap: 12 }} aria-label="Plan ishrane klijenta">
      {kicker}
      <span className="small" style={{ fontWeight: 600 }}>
        {plan.locked ? 'Zaključan: plan se ne menja sam.' : 'Otključan: plan se pravi sam kad klijent promeni namirnice ili cilj.'}
      </span>
      <span className="small muted">Ove nedelje pojedeno {checks.length} od {plannedSoFar} obroka (do danas).</span>
      {warnings.map((w) => <p key={w} className="editor-note" role="note">{w}</p>)}

      <DayPicker value={day} onChange={setDay} today={todayIndex} />
      <span className="small" style={{ fontWeight: 600 }}>
        {formatNumber(selected.totals.kcal, 0)} / {formatNumber(target.kcal, 0)} kcal · P {Math.round(selected.totals.protein)} / {target.protein} g
        · UH {Math.round(selected.totals.carbs)} / {target.carbs} g · M {Math.round(selected.totals.fat)} / {target.fat} g
      </span>

      {selected.meals.map((m) => (
        <div key={m.mealType} className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 700, color: 'var(--color-neutral-600)' }}>
            {m.label.toUpperCase()} · {formatNumber(m.totals.kcal, 0)} kcal
          </span>
          {m.items.map((it) => {
            const item = itemFor(m.mealType, it.foodId);
            return (
              <label key={it.foodId} className="row between grams-row">
                <span style={{ minWidth: 0 }}>{it.name}{it.suggested && <span className="small muted"> · predlog</span>}</span>
                <span className="row" style={{ gap: 6 }}>
                  <input className="text-input grams-input" inputMode="numeric" aria-label={`${it.name}, ${m.label} (g)`}
                    value={grams[item.id]} onChange={(e) => setGrams({ ...grams, [item.id]: e.target.value })} />
                  <span className="small muted">g</span>
                </span>
              </label>
            );
          })}
        </div>
      ))}

      {error && <p className="login-error" role="alert">{error}</p>}
      {plan.locked ? (
        <>
          <button type="button" className="pill-btn" disabled={busy || !changes.length} onClick={save}>Sačuvaj izmene</button>
          <button type="button" className="text-btn" disabled={busy} onClick={() => run(() => setMealPlanLocked(plan.id, false), 'Plan otključan')}>
            Otključaj plan
          </button>
        </>
      ) : (
        <button type="button" className="pill-btn" disabled={busy} onClick={save}>Sačuvaj i zaključaj</button>
      )}
    </section>
  );
}
