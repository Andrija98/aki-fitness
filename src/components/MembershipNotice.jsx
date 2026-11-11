// Članarina: traka na Početnoj (ističe uskoro / istekla, još ima pristup) i ekran umesto zaključanog sadržaja.

import { navigate } from '../lib/router.js';
import { membershipLabel } from '../lib/membership.js';
import { formatDate } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';

export function MembershipBanner({ status }) {
  if (!status || !['expiring', 'grace'].includes(status.state)) return null;
  return (
    <button type="button" className="membership-banner" onClick={() => navigate('clanarina')}>
      <span className="col" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ fontWeight: 700 }}>{membershipLabel(status)}</span>
        {/* formatDate već završava tačkom ("9. novembar 2026.") */}
        <span className="small">Plaćeno do {formatDate(status.paidUntil)} Dodirni za uplatu.</span>
      </span>
    </button>
  );
}

export function MembershipLocked({ status }) {
  return (
    <div className="screen">
      <div className="col" style={{ gap: 8 }}>
        <h1 className="screen-title">Članarina je istekla</h1>
        <p className="muted" style={{ margin: 0 }}>
          Plaćeno do {formatDate(status.paidUntil)} Treninzi i ishrana su zaključani dok {TRAINER_NAME} ne evidentira uplatu.
          Napredak, poruke i profil i dalje rade.
        </p>
      </div>
      <button type="button" className="pill-btn pill-btn--accent" onClick={() => navigate('clanarina')}>Plati članarinu</button>
      <button type="button" className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }} onClick={() => navigate('poruke')}>
        Piši {TRAINER_NAME}ju
      </button>
    </div>
  );
}
