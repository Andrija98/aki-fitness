// Trener: nova namirnica ili izmena. foodId = 'nova' za novu.
// Namirnice se ne brišu nego deaktiviraju: planovi klijenata će se pozivati na njih.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getFood, saveFood } from '../data/api.js';
import { FOOD_GROUPS, MEAL_TYPES, kcalFromMacros, macrosMatchKcal } from '../lib/nutrition.js';
import { formatNumber } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

const decimal = (v) => (String(v).trim() === '' ? NaN : Number(String(v).trim().replace(',', '.')));
const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
const asText = (n) => (n == null ? '' : String(n).replace('.', ','));

export default function FoodEditor({ foodId }) {
  const isNew = foodId === 'nova';
  const { data, error, reload, loading } = useData(() => (isNew ? Promise.resolve(null) : getFood(foodId)), [foodId]);
  if (error) return <LoadError onRetry={reload} />;
  if (loading) return null;
  if (!isNew && !data) return <div className="screen"><p>Namirnica nije pronađena.</p></div>;
  return <Editor food={data} isNew={isNew} />;
}

function Editor({ food, isNew }) {
  const [form, setForm] = useState({
    name: food?.name ?? '',
    group: food?.group ?? 'protein',
    kcal: asText(food?.kcal), protein: asText(food?.protein), carbs: asText(food?.carbs), fat: asText(food?.fat),
    mealTypes: food?.mealTypes ?? [],
    minG: food ? String(food.minG) : '10',
    maxG: food ? String(food.maxG) : '300',
    verified: food?.verified ?? true, // namirnicu koju trener sam unese smatramo proverenom
    active: food?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleMeal = (id) => set('mealTypes', form.mealTypes.includes(id) ? form.mealTypes.filter((m) => m !== id) : [...form.mealTypes, id]);

  const numbers = { kcal: decimal(form.kcal), protein: decimal(form.protein), carbs: decimal(form.carbs), fat: decimal(form.fat) };
  const allNumbers = Object.values(numbers).every(Number.isFinite);
  const mismatch = allNumbers && !macrosMatchKcal(numbers);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    if (!name) return setError('Unesi naziv namirnice.');
    if (!(numbers.kcal >= 0 && numbers.kcal <= 900)) return setError('Kalorije na 100 g moraju biti od 0 do 900.');
    for (const [key, label] of [['protein', 'Proteini'], ['carbs', 'Ugljeni hidrati'], ['fat', 'Masti']]) {
      if (!(numbers[key] >= 0 && numbers[key] <= 100)) return setError(`${label} na 100 g moraju biti od 0 do 100.`);
    }
    if (!form.mealTypes.length) return setError('Izaberi bar jedan obrok u kom se nudi.');
    const minG = wholeNumber(form.minG);
    const maxG = wholeNumber(form.maxG);
    if (!(minG >= 1 && minG <= 1000)) return setError('Najmanja porcija mora biti od 1 do 1000 g.');
    if (!(maxG >= minG && maxG <= 2000)) return setError('Najveća porcija mora biti veća od najmanje i do 2000 g.');

    setBusy(true);
    setError('');
    try {
      await saveFood({ id: food?.id, name, group: form.group, ...numbers, mealTypes: form.mealTypes, minG, maxG, verified: form.verified, active: form.active });
      toast('Namirnica sačuvana');
      navigate('namirnice');
    } catch (err) {
      setError(err?.code === '23505' ? 'Namirnica sa tim nazivom već postoji.' : 'Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  const numberField = (key, label) => (
    <div>
      <label className="field-label" htmlFor={`food-${key}`}>{label}</label>
      <input id={`food-${key}`} className="text-input" inputMode="decimal" value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <form className="screen screen--no-tabbar" onSubmit={save}>
      <div className="row between">
        <button className="round-btn" type="button" onClick={() => back('namirnice')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <h1 className="screen-title">{isNew ? 'Nova namirnica' : 'Izmena namirnice'}</h1>
      {food?.source && <span className="small muted">Izvor: {food.source}</span>}

      <div>
        <label className="field-label" htmlFor="food-name">Naziv</label>
        <input id="food-name" className="text-input" maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="npr. Pirinač beli (suv)" />
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>Grupa</span>
        <div className="chips" role="radiogroup" aria-label="Grupa">
          {FOOD_GROUPS.map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={form.group === g.id}
              className={`chip chip--sage ${form.group === g.id ? 'on' : ''}`} onClick={() => set('group', g.id)}>{g.label}</button>
          ))}
        </div>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>Na 100 g (sirovo / suvo)</span>
        <div className="editor-grid">
          {numberField('kcal', 'Kalorije (kcal)')}
          {numberField('protein', 'Proteini (g)')}
          {numberField('carbs', 'Ugljeni hidrati (g)')}
          {numberField('fat', 'Masti (g)')}
        </div>
        {mismatch && (
          <p className="editor-note" role="note">
            Kalorije se ne slažu sa makroima: iz makroa izlazi oko {formatNumber(kcalFromMacros(numbers.protein, numbers.carbs, numbers.fat), 0)} kcal. Proveri da nema greške u kucanju.
          </p>
        )}
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>Nudi se za</span>
        <div className="chips" role="group" aria-label="Obroci">
          {MEAL_TYPES.map((m) => (
            <button key={m.id} type="button" aria-pressed={form.mealTypes.includes(m.id)}
              className={`chip chip--sage ${form.mealTypes.includes(m.id) ? 'on' : ''}`} onClick={() => toggleMeal(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      <div className="editor-grid">
        <div>
          <label className="field-label" htmlFor="food-min">Najmanja porcija (g)</label>
          <input id="food-min" className="text-input" inputMode="numeric" value={form.minG} onChange={(e) => set('minG', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="food-max">Najveća porcija (g)</label>
          <input id="food-max" className="text-input" inputMode="numeric" value={form.maxG} onChange={(e) => set('maxG', e.target.value)} />
        </div>
      </div>

      <label className="surface row editor-switch">
        <input type="checkbox" checked={form.verified} onChange={(e) => set('verified', e.target.checked)} />
        <span className="col">
          <span style={{ fontWeight: 700 }}>Proverena</span>
          <span className="small muted">Plan ishrane koristi samo proverene namirnice.</span>
        </span>
      </label>
      <label className="surface row editor-switch">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        <span className="col">
          <span style={{ fontWeight: 700 }}>Aktivna</span>
          <span className="small muted">Neaktivna se više ne nudi klijentima.</span>
        </span>
      </label>

      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn pill-btn--accent" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj namirnicu'}</button>
    </form>
  );
}
