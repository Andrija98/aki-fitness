// Trener, u profilu klijenta: preporuka iz kalkulatora i ručna izmena dnevnog cilja.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import { clearNutritionTarget, getNutrition, setNutritionTarget } from '../data/api.js';
import { ACTIVITY, ageFromBirthYear, goalSummary } from '../lib/nutrition.js';
import { formatNumber } from '../lib/format.js';
import { currentTarget } from './Nutrition.jsx';

const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
const FIELDS = [
  ['kcal', 'Kalorije', 800, 6000],
  ['protein', 'Proteini (g)', 0, 500],
  ['carbs', 'Ugljeni hidrati (g)', 0, 1000],
  ['fat', 'Masti (g)', 0, 400],
];

export default function TrainerNutritionCard({ clientId }) {
  const { data, error, reload } = useData(() => getNutrition(clientId), [clientId]);
  if (error || !data) return null; // greška se ne prikazuje dvaput: napredak ispod već ima ekran "Nema veze"
  return <Card key={JSON.stringify(data.override)} clientId={clientId} data={data} onSaved={reload} />;
}

function Card({ clientId, data, onSaved }) {
  const { computed, target } = currentTarget(data);
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([key]) => [key, target ? String(target[key]) : ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const activity = ACTIVITY.find((a) => a.id === data.activity)?.label;

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast(message);
      onSaved();
    } catch {
      setError('Nije sačuvano. Proveri internet i pokušaj ponovo.');
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    if (busy) return;
    const values = {};
    for (const [key, label, min, max] of FIELDS) {
      const n = wholeNumber(form[key]);
      if (!(n >= min && n <= max)) return setError(`${label}: od ${min} do ${max}.`);
      values[key] = n;
    }
    run(() => setNutritionTarget(clientId, values), 'Cilj sačuvan');
  }

  return (
    <form className="surface col" style={{ gap: 12 }} onSubmit={save} aria-label="Dnevni cilj ishrane">
      <span className="kicker" style={{ color: 'var(--color-accent-700)' }}>Ishrana: dnevni cilj</span>
      {data.sex ? (
        <span className="small muted">
          {data.sex === 'm' ? 'Muškarac' : 'Žena'} · {ageFromBirthYear(data.birthYear)} god · {data.heightCm} cm · {data.weightKg ? `${formatNumber(data.weightKg)} kg` : 'težina nije upisana'} · {activity}
        </span>
      ) : <span className="small muted">Klijent još nije uneo podatke za kalkulator.</span>}
      <span className="small" style={{ fontWeight: 600 }}>
        {computed?.minor ? 'Klijent je mlađi od 18: preporuka se ne računa.'
          : computed ? `Preporuka po formuli: ${formatNumber(computed.kcal, 0)} kcal · P ${computed.protein} · UH ${computed.carbs} · M ${computed.fat} g`
            : 'Preporuka nije dostupna dok ne unese podatke.'}
      </span>
      {computed && !computed.minor && (
        <span className="small muted">
          {goalSummary(data.goal, computed)}
          {computed.proteinBasisKg < data.weightKg && ` · proteini za ${computed.proteinBasisKg} kg (BMI preko 30)`}
        </span>
      )}

      <div className="editor-grid">
        {FIELDS.map(([key, label]) => (
          <div key={key}>
            <label className="field-label" htmlFor={`target-${key}`}>{label}</label>
            <input id={`target-${key}`} className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="numeric"
              value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="pill-btn" disabled={busy}>Sačuvaj cilj</button>
      {data.override && (
        <button type="button" className="text-btn" disabled={busy} onClick={() => run(() => clearNutritionTarget(clientId), 'Vraćeno na preporuku')}>
          Vrati na preporuku
        </button>
      )}
    </form>
  );
}
