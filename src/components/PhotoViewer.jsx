// Fotografija preko celog ekrana (napredak, poruke). children: dugmad ispod slike, npr. brisanje.
// Escape zatvara, a fokus odmah ide na "Zatvori", da tastatura i čitač ekrana ne ostanu na stranici ispod.

import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

export function useCloseOnEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export function CloseButton({ onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <button ref={ref} type="button" className="round-btn" onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>;
}

export default function PhotoViewer({ url, title, alt, onClose, children }) {
  useCloseOnEscape(onClose);
  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="row between">
        <span style={{ fontWeight: 700 }}>{title}</span>
        <CloseButton onClose={onClose} />
      </div>
      {url && <img src={url} alt={alt ?? title} />}
      {children}
    </div>
  );
}
