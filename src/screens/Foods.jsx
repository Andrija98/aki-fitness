// Trener: namirnice po grupama. Vrednosti su na 100 g u sirovom / suvom stanju.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { getFoods } from '../data/api.js';
import { FOOD_GROUPS } from '../lib/nutrition.js';
import { formatNumber } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

export default function Foods() {
  const { data: foods, error, reload } = useData(getFoods);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  if (error) return <LoadError onRetry={reload} />;
  if (!foods) return null;

  const verified = foods.filter((f) => f.verified && f.active).length;
  const active = foods.filter((f) => f.active).length;
  const shown = onlyUnverified ? foods.filter((f) => !f.verified) : foods;

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
        <button className="round-btn round-btn--accent" aria-label="Nova namirnica" onClick={() => navigate('namirnica', 'nova')}><Icon name="plus" /></button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">Namirnice</h1>
        <span className="muted">{verified} od {active} aktivnih je provereno · vrednosti na 100 g, sirovo</span>
      </div>
      <div className="chips" role="tablist" aria-label="Filter">
        <button role="tab" aria-selected={!onlyUnverified} className={`chip ${!onlyUnverified ? 'on' : ''}`} onClick={() => setOnlyUnverified(false)}>Sve</button>
        <button role="tab" aria-selected={onlyUnverified} className={`chip ${onlyUnverified ? 'on' : ''}`} onClick={() => setOnlyUnverified(true)}>Neproverene</button>
      </div>

      {FOOD_GROUPS.map((g) => {
        const items = shown.filter((f) => f.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} className="col" style={{ gap: 8 }} aria-label={g.label}>
            <div className="section-head"><span>{g.label}</span><span className="small muted">{items.length}</span></div>
            {items.map((f) => (
              <button key={f.id} className="workout-row" onClick={() => navigate('namirnica', f.id)} style={{ opacity: f.active ? 1 : 0.55 }}>
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{f.name}</span>
                  <span className="small muted">{formatNumber(f.kcal, 0)} kcal · P {formatNumber(f.protein)} · UH {formatNumber(f.carbs)} · M {formatNumber(f.fat)}</span>
                </span>
                {!f.active ? <span className="tag tag-neutral">Neaktivna</span> : !f.verified && <span className="tag tag-accent">Neproverena</span>}
              </button>
            ))}
          </section>
        );
      })}
      {!shown.length && <p className="muted" style={{ margin: 0 }}>{onlyUnverified ? 'Sve namirnice su proverene.' : 'Još nema namirnica.'}</p>}
    </div>
  );
}
