// Trener: lista treninga za uređivanje.

import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { getWorkoutsOverview } from '../data/api.js';
import Icon from '../components/Icon.jsx';

function exercisesLabel(n) {
  const lastDigit = n % 10;
  const teens = n % 100 >= 11 && n % 100 <= 14;
  if (lastDigit === 1 && !teens) return `${n} vežba`;
  if (lastDigit >= 2 && lastDigit <= 4 && !teens) return `${n} vežbe`;
  return `${n} vežbi`;
}

export default function WorkoutsAdmin() {
  const { data: workouts } = useData(getWorkoutsOverview);
  if (!workouts) return null;

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
        <button className="round-btn round-btn--accent" aria-label="Novi trening" onClick={() => navigate('trener-trening', 'novi')}><Icon name="plus" /></button>
      </div>
      <h1 className="screen-title">Uređivanje treninga</h1>

      <div className="col" style={{ gap: 10 }}>
        {workouts.map((w) => (
          <button key={w.id} className="workout-row" onClick={() => navigate('trener-trening', w.id)}>
            <span className="col" style={{ flex: 1 }}>
              <span style={{ fontWeight: 700 }}>{w.title}</span>
              <span className="small muted">
                {exercisesLabel(w.itemCount)}{w.minutes ? ` · ${w.minutes} min` : ''} · {w.programCount ? `u programa: ${w.programCount}` : 'nije u programu'}
              </span>
            </span>
            <Icon name="chevronRight" size={20} style={{ color: 'var(--color-neutral-600)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
