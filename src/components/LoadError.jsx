// Prikazuje se kad podaci nisu učitani (najčešće nema interneta), umesto praznog ekrana.
// Sam pokušava ponovo kad se mreža vrati; dugme je za slučaj kad mreža postoji, ali ne radi.

import { useEffect } from 'react';

export default function LoadError({ onRetry }) {
  useEffect(() => {
    window.addEventListener('online', onRetry);
    return () => window.removeEventListener('online', onRetry);
  }, [onRetry]);

  return (
    <div className="screen">
      <h1 className="ob-title">Nema veze</h1>
      <p className="muted" style={{ margin: 0 }}>Podaci nisu učitani. Proveri internet i pokušaj ponovo.</p>
      <button className="pill-btn" style={{ marginTop: 'auto' }} onClick={onRetry}>Pokušaj ponovo</button>
    </div>
  );
}
