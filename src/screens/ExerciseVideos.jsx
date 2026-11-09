// Trener: YouTube link za svaku vežbu. Ruta je dostupna samo treneru, a upis štiti RLS u bazi.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { getExercises, setExerciseVideo } from '../data/api.js';
import { youtubeId } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

export default function ExerciseVideos() {
  const { data: exercises, reload } = useData(getExercises);
  if (!exercises) return null;

  const withVideo = exercises.filter((e) => e.videoUrl).length;

  return (
    <div className="screen">
      <div className="row between">
        <button className="round-btn" onClick={() => back('profil')} aria-label="Nazad"><Icon name="chevronLeft" /></button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="screen-title">Video snimci vežbi</h1>
        <span className="muted">{withVideo} od {exercises.length} vežbi ima video</span>
      </div>
      <div className="col" style={{ gap: 12 }}>
        {exercises.map((e) => <ExerciseRow key={e.id} exercise={e} onSaved={reload} />)}
      </div>
    </div>
  );
}

function ExerciseRow({ exercise, onSaved }) {
  const [url, setUrl] = useState(exercise.videoUrl ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { id, name, videoUrl } = exercise;
  const savedVideoId = youtubeId(videoUrl);

  async function persist(next, message) {
    setBusy(true);
    setError('');
    try {
      await setExerciseVideo(id, next);
      setUrl(next ?? '');
      toast(message);
      onSaved();
    } catch {
      setError('Video nije sačuvan. Proveri internet i pokušaj ponovo.');
    } finally {
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    if (busy) return;
    const videoId = youtubeId(url.trim());
    if (!videoId) return setError('To nije ispravan YouTube link.');
    persist(`https://youtu.be/${videoId}`, 'Video sačuvan');
  }

  return (
    <form className="surface col" style={{ gap: 10 }} onSubmit={save}>
      <span style={{ fontWeight: 700 }}>{name}</span>
      {savedVideoId && <img className="video-thumb" src={`https://img.youtube.com/vi/${savedVideoId}/mqdefault.jpg`} alt={`Sličica videa za vežbu ${name}`} />}
      <div className="row" style={{ gap: 8 }}>
        <input className="text-input" style={{ background: 'var(--color-neutral-100)' }} inputMode="url" autoCapitalize="none" autoCorrect="off" value={url}
          onChange={(e) => setUrl(e.target.value)} placeholder="YouTube link" aria-label={`YouTube link za ${name}`} />
        <button className="round-btn round-btn--accent" style={{ width: 56, height: 56 }} disabled={busy} aria-label={`Sačuvaj video za ${name}`}><Icon name="check" /></button>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      {videoUrl && <button className="text-btn" type="button" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} disabled={busy} aria-label={`Ukloni video za ${name}`} onClick={() => persist(null, 'Video uklonjen')}>Ukloni video</button>}
    </form>
  );
}
