// Hook koji zna da li je korisnik prijavljen i prati promene (prijava, odjava, istek sesije).
// session: undefined = još proveravamo, null = nije prijavljen, objekat = prijavljen.

import { useEffect, useState } from 'react';
import { getAuthSession, onAuthChange } from '../data/api.js';

export function useAuth() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then((s) => { if (active) setSession(s); })
      .catch(() => { if (active) setSession(null); });
    const unsubscribe = onAuthChange(setSession);
    return () => { active = false; unsubscribe(); };
  }, []);

  return { session, loading: session === undefined };
}
