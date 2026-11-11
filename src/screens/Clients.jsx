// Trener: lista klijenata, prvi su oni koji najduže nisu trenirali.

import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { getClients } from '../data/api.js';
import { GOAL_LABEL, dateKey, formatDaysAgo } from '../lib/format.js';
import { membershipStatus } from '../lib/membership.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

// Kratka oznaka samo kad treba reagovati: ističe uskoro, istekla (još ima pristup) ili zaključano.
function membershipTag(paidUntil, today) {
  const s = membershipStatus(paidUntil, today);
  if (s.state === 'expiring') return s.daysLeft === 0 ? 'ističe danas' : `ističe za ${s.daysLeft} d`;
  if (s.state === 'grace') return 'istekla';
  if (s.state === 'locked') return 'zaključano';
  return null;
}

function sessionsLabel(n) {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'trening' : 'treninga'}`;
}

export default function Clients() {
  const { data: clients, error, reload } = useData(getClients);
  if (error) return <LoadError onRetry={reload} />;
  if (!clients) return null;
  const today = dateKey(new Date());

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">Klijenti</h1>
        <span className="muted">Prvi su oni koji najduže nisu trenirali</span>
      </div>

      {clients.length === 0 && <p className="muted" style={{ margin: 0 }}>Još nema klijenata.</p>}
      <div className="col" style={{ gap: 10 }}>
        {clients.map((c) => (
          <button key={c.id} className="workout-row" onClick={() => navigate('klijent', c.id)}>
            <span className="avatar" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
            <span className="col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700 }}>{c.name}</span>
              <span className="small muted">{GOAL_LABEL[c.goal]} · {sessionsLabel(c.sessionCount)}</span>
              {membershipTag(c.paidUntil, today) && <span className="tag tag-accent" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Članarina: {membershipTag(c.paidUntil, today)}</span>}
            </span>
            <span className="small" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{c.lastSessionAt ? formatDaysAgo(c.lastSessionAt) : 'bez treninga'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
