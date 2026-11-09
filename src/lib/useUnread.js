// Broj nepročitanih poruka za tab. Osvežava se na novu poruku, kad razgovor označi pročitano,
// i kad se aplikacija vrati u fokus (rezerva ako Realtime veza pukne).

import { useEffect, useState } from 'react';
import { getUnreadCount, onNewMessage } from '../data/api.js';

export const MESSAGES_READ_EVENT = 'messages-read';

export function useUnread(isTrainer, enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const refresh = () => getUnreadCount(isTrainer).then((n) => { if (active) setCount(n); }).catch(() => {});
    refresh();
    const unsubscribe = onNewMessage(null, refresh);
    window.addEventListener(MESSAGES_READ_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener(MESSAGES_READ_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isTrainer, enabled]);

  return count;
}
