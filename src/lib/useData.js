// Hook za učitavanje async podataka iz api.js.
// Upotreba:  const { data, loading, reload } = useData(() => getProgram(id), [id]);

import { useCallback, useEffect, useState } from 'react';

export function useData(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => reload(), [reload]);

  return { data, loading, error, reload };
}
