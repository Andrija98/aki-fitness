// Trener: struktura obroka. Koliki deo dnevnih kalorija ide na koji obrok i od kojih grupa namirnica se sastoji.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getMealTemplates, saveMealTemplates } from '../data/api.js';
import { FOOD_GROUPS } from '../lib/nutrition.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);

export default function MealTemplates() {
  const { data, error, reload } = useData(getMealTemplates);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  return <Editor initial={data} />;
}

function Editor({ initial }) {
  const [meals, setMeals] = useState(() => initial.map((m) => ({ ...m, share: String(m.sharePct), time: m.timeHint ?? '' })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (type, patch) => setMeals((list) => list.map((m) => (m.mealType === type ? { ...m, ...patch } : m)));
  const total = meals.reduce((sum, m) => sum + (wholeNumber(m.share) || 0), 0);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    for (const m of meals) {
      const share = wholeNumber(m.share);
      if (!(share >= 0 && share <= 100)) return setError(`${m.label}: udeo mora biti od 0 do 100 %.`);
      if (share > 0 && !m.groups.length) return setError(`${m.label}: izaberi bar jednu grupu namirnica.`);
    }
    if (total !== 100) return setError(`Zbir udela mora biti 100 % (sada ${total} %).`);
    setBusy(true);
    setError('');
    try {
      await saveMealTemplates(meals.map((m) => ({ mealType: m.mealType, label: m.label, sharePct: wholeNumber(m.share), timeHint: m.time.trim() || null, groups: m.groups })));
      toast('Struktura obroka sačuvana');
      setBusy(false);
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  return (
    <form className="screen screen--no-tabbar" onSubmit={save}>
      <div className="row between">
        <button className="round-btn" type="button" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">Struktura obroka</h1>
        <span className="muted">Udeo dnevnih kalorija i grupe namirnica za svaki obrok. Obrok sa 0 % se preskače.</span>
      </div>

      {meals.map((m) => (
        <div key={m.mealType} className="surface col" style={{ gap: 10 }}>
          <span style={{ fontWeight: 700 }}>{m.label}</span>
          <div className="editor-grid">
            <div>
              <label className="field-label" htmlFor={`share-${m.mealType}`}>Udeo (%)</label>
              <input id={`share-${m.mealType}`} className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="numeric"
                aria-label={`Udeo, ${m.label}`} value={m.share} onChange={(e) => update(m.mealType, { share: e.target.value })} />
            </div>
            <div>
              <label className="field-label" htmlFor={`time-${m.mealType}`}>Vreme</label>
              <input id={`time-${m.mealType}`} className="text-input" style={{ background: 'var(--color-neutral-100)' }} maxLength={5}
                aria-label={`Vreme, ${m.label}`} value={m.time} onChange={(e) => update(m.mealType, { time: e.target.value })} placeholder="08:00" />
            </div>
          </div>
          <div className="chips" role="group" aria-label={`Grupe, ${m.label}`}>
            {FOOD_GROUPS.map((g) => {
              const on = m.groups.includes(g.id);
              return (
                <button key={g.id} type="button" aria-pressed={on} className={`chip chip--sage ${on ? 'on' : ''}`}
                  onClick={() => update(m.mealType, { groups: on ? m.groups.filter((x) => x !== g.id) : [...m.groups, g.id] })}>{g.label}</button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="small" style={{ margin: 0, fontWeight: 700 }} aria-live="polite">Ukupno: {total} %</p>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn pill-btn--accent" disabled={busy}>{busy ? 'Čuvam…' : 'Sačuvaj strukturu'}</button>
    </form>
  );
}
