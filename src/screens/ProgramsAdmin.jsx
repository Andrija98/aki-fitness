// Trener: lista programa za uređivanje, sa oznakom Objavljen ili Nacrt.

import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { getProgramsAdmin } from '../data/api.js';
import Icon from '../components/Icon.jsx';

export default function ProgramsAdmin() {
  const { data: programs } = useData(getProgramsAdmin);
  if (!programs) return null;

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
        <button className="round-btn round-btn--accent" aria-label="Novi program" onClick={() => navigate('trener-program', 'novi')}><Icon name="plus" /></button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">Uređivanje programa</h1>
        <span className="muted">Nacrte klijenti ne vide</span>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {programs.map((p) => (
          <button key={p.id} className="workout-row" onClick={() => navigate('trener-program', p.id)}>
            <span className="col" style={{ flex: 1, gap: 4 }}>
              <span style={{ fontWeight: 700 }}>{p.title}</span>
              <span className="small muted">{p.weeks} ned. · {p.perWeek}× nedeljno · {p.schedule.length} u rasporedu</span>
            </span>
            <span className={`tag ${p.published ? 'tag-accent-2' : 'tag-neutral'}`}>{p.published ? 'Objavljen' : 'Nacrt'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
