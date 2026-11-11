// Trener: vežbe. Nova vežba, izmena naziva i saveta, video (YouTube ili Bunny Stream), brisanje neupotrebljene vežbe. Upis štiti RLS u bazi.
// Upotrebljena vežba se ne briše: na nju su vezani treninzi i serije iz odrađenih treninga.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { createExercise, deleteExercise, getExerciseUsage, getExercises, setExerciseVideo, updateExercise } from '../data/api.js';
import { canonicalVideoUrl, parseVideo } from '../lib/video.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';
import DeleteControl from '../components/DeleteControl.jsx';

const SAVE_ERROR = 'Nije sačuvano. Proveri internet i pokušaj ponovo.';

export default function Exercises() {
  const { data: exercises, error, reload } = useData(getExercises);
  const [adding, setAdding] = useState(false);
  if (error) return <LoadError onRetry={reload} />;
  if (!exercises) return null;

  const withVideo = exercises.filter((e) => e.videoUrl).length;
  const names = exercises.map((e) => e.name);

  async function add(values) {
    await createExercise(values);
    setAdding(false);
    toast('Vežba dodata');
    reload();
  }

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
        <button className="round-btn round-btn--accent" aria-label="Nova vežba" aria-expanded={adding} onClick={() => setAdding(!adding)}>
          <Icon name={adding ? 'x' : 'plus'} />
        </button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">Vežbe</h1>
        <span className="muted">{withVideo} od {exercises.length} vežbi ima video</span>
      </div>

      {adding && (
        <div className="surface">
          <ExerciseForm idPrefix="new" names={names} submitLabel="Dodaj vežbu" onSubmit={add} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="col" style={{ gap: 12 }}>
        {exercises.map((e) => <ExerciseRow key={e.id} exercise={e} names={names} onSaved={reload} />)}
      </div>
    </div>
  );
}

function ExerciseForm({ idPrefix, initial, names, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [cue, setCue] = useState(initial?.cue ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) return setError('Unesi naziv vežbe.');
    const taken = names.some((n) => n !== initial?.name && n.toLowerCase() === trimmed.toLowerCase());
    if (taken) return setError('Vežba sa tim nazivom već postoji.');
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: trimmed, cue: cue.trim() || null });
    } catch {
      setError(SAVE_ERROR);
      setBusy(false);
    }
  }

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-name`}>Naziv vežbe</label>
        <input id={`${idPrefix}-name`} className="text-input" style={{ background: 'var(--color-neutral-100)' }} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-cue`}>Savet za izvođenje</label>
        <input id={`${idPrefix}-cue`} className="text-input" style={{ background: 'var(--color-neutral-100)' }} maxLength={200} value={cue} onChange={(e) => setCue(e.target.value)} />
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="ob-footer">
        <button className="pill-btn" disabled={busy}>{busy ? 'Čuvam…' : submitLabel}</button>
        <button className="text-btn" type="button" onClick={onCancel}>Odustani</button>
      </div>
    </form>
  );
}

function ExerciseRow({ exercise, names, onSaved }) {
  const [url, setUrl] = useState(exercise.videoUrl ?? '');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { id, name, cue, videoUrl } = exercise;
  const savedVideo = parseVideo(videoUrl);

  async function persistVideo(next, message) {
    setBusy(true);
    setError('');
    try {
      await setExerciseVideo(id, next);
      setUrl(next ?? '');
      toast(message);
      onSaved();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function saveVideo(e) {
    e.preventDefault();
    if (busy) return;
    const video = parseVideo(url);
    if (!video) return setError('To nije ispravan YouTube ili Bunny link.');
    persistVideo(canonicalVideoUrl(video), 'Video sačuvan');
  }

  async function saveDetails(values) {
    await updateExercise(id, values);
    setEditing(false);
    toast('Vežba izmenjena');
    onSaved();
  }

  async function exerciseBlockers() {
    const { workouts, sets } = await getExerciseUsage(id);
    const reasons = [];
    if (workouts) reasons.push(`Nalazi se u treninzima (${workouts}). Prvo je ukloni iz njih u Uređivanju treninga.`);
    if (sets) reasons.push(`Klijenti su je radili (broj serija: ${sets}), pa ostaje zbog istorije. Ako je naziv pogrešan, izmeni ga.`);
    return reasons;
  }

  return (
    <div className="surface col" style={{ gap: 10 }}>
      {editing ? (
        <>
          <ExerciseForm idPrefix={id} initial={exercise} names={names} submitLabel="Sačuvaj izmene" onSubmit={saveDetails} onCancel={() => setEditing(false)} />
          <DeleteControl label="Obriši vežbu" checkUsage={exerciseBlockers}
            onDelete={async () => { await deleteExercise(id); toast('Vežba obrisana'); onSaved(); }} />
        </>
      ) : (
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <span className="col" style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700 }}>{name}</span>
            {cue && <span className="small muted">{cue}</span>}
          </span>
          <button className="text-btn" style={{ padding: '0 0 0 10px', flex: 'none' }} aria-label={`Izmeni vežbu ${name}`} onClick={() => setEditing(true)}>Izmeni</button>
        </div>
      )}

      {savedVideo?.provider === 'youtube' && <img className="video-thumb" src={`https://img.youtube.com/vi/${savedVideo.id}/mqdefault.jpg`} alt={`Sličica videa za vežbu ${name}`} />}
      {/* Bunny sličica traži adresu CDN-a biblioteke, koje nema u linku, pa samo oznaka. */}
      {savedVideo?.provider === 'bunny' && <span className="tag tag-neutral" style={{ alignSelf: 'flex-start' }}>Bunny video</span>}
      <form className="row" style={{ gap: 8 }} onSubmit={saveVideo}>
        <input className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="url" autoCapitalize="none" autoCorrect="off" value={url}
          onChange={(e) => setUrl(e.target.value)} placeholder="YouTube ili Bunny link" aria-label={`Link videa za ${name}`} />
        <button className="round-btn round-btn--accent" style={{ width: 56, height: 56 }} disabled={busy} aria-label={`Sačuvaj video za ${name}`}><Icon name="check" /></button>
      </form>
      {error && <p className="login-error" role="alert">{error}</p>}
      {videoUrl && <button className="text-btn" type="button" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} disabled={busy} aria-label={`Ukloni video za ${name}`} onClick={() => persistVideo(null, 'Video uklonjen')}>Ukloni video</button>}
    </div>
  );
}
