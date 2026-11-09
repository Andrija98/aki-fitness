// Video trening: vežba po vežba, serija po serija.
// Tok: upišeš ponavljanja i kilažu → "Završi seriju" → pauza sa odbrojavanjem → sledeća serija.
// Na kraju se trening čuva (saveSession) i prikazuje rezime.

import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/useData.js';
import { navigate, back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getWorkout, getLastSets, saveSession } from '../data/api.js';
import { formatClock, formatDuration, formatNumber } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';
import { Striped, VideoPlayer } from '../components/Media.jsx';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

async function load(workoutId) {
  const workout = await getWorkout(workoutId);
  if (!workout) return { workout: null };
  // Prošli put po vežbi, da predložimo istu kilažu.
  const history = {};
  for (const it of workout.items) history[it.exerciseId] = await getLastSets(it.exerciseId);
  return { workout, history };
}

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export default function WorkoutSession({ programId, workoutId }) {
  const { data, error, reload } = useData(() => load(workoutId), [workoutId]);
  const [exIndex, setExIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [logged, setLogged] = useState([]);
  const [input, setInput] = useState({ reps: '', kg: '' });
  const [rest, setRest] = useState(null); // { left, total } dok traje pauza
  const [finished, setFinished] = useState(null); // sačuvan trening
  const [unsaved, setUnsaved] = useState(null); // trening čije čuvanje nije uspelo, čeka ponovni pokušaj
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());

  const workout = data?.workout;
  const item = workout?.items[exIndex];
  const timed = item?.seconds != null;

  // Predlog vrednosti za trenutnu seriju: prethodna serija danas → prošli trening → plan trenera.
  function defaultsFor(it, setNo, loggedNow) {
    const today = loggedNow.filter((l) => l.exerciseId === it.exerciseId).at(-1);
    const past = data.history[it.exerciseId]?.[setNo] ?? data.history[it.exerciseId]?.at(-1);
    const target = it.seconds ?? it.reps;
    const kg = today?.kg ?? past?.kg ?? it.kg ?? '';
    return { reps: String(target), kg: kg === '' || kg === 0 ? '' : String(kg) };
  }

  useEffect(() => {
    if (workout) setInput(defaultsFor(workout.items[0], 0, []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout]);

  // Odbrojavanje pauze
  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) {
      setRest(null);
      navigator.vibrate?.(200);
      return;
    }
    const t = setTimeout(() => setRest((r) => r && { ...r, left: r.left - 1 }), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  if (!workout) return <div className="screen screen--no-tabbar"><p>Trening nije pronađen.</p></div>;
  if (finished) return <Summary session={finished} workout={workout} />;

  function goTo(ex, set, loggedNow) {
    setExIndex(ex);
    setSetIndex(set);
    setInput(defaultsFor(workout.items[ex], set, loggedNow));
  }

  async function completeSet() {
    const entry = {
      exerciseId: item.exerciseId,
      setNo: setIndex + 1,
      ...(timed ? { seconds: num(input.reps) } : { reps: num(input.reps) }),
      kg: num(input.kg),
    };
    const loggedNow = [...logged, entry];
    setLogged(loggedNow);

    const lastSet = setIndex + 1 >= item.sets;
    const lastExercise = exIndex + 1 >= workout.items.length;
    if (lastSet && lastExercise) return finish(loggedNow);

    if (lastSet) goTo(exIndex + 1, 0, loggedNow);
    else goTo(exIndex, setIndex + 1, loggedNow);
    if (item.rest) setRest({ left: item.rest, total: item.rest });
  }

  function finish(loggedNow) {
    if (!loggedNow.length) return toast('Nijedna serija nije odrađena');
    setRest(null);
    persist({
      programId,
      workoutId,
      durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      sets: loggedNow,
    });
  }

  async function persist(session) {
    if (saving) return;
    setSaving(true);
    try {
      setFinished(await saveSession(session));
      setUnsaved(null);
    } catch {
      setUnsaved(session);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (!logged.length || window.confirm('Prekinuti trening? Odrađene serije se neće sačuvati.')) back('pocetna');
  }

  if (unsaved) {
    return (
      <div className="screen screen--no-tabbar">
        <h1 className="ob-title">Trening nije sačuvan</h1>
        <p className="muted" style={{ margin: 0 }}>Proveri internet. Serije su i dalje tu dok ne zatvoriš ovaj ekran.</p>
        <div className="ob-footer" style={{ marginTop: 'auto' }}>
          <button className="pill-btn" disabled={saving} onClick={() => persist(unsaved)}>{saving ? 'Čuvam…' : 'Pokušaj ponovo'}</button>
          <button className="text-btn" onClick={() => { if (window.confirm('Odustati? Odrađene serije se neće sačuvati.')) back('pocetna'); }}>Odustani</button>
        </div>
      </div>
    );
  }

  const next = workout.items[exIndex + 1];
  const setsDoneHere = logged.filter((l) => l.exerciseId === item.exerciseId && l.setNo <= item.sets).length;

  return (
    <div className="session">
      <div className="video-area">
        <VideoPlayer url={item.videoUrl} label={`${TRAINER_NAME}jev video · ${item.name.toLowerCase()}`} />
        <div className="video-top">
          <button className="round-btn round-btn--dark" onClick={close} aria-label="Prekini trening"><Icon name="x" size={20} /></button>
          <span className="video-badge">Vežba {exIndex + 1} od {workout.items.length}</span>
        </div>
      </div>

      <div className="session-body">
        <div className="col" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 700, color: 'var(--color-accent-700)' }}>{workout.title}</span>
          <h1 style={{ margin: 0, fontSize: 28 }}>{item.name}</h1>
          {item.cue && <span className="small muted">{item.cue}</span>}
        </div>

        <div className="set-dots" aria-label={`Serija ${setIndex + 1} od ${item.sets}`}>
          {Array.from({ length: item.sets }, (_, i) => (
            <span key={i} className={i < setsDoneHere ? 'done' : i === setIndex ? 'cur' : ''} />
          ))}
        </div>

        <div className="set-inputs">
          <div>
            <span className="stat-value">{setIndex + 1}/{item.sets}</span>
            <span className="stat-label">Serija</span>
          </div>
          <label>
            <div>
              <input inputMode="numeric" value={input.reps} onChange={(e) => setInput({ ...input, reps: e.target.value })} aria-label={timed ? 'Sekundi' : 'Ponavljanja'} />
              <span className="stat-label">{timed ? 'Sekundi' : 'Ponavljanja'}</span>
            </div>
          </label>
          <label>
            <div>
              <input inputMode="decimal" value={input.kg} placeholder="—" onChange={(e) => setInput({ ...input, kg: e.target.value })} aria-label="Teg u kilogramima" />
              <span className="stat-label">Teg (kg)</span>
            </div>
          </label>
        </div>

        {next ? (
          <div className="next-up">
            <Striped tone="sage" className="next-thumb" />
            <div className="col" style={{ flex: 1 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>Sledeće</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{next.name}</span>
            </div>
            <span className="small muted" style={{ fontWeight: 600 }}>Pauza {item.rest}s</span>
          </div>
        ) : (
          <div className="next-up">
            <div className="col" style={{ flex: 1 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>Poslednja vežba</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Još malo, skoro si gotov!</span>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <button className="round-btn" disabled={exIndex === 0} onClick={() => goTo(exIndex - 1, 0, logged)} aria-label="Prethodna vežba"><Icon name="skipBack" /></button>
        <button className="big-btn" onClick={completeSet} aria-label="Završi seriju"><Icon name="check" size={34} /></button>
        <button className="round-btn"
          onClick={() => (next ? goTo(exIndex + 1, 0, logged) : finish(logged))}
          aria-label={next ? 'Preskoči vežbu' : 'Završi trening'}><Icon name="skipForward" /></button>
      </div>

      {rest && <RestOverlay rest={rest} nextLabel={`${item.name} · serija ${setIndex + 1}`}
        onAdd={() => setRest({ left: rest.left + 15, total: rest.total + 15 })} onSkip={() => setRest(null)} />}
    </div>
  );
}

function RestOverlay({ rest, nextLabel, onAdd, onSkip }) {
  const pct = (rest.left / rest.total) * 100;
  return (
    <div className="rest" role="dialog" aria-label="Pauza">
      <span className="kicker" style={{ color: 'var(--color-accent-2-700)' }}>Pauza</span>
      <div className="rest-ring" style={{ background: `conic-gradient(var(--color-accent) 0 ${pct}%, var(--color-neutral-300) ${pct}% 100%)` }}>
        <div><span className="rest-time" aria-live="polite">{formatClock(rest.left)}</span></div>
      </div>
      <span className="muted">Sledeće: <b style={{ color: 'var(--color-text)' }}>{nextLabel}</b></span>
      <div className="row" style={{ width: '100%', maxWidth: 320 }}>
        <button className="pill-btn" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }} onClick={onAdd}>+15 s</button>
        <button className="pill-btn pill-btn--accent" onClick={onSkip}>Preskoči</button>
      </div>
    </div>
  );
}

function Summary({ session, workout }) {
  const sets = session.sets;
  const volume = sets.reduce((sum, s) => sum + (s.kg || 0) * (s.reps || 0), 0);
  const byExercise = workout.items
    .map((it) => ({ name: it.name, sets: sets.filter((s) => s.exerciseId === it.exerciseId) }))
    .filter((e) => e.sets.length);

  return (
    <div className="screen screen--no-tabbar">
      <div className="ob-blob" aria-hidden="true" />
      <div className="col" style={{ gap: 8, position: 'relative' }}>
        <span className="kicker" style={{ color: 'var(--color-accent-700)' }}>Trening završen</span>
        <h1 className="ob-title">Bravo!</h1>
        <p className="muted" style={{ margin: 0 }}>{workout.title} je sačuvan. {TRAINER_NAME} vidi tvoj napredak.</p>
      </div>

      <div className="stat-grid" style={{ position: 'relative' }}>
        <div><span className="stat-value">{formatDuration(session.durationSec)}</span><span className="stat-label">Trajanje</span></div>
        <div><span className="stat-value">{sets.length}</span><span className="stat-label">Serija</span></div>
        <div><span className="stat-value">{formatNumber(volume, 0)}</span><span className="stat-label">kg ukupno</span></div>
      </div>

      <div className="surface">
        {byExercise.map((e) => (
          <div key={e.name} className="log-line">
            <span style={{ fontWeight: 600 }}>{e.name}</span>
            <span className="muted">
              {e.sets.map((s) => (s.seconds != null ? `${s.seconds}s` : s.kg ? `${formatNumber(s.kg)}×${s.reps}` : s.reps)).join(', ')}
            </span>
          </div>
        ))}
      </div>

      <button className="pill-btn" style={{ marginTop: 'auto' }} onClick={() => navigate('pocetna')}>Na početnu</button>
    </div>
  );
}
