// Napredak: težina kroz vreme, upis nove težine i istorija treninga.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import { addWeight, getSessions, getWeights } from '../data/api.js';
import { formatDuration, formatNumber, formatShortDate } from '../lib/format.js';
import WeightChart from '../components/WeightChart.jsx';
import Icon from '../components/Icon.jsx';

const PAGE_SIZE = 10;

async function load() {
  const [weights, sessions] = await Promise.all([getWeights(), getSessions()]);
  return { weights, sessions };
}

// Brojevi se ne boje kao dobri ili loši: −3 kg je uspeh za mršavljenje, a neuspeh za masu.
function formatChange(diff) {
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return '±0 kg';
  return `${rounded > 0 ? '+' : '−'}${formatNumber(Math.abs(rounded))} kg`;
}

function setsLabel(n) {
  const lastDigit = n % 10;
  const teens = n % 100 >= 12 && n % 100 <= 14;
  return `${n} ${lastDigit >= 2 && lastDigit <= 4 && !teens ? 'serije' : 'serija'}`;
}

export default function Progress() {
  const { data, reload } = useData(load);
  const [adding, setAdding] = useState(false);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  if (!data) return null;

  const weights = [...data.weights].reverse();
  const sessions = [...data.sessions].reverse();
  const latest = weights[0];

  async function saveWeight(e) {
    e.preventDefault();
    if (saving) return;
    const kg = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) return toast('Unesi ispravnu težinu');
    setSaving(true);
    try {
      await addWeight(kg);
      setWeight('');
      setAdding(false);
      toast('Težina upisana');
      reload();
    } catch {
      toast('Težina nije upisana. Proveri internet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="row between">
        <h1 className="screen-title">Napredak</h1>
        <button className="round-btn round-btn--accent" aria-label="Upiši težinu" aria-expanded={adding} onClick={() => setAdding(!adding)}>
          <Icon name={adding ? 'x' : 'plus'} />
        </button>
      </div>

      {adding && (
        <form className="surface row" style={{ gap: 8 }} onSubmit={saveWeight}>
          <input className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="decimal" autoFocus value={weight}
            onChange={(e) => setWeight(e.target.value)} placeholder="kg danas" aria-label="Težina danas u kilogramima" />
          <button className="round-btn round-btn--accent" style={{ width: 56, height: 56 }} disabled={saving} aria-label="Sačuvaj težinu"><Icon name="check" /></button>
        </form>
      )}

      <div className="surface col" style={{ gap: 12 }}>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="col">
            <span className="small muted" style={{ fontWeight: 600 }}>Težina</span>
            <span className="heading" style={{ fontSize: 30, lineHeight: 1.1 }}>{latest ? `${formatNumber(latest.kg)} kg` : '–'}</span>
          </div>
          {weights.length > 1 && <span className="delta-badge">{formatChange(latest.kg - weights.at(-1).kg)}</span>}
        </div>
        {weights.length > 1 && <WeightChart weights={data.weights} />}
        {weights.length === 1 && <p className="small muted" style={{ margin: 0 }}>Upiši još jednom da vidiš grafikon.</p>}
        {weights.length === 0 && <p className="small muted" style={{ margin: 0 }}>Upiši prvu težinu dugmetom +.</p>}
      </div>

      {weights.length > 0 && (
        <History title="Istorija težine" items={weights} renderItem={(w) => (
          <div key={w.date} className="log-line">
            <span style={{ fontWeight: 600 }}>{formatShortDate(w.date)}</span>
            <span className="muted">{formatNumber(w.kg)} kg</span>
          </div>
        )} />
      )}

      <History title="Istorija treninga" items={sessions} empty="Još nema odrađenih treninga." renderItem={(s) => (
        <div key={s.id} className="log-line">
          <span className="col">
            <span style={{ fontWeight: 600 }}>{s.workoutTitle}</span>
            <span className="small muted">{formatShortDate(s.date)}</span>
          </span>
          <span className="muted" style={{ textAlign: 'right' }}>{formatDuration(s.durationSec || 0)} · {setsLabel(s.sets.length)}</span>
        </div>
      )} />
    </div>
  );
}

function History({ title, items, empty, renderItem }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, PAGE_SIZE);

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="section-head"><span>{title}</span></div>
      {items.length === 0 ? <p className="muted" style={{ margin: 0 }}>{empty}</p> : <div className="surface history">{visible.map(renderItem)}</div>}
      {!showAll && items.length > PAGE_SIZE && (
        <button className="text-btn" onClick={() => setShowAll(true)}>Prikaži sve ({items.length})</button>
      )}
    </div>
  );
}
