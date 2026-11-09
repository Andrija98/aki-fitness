// Početna: pozdrav, današnji trening iz aktivnog programa, nedelja i dve statistike.

import { useData } from '../lib/useData.js';
import { navigate, href } from '../lib/router.js';
import { getActiveProgramId, getProgramProgress, getWorkout, getSessions, getWeights } from '../data/api.js';
import { formatLongDate, currentWeek, dateKey, DAY_LETTERS, formatNumber } from '../lib/format.js';
import { TRAINER_NAME } from '../config.js';
import { Striped } from '../components/Media.jsx';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

async function loadHome() {
  const programId = await getActiveProgramId();
  const progress = programId ? await getProgramProgress(programId) : null;
  const workout = progress ? await getWorkout(progress.nextWorkoutId) : null;
  const [sessions, weights] = await Promise.all([getSessions(), getWeights()]);
  return { progress, workout, sessions, weights };
}

export default function Home({ profile }) {
  const { data, error, reload } = useData(loadHome);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  const { progress, workout, sessions, weights } = data;

  const week = currentWeek();
  const doneDays = new Set(sessions.map((s) => dateKey(s.date)));
  const todayKey = dateKey(new Date());
  const doneThisWeek = week.filter((d) => doneDays.has(dateKey(d))).length;

  const lastWeight = weights.at(-1);
  const weightDiff = weights.length > 1 ? lastWeight.kg - weights[0].kg : null;

  return (
    <div className="screen">
      <div className="row between">
        <div className="col">
          <span className="small muted">{formatLongDate()}</span>
          <h1 className="screen-title" style={{ fontSize: 30 }}>Zdravo, {profile.name}</h1>
        </div>
        <a className="avatar" href={href('profil')} aria-label="Profil" style={{ textDecoration: 'none' }}>
          {profile.name.charAt(0).toUpperCase()}
        </a>
      </div>

      {workout ? (
        <button className="today-card" onClick={() => navigate('trening', progress.program.id, workout.id)}>
          <Striped tone="strong" className="today-media">
            <span className="tag-dark">video · {TRAINER_NAME}</span>
            <span className="tag-light">Trening {Math.min(progress.done + 1, progress.total)} / {progress.total}</span>
          </Striped>
          <div className="today-body">
            <div className="col" style={{ flex: 1, gap: 2 }}>
              <span className="kicker" style={{ opacity: 0.85 }}>Današnji trening</span>
              <span className="heading" style={{ fontSize: 22, lineHeight: 1.1 }}>{workout.title}</span>
              <span className="small" style={{ opacity: 0.9 }}>{workout.minutes} min · {workout.items.length} vežbi · {workout.equipment}</span>
            </div>
            <span className="play-circle"><Icon name="play" /></span>
          </div>
        </button>
      ) : (
        <button className="pill-btn" onClick={() => navigate('treninzi')}>Izaberi program</button>
      )}

      <div className="col" style={{ gap: 10 }}>
        <div className="section-head">
          <span>Ova nedelja</span>
          <span className="small" style={{ fontWeight: 600, color: 'var(--color-accent-2-700)' }}>
            {doneThisWeek} od {profile.perWeek ?? 3} treninga
          </span>
        </div>
        <div className="week">
          {week.map((d, i) => {
            const key = dateKey(d);
            const done = doneDays.has(key);
            const isToday = key === todayKey;
            return (
              <div key={key}>
                <span className={isToday ? 'today-l' : 'dl'}>{DAY_LETTERS[i]}</span>
                <span className={`dot ${done ? 'done' : ''} ${isToday && !done ? 'today' : ''}`}>
                  {done ? <Icon name="check" size={16} /> : d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="duo">
        <div style={{ background: 'var(--color-surface)' }}>
          <span className="small muted" style={{ fontWeight: 600 }}>Tvoj program</span>
          <span className="heading" style={{ fontSize: 24 }}>
            {progress ? progress.percent : 0}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> %</span>
          </span>
          <div className="bar"><div style={{ width: `${progress?.percent ?? 0}%` }} /></div>
        </div>
        <div style={{ background: 'var(--color-accent-2-200)' }}>
          <span className="small" style={{ fontWeight: 600, color: 'var(--color-accent-2-800)' }}>Težina</span>
          <span className="heading" style={{ fontSize: 24, color: 'var(--color-accent-2-900)' }}>
            {lastWeight ? formatNumber(lastWeight.kg) : '–'}<span className="small" style={{ fontFamily: 'var(--font-body)' }}> kg</span>
          </span>
          <span className="small" style={{ fontWeight: 700, color: 'var(--color-accent-2-800)' }}>
            {!lastWeight ? 'Upiši u profilu' : weightDiff === null ? 'Početna težina' :`${weightDiff > 0 ? '+' : ''}${formatNumber(weightDiff)} kg od starta`}
          </span>
        </div>
      </div>
    </div>
  );
}
