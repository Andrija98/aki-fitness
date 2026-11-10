// Treninzi: pretraga, filter po mestu, aktivni program i lista svih programa.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { navigate } from '../lib/router.js';
import { getPrograms, getActiveProgramId, getProgramProgress } from '../data/api.js';
import { Striped } from '../components/Media.jsx';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

const FILTERS = [['sve', 'Sve'], ['kuca', 'Kod kuće'], ['teretana', 'Teretana']];
const LOCATION_LABEL = { kuca: 'Kod kuće', teretana: 'Teretana' };

async function load() {
  const [programs, activeId] = await Promise.all([getPrograms(), getActiveProgramId()]);
  const active = activeId ? await getProgramProgress(activeId) : null;
  return { programs, active };
}

export default function Programs() {
  const { data, error, reload } = useData(load);
  const [filter, setFilter] = useState('sve');
  const [query, setQuery] = useState('');
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;

  const q = query.trim().toLowerCase();
  const list = data.programs.filter((p) =>
    (filter === 'sve' || p.location === filter) &&
    (!q || p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)) // opis nije obavezan
  );
  const { active } = data;

  return (
    <div className="screen">
      <h1 className="screen-title">Treninzi</h1>

      <label className="search">
        <Icon name="search" size={18} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pretraži programe" aria-label="Pretraži programe" />
      </label>

      <div className="chips" role="tablist" aria-label="Filter">
        {FILTERS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {active && (
        <button className="my-program" onClick={() => navigate('program', active.program.id)}>
          <div className="row between" style={{ width: '100%' }}>
            <span className="kicker">Tvoj program</span>
            <span className="small" style={{ fontWeight: 700 }}>{active.percent}%</span>
          </div>
          <span className="heading" style={{ fontSize: 23, lineHeight: 1.1 }}>{active.program.title} — {active.program.weeks} nedelje</span>
          <div className="bar" style={{ width: '100%' }}><div style={{ width: `${active.percent}%` }} /></div>
          <span className="small">Nedelja {active.week} · {active.done} od {active.total} treninga</span>
        </button>
      )}

      <div className="col" style={{ gap: 14 }}>
        {list.map((p) => (
          <button key={p.id} className="program-item" onClick={() => navigate('program', p.id)}>
            <Striped tone={p.tone} label="thumbnail" className="program-thumb" />
            <span className="col" style={{ gap: 5, flex: 1 }}>
              <span className="program-name">{p.title}</span>
              <span className="small muted">{p.weeks} nedelja · {p.perWeek}× nedeljno</span>
              <span className="row" style={{ gap: 6 }}>
                <span className={`tag ${p.location === 'kuca' ? 'tag-accent' : 'tag-accent-2'}`}>{LOCATION_LABEL[p.location]}</span>
                <span className="tag tag-neutral">{p.level}</span>
              </span>
            </span>
          </button>
        ))}
        {!list.length && <p className="muted">Nema programa za ovu pretragu.</p>}
      </div>
    </div>
  );
}
