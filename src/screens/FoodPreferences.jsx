// Klijent: namirnice koje voli. Prikazuju se samo one koje je trener proverio.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getFoodPreferences, getFoods, getMealTemplates, saveFoodPreferences } from '../data/api.js';
import { FOOD_GROUPS, MEAL_TYPES } from '../lib/nutrition.js';
import { TRAINER_NAME } from '../config.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

async function load() {
  const [foods, liked, templates] = await Promise.all([getFoods(), getFoodPreferences(), getMealTemplates()]);
  return { foods: foods.filter((f) => f.verified && f.active), liked, templates };
}

const mealLabel = (id) => MEAL_TYPES.find((m) => m.id === id)?.label ?? id;

export default function FoodPreferences() {
  const { data, error, reload } = useData(load);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  return <Picker {...data} />;
}

function Picker({ foods, liked, templates }) {
  const [selected, setSelected] = useState(() => new Set(liked));
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Grupe koje plan koristi, a klijent iz njih nije ništa izabrao: tu će ići trenerov predlog.
  const usedGroups = new Set(templates.filter((t) => t.sharePct > 0).flatMap((t) => t.groups));
  const emptyGroups = FOOD_GROUPS.filter((g) => usedGroups.has(g.id) && !foods.some((f) => f.group === g.id && selected.has(f.id)));

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await saveFoodPreferences([...selected]);
      toast('Izbor sačuvan');
      navigate('ishrana');
    } catch {
      toast('Nije sačuvano. Proveri internet.');
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('ishrana')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="screen-title">Namirnice koje voliš</h1>
        <p className="muted" style={{ margin: 0 }}>Čekiraj šta rado jedeš. Plan se pravi od tvog izbora, a gramaže se računaju prema tvom cilju.</p>
      </div>

      {!foods.length && <p className="muted" style={{ margin: 0 }}>{TRAINER_NAME} još priprema namirnice za plan.</p>}

      {FOOD_GROUPS.map((g) => {
        const items = foods.filter((f) => f.group === g.id);
        if (!items.length) return null;
        return (
          <fieldset key={g.id} className="pref-group">
            <legend className="section-head" style={{ width: '100%' }}><span>{g.label}</span></legend>
            {items.map((f) => (
              <label key={f.id} className="pref-row">
                <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className="small muted">{f.mealTypes.map(mealLabel).join(' · ')}</span>
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}

      {foods.length > 0 && emptyGroups.length > 0 && (
        <p className="editor-note" role="note">
          Nisi izabrao ništa iz: {emptyGroups.map((g) => g.label.toLowerCase()).join(', ')}. Tu će plan koristiti {TRAINER_NAME}jev predlog.
        </p>
      )}
      {foods.length > 0 && (
        <button className="pill-btn pill-btn--accent" disabled={busy} onClick={save}>{busy ? 'Čuvam…' : `Sačuvaj izbor (${selected.size})`}</button>
      )}
    </div>
  );
}
