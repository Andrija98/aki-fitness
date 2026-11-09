// Detalj programa: opis, napredak i redosled treninga. Ovde se program i aktivira.

import { useData } from '../lib/useData.js';
import { navigate, back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getProgramProgress, getWorkout, getActiveProgramId, setActiveProgram } from '../data/api.js';
import { Striped } from '../components/Media.jsx';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';

async function load(programId) {
  const progress = await getProgramProgress(programId);
  if (!progress) return { progress: null };
  const uniqueIds = [...new Set(progress.program.schedule)];
  const workouts = Object.fromEntries(await Promise.all(uniqueIds.map(async (id) => [id, await getWorkout(id)])));
  const isActive = (await getActiveProgramId()) === programId;
  return { progress, workouts, isActive };
}

export default function ProgramDetail({ programId }) {
  const { data, error, reload } = useData(() => load(programId), [programId]);
  if (error) return <LoadError onRetry={reload} />;
  if (!data) return null;
  if (!data.progress) return <div className="screen"><p>Program nije pronađen.</p></div>;

  const { progress, workouts, isActive } = data;
  const { program } = progress;
  // Prikazujemo jednu "rundu" rasporeda, sa oznakom šta je sledeće.
  const nextIndex = progress.done % program.schedule.length;

  async function activate() {
    try {
      await setActiveProgram(program.id);
    } catch {
      return toast('Program nije aktiviran. Proveri internet.');
    }
    toast('Program aktiviran');
    reload();
  }

  return (
    <div className="screen">
      <Striped tone={program.tone === 'neutral' ? 'neutral' : program.tone} label="naslovna fotografija programa" className="hero">
        <div className="hero-top">
          <button className="round-btn" onClick={() => back('treninzi')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
        </div>
      </Striped>

      <div className="col" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className={`tag ${program.location === 'kuca' ? 'tag-accent' : 'tag-accent-2'}`}>{program.location === 'kuca' ? 'Kod kuće' : 'Teretana'}</span>
          <span className="tag tag-neutral">{program.level}</span>
        </div>
        <h1 className="screen-title">{program.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{program.description}</p>
      </div>

      <div className="stat-grid">
        <div><span className="stat-value">{program.weeks}</span><span className="stat-label">Nedelja</span></div>
        <div><span className="stat-value">{program.perWeek}×</span><span className="stat-label">Nedeljno</span></div>
        <div><span className="stat-value">{progress.done}/{progress.total}</span><span className="stat-label">Odrađeno</span></div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        <div className="section-head"><span>Raspored</span><span className="small muted">ponavlja se</span></div>
        {program.schedule.map((wid, i) => {
          const w = workouts[wid];
          const isNext = isActive && i === nextIndex;
          return (
            <button key={i} className={`workout-row ${isNext ? 'next' : ''}`} onClick={() => navigate('trening', program.id, wid)}>
              <span className="workout-num">{i + 1}</span>
              <span className="col" style={{ flex: 1 }}>
                <span style={{ fontWeight: 700 }}>{w.title}</span>
                <span className="small muted">{w.minutes} min · {w.items.length} vežbi · {w.equipment}</span>
              </span>
              {isNext ? <span className="tag tag-accent">Sledeći</span> : <Icon name="chevronRight" size={20} style={{ color: 'var(--color-neutral-600)' }} />}
            </button>
          );
        })}
      </div>

      {isActive ? (
        <button className="pill-btn pill-btn--accent" onClick={() => navigate('trening', program.id, progress.nextWorkoutId)}>
          <Icon name="play" size={18} /> Počni sledeći trening
        </button>
      ) : (
        <button className="pill-btn" onClick={activate}>Izaberi ovaj program</button>
      )}
    </div>
  );
}
