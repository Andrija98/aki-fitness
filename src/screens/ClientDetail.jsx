// Trener: napredak jednog klijenta. Isti prikaz kao klijentov Napredak, samo bez unosa.

import { useData } from '../lib/useData.js';
import { back } from '../lib/router.js';
import { getClient } from '../data/api.js';
import { GOAL_LABEL } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import Progress from './Progress.jsx';

export default function ClientDetail({ clientId }) {
  const { data: client, loading } = useData(() => getClient(clientId), [clientId]);
  if (loading) return null;
  if (!client) return <div className="screen"><p>Klijent nije pronađen.</p></div>;

  const header = (
    <>
      <div className="row between">
        <button className="round-btn" onClick={() => back('klijenti')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">{client.name}</h1>
        <span className="muted">{GOAL_LABEL[client.goal] ?? 'Cilj nije izabran'}</span>
      </div>
    </>
  );

  return <Progress userId={client.id} readOnly header={header} />;
}
