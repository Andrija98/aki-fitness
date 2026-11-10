// Fotografije napretka na ekranu Napredak: dodavanje (klijent), mreža sličica, pregled preko celog ekrana,
// brisanje i poređenje dve fotografije (pre i posle). Trener ih vidi u profilu klijenta, samo za gledanje.

import { useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import { addProgressPhoto, deleteProgressPhoto, getProgressPhotos } from '../data/api.js';
import { compressImage } from '../lib/image.js';
import { formatShortDate } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import PhotoViewer from '../components/PhotoViewer.jsx';

export default function ProgressPhotos({ userId, readOnly }) {
  const { data: photos, error, reload } = useData(() => getProgressPhotos(userId), [userId]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);          // fotografija u pregledu
  const [comparing, setComparing] = useState(null); // prva izabrana za poređenje; čeka se druga
  const [pair, setPair] = useState(null);          // [starija, novija] u prikazu poređenja
  if (error || !photos) return null; // greška se ne prikazuje dvaput: ekran već ima ostale podatke

  async function add(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // isti fajl može da se izabere ponovo
    if (!file || busy) return;
    setBusy(true);
    try {
      let blob;
      try {
        blob = await compressImage(file);
      } catch {
        toast('Ovaj format slike nije podržan.');
        return;
      }
      await addProgressPhoto(blob);
      toast('Fotografija dodata');
      reload();
    } catch {
      toast('Fotografija nije sačuvana. Proveri internet.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo) {
    try {
      await deleteProgressPhoto(photo);
      setOpen(null);
      toast('Fotografija obrisana');
      reload();
    } catch {
      toast('Nije obrisano. Proveri internet.');
    }
  }

  function pick(photo) {
    if (!comparing) return setOpen(photo);
    if (photo.id === comparing.id) return setComparing(null);
    // Starija levo: lista je od najnovije, pa je veći indeks stariji.
    const older = photos.indexOf(photo) > photos.indexOf(comparing) ? photo : comparing;
    setPair([older, older === photo ? comparing : photo]);
    setComparing(null);
  }

  return (
    <section className="col" style={{ gap: 10 }} aria-label="Fotografije napretka">
      <div className="section-head">
        <span>Fotografije</span>
        {photos.length > 1 && (
          <button type="button" className="text-btn" style={{ padding: 0, minHeight: 0 }} onClick={() => setComparing(comparing ? null : photos[0])}>
            {comparing ? 'Otkaži' : 'Uporedi'}
          </button>
        )}
      </div>
      {comparing && <p className="small muted" style={{ margin: 0 }}>Izaberi drugu fotografiju za poređenje.</p>}

      {photos.length > 0 ? (
        <div className="photo-grid">
          {photos.map((p) => (
            <button key={p.id} type="button" className={`photo-thumb${comparing?.id === p.id ? ' on' : ''}`} onClick={() => pick(p)}
              aria-label={`Fotografija od ${formatShortDate(p.date)}`} aria-pressed={comparing ? comparing.id === p.id : undefined}>
              {p.url && <img src={p.url} alt="" loading="lazy" />}
              <span className="photo-date">{formatShortDate(p.date)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {readOnly ? 'Još nema fotografija.' : 'Fotografija na mesec dana najbolje pokazuje promenu. Vidiš ih samo ti i trener.'}
        </p>
      )}

      {!readOnly && (
        <label className="pill-btn photo-add">
          <input type="file" accept="image/*" className="sr-only" onChange={add} disabled={busy} />
          {busy ? 'Šaljem…' : 'Dodaj fotografiju'}
        </label>
      )}

      {open && <Viewer photo={open} readOnly={readOnly} onClose={() => setOpen(null)} onDelete={() => remove(open)} />}
      {pair && <Compare pair={pair} onClose={() => setPair(null)} />}
    </section>
  );
}

function Viewer({ photo, readOnly, onClose, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <PhotoViewer url={photo.url} title={`Fotografija od ${formatShortDate(photo.date)}`}
      alt={`Fotografija napretka od ${formatShortDate(photo.date)}`} onClose={onClose}>
      {!readOnly && (confirming ? (
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="pill-btn" style={{ flex: 1 }} onClick={() => setConfirming(false)}>Ne</button>
          <button type="button" className="pill-btn pill-btn--accent" style={{ flex: 1 }} onClick={onDelete}>Da, obriši</button>
        </div>
      ) : (
        <button type="button" className="text-btn" style={{ color: 'var(--color-neutral-300)' }} onClick={() => setConfirming(true)}>Obriši fotografiju</button>
      ))}
    </PhotoViewer>
  );
}

function Compare({ pair, onClose }) {
  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Poređenje fotografija">
      <div className="row between">
        <span style={{ fontWeight: 700 }}>Pre i posle</span>
        <button type="button" className="round-btn" onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>
      </div>
      <div className="photo-compare">
        {pair.map((p) => (
          <figure key={p.id}>
            {p.url && <img src={p.url} alt={`Fotografija od ${formatShortDate(p.date)}`} />}
            <figcaption>{formatShortDate(p.date)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
