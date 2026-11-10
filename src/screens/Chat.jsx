// Razgovor klijent ↔ trener (dizajn 07). Klijent ne prosleđuje clientId; trener prosleđuje ID klijenta.
// Nove poruke stižu preko Realtime-a; ponovno učitavanje na fokus i povratak mreže je rezerva.

import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/useData.js';
import { toast } from '../lib/toast.js';
import { MESSAGES_READ_EVENT } from '../lib/useUnread.js';
import { getMessages, markMessagesRead, onNewMessage, sendMessage } from '../data/api.js';
import { formatDayLabel, formatTime, dateKey } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import LoadError from '../components/LoadError.jsx';
import PhotoViewer from '../components/PhotoViewer.jsx';
import { compressImage } from '../lib/image.js';

export default function Chat({ clientId, header, emptyText }) {
  const { data, error, reload } = useData(() => getMessages(clientId), [clientId]);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [openPhoto, setOpenPhoto] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { if (data) setMessages(data); }, [data]);

  // Nova poruka (i naša, kad stigne preko Realtime-a) dodaje se samo ako je već nemamo.
  useEffect(() => onNewMessage(clientId, (m) => {
    setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
  }), [clientId]);

  useEffect(() => {
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('online', reload); };
  }, [reload]);

  // Dok je razgovor otvoren, tuđe poruke su pročitane.
  const hasUnread = messages?.some((m) => !m.mine && !m.readAt);
  useEffect(() => {
    if (!hasUnread) return;
    markMessagesRead(clientId)
      .then(() => {
        setMessages((list) => list.map((m) => (m.mine || m.readAt ? m : { ...m, readAt: new Date().toISOString() })));
        window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
      })
      .catch(() => {});
  }, [hasUnread, clientId]);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages?.length]);

  if (error && !messages) return <LoadError onRetry={reload} />;
  if (!messages) return null;

  // photo: već smanjen JPEG; tekst iz polja ide uz fotografiju kao natpis.
  async function deliver(photo) {
    const body = text.trim();
    if ((!body && !photo) || sending) return;
    setSending(true);
    try {
      const saved = await sendMessage(body, clientId, photo);
      setMessages((list) => (list.some((x) => x.id === saved.id) ? list : [...list, saved]));
      // Briše se samo poslato: ako je korisnik u međuvremenu kucao dalje, taj tekst ostaje.
      setText((current) => (current.trim() === body ? '' : current));
    } catch {
      toast('Poruka nije poslata. Proveri internet.');
    } finally {
      setSending(false);
    }
  }

  function send(e) {
    e.preventDefault();
    deliver(null);
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || sending) return;
    let photo;
    try {
      photo = await compressImage(file);
    } catch {
      toast('Ovaj format slike nije podržan.');
      return;
    }
    deliver(photo);
  }

  return (
    <div className="screen chat-screen">
      {header}

      <div className="chat-list" aria-live="polite">
        {messages.length === 0 && <p className="muted" style={{ margin: 0, textAlign: 'center' }}>{emptyText}</p>}
        {messages.map((m, i) => {
          const newDay = i === 0 || dateKey(messages[i - 1].createdAt) !== dateKey(m.createdAt);
          return (
            <div key={m.id} className="col" style={{ gap: 10 }}>
              {newDay && <span className="chat-day">{formatDayLabel(m.createdAt)}</span>}
              <div className={`bubble ${m.mine ? 'bubble--out' : 'bubble--in'}${m.photoPath ? ' bubble--photo' : ''}`}>
                {m.photoPath && (
                  <button type="button" className="bubble-photo" onClick={() => setOpenPhoto(m)} aria-label="Otvori fotografiju">
                    {m.photoUrl ? <img src={m.photoUrl} alt="" /> : <span className="small">Fotografija</span>}
                  </button>
                )}
                {m.photoPath ? (m.body && <span className="bubble-caption">{m.body}</span>) : m.body}
                <span className="bubble-time">{formatTime(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form className="chat-composer" onSubmit={send}>
        <label className="round-btn chat-photo-btn">
          <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} disabled={sending} aria-label="Priloži fotografiju" />
          <Icon name="image" size={20} />
        </label>
        <input className="text-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          placeholder="Napiši poruku…" aria-label="Poruka" />
        <button className="round-btn round-btn--accent" style={{ width: 52, height: 52 }} disabled={!text.trim() || sending} aria-label="Pošalji">
          <Icon name="arrowUp" size={20} />
        </button>
      </form>

      {openPhoto && (
        <PhotoViewer url={openPhoto.photoUrl} title={`Fotografija · ${formatDayLabel(openPhoto.createdAt)} ${formatTime(openPhoto.createdAt)}`}
          alt="Fotografija iz poruke" onClose={() => setOpenPhoto(null)} />
      )}
    </div>
  );
}
