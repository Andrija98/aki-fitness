// Trener: sanduče sa razgovorima i razgovor sa jednim klijentom.

import { useEffect } from 'react';
import { useData } from '../lib/useData.js';
import { back, navigate } from '../lib/router.js';
import { getClient, getInbox, onNewMessage } from '../data/api.js';
import { GOAL_LABEL, formatDayLabel } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';
import Chat from './Chat.jsx';

export default function Inbox() {
  const { data: threads, error, reload } = useData(getInbox);
  useEffect(() => onNewMessage(null, reload), [reload]);
  if (error && !threads) return <LoadError onRetry={reload} />;
  if (!threads) return null;

  return (
    <div className="screen">
      <h1 className="screen-title">Poruke</h1>
      {threads.length === 0 && <p className="muted" style={{ margin: 0 }}>Još nema klijenata.</p>}
      <div className="col" style={{ gap: 10 }}>
        {threads.map((t) => (
          <button key={t.id} className="workout-row" onClick={() => navigate('poruke', t.id)}>
            <span className="avatar" aria-hidden="true">{t.name.charAt(0).toUpperCase()}</span>
            <span className="col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700 }}>{t.name}</span>
              <span className="small muted thread-preview">{t.lastBody ?? 'Nema poruka'}</span>
            </span>
            <span className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
              {t.lastAt && <span className="small muted">{formatDayLabel(t.lastAt)}</span>}
              {t.unread > 0 && <span className="tab-badge tab-badge--inline" aria-label={`nepročitanih: ${t.unread}`}>{t.unread}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ClientChat({ clientId }) {
  const { data: client, loading, error, reload } = useData(() => getClient(clientId), [clientId]);
  if (error) return <LoadError onRetry={reload} />;
  if (loading) return null;
  if (!client) return <div className="screen"><p>Klijent nije pronađen.</p></div>;

  const header = (
    <div className="row" style={{ gap: 12 }}>
      <button className="round-btn" onClick={() => back('poruke')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      <span className="col">
        <span className="heading" style={{ fontSize: 20 }}>{client.name}</span>
        <span className="small muted">{GOAL_LABEL[client.goal] ?? 'Klijent'}</span>
      </span>
    </div>
  );
  return <Chat clientId={clientId} header={header} emptyText="Još nema poruka. Napiši prvu." />;
}
