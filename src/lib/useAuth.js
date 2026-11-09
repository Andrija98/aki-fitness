// Hook koji zna da li je korisnik prijavljen i prati promene (prijava, odjava, istek sesije).
// session: undefined = još proveravamo, null = nije prijavljen, objekat = prijavljen.
// recovering: korisnik je došao sa linka za oporavak i mora da postavi novu lozinku.

import { useCallback, useEffect, useState } from 'react';
import { getAuthSession, onAuthChange } from '../data/api.js';

export function useAuth() {
  const [session, setSession] = useState(undefined);
  // Adresu čitamo i odmah, jer događaj PASSWORD_RECOVERY može da stigne pre nego što se prijavimo na njega.
  const [recovering, setRecovering] = useState(() => window.location.hash.includes('type=recovery'));

  useEffect(() => {
    let active = true;
    const apply = (s, event) => {
      setSession(s);
      setRecovering((r) => event === 'PASSWORD_RECOVERY' || (r && Boolean(s)));
    };
    getAuthSession()
      .then((s) => { if (active) apply(s); })
      .catch(() => { if (active) apply(null); });
    const unsubscribe = onAuthChange(apply);
    return () => { active = false; unsubscribe(); };
  }, []);

  const finishRecovery = useCallback(() => setRecovering(false), []);

  return { session, loading: session === undefined, recovering, finishRecovery };
}
