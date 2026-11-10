// Fotografija preko celog ekrana (napredak, poruke). children: dugmad ispod slike, npr. brisanje.

import Icon from './Icon.jsx';

export default function PhotoViewer({ url, title, alt, onClose, children }) {
  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="row between">
        <span style={{ fontWeight: 700 }}>{title}</span>
        <button type="button" className="round-btn" onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>
      </div>
      {url && <img src={url} alt={alt ?? title} />}
      {children}
    </div>
  );
}
