// Kratka poruka na dnu ekrana ("Trening sačuvan").
// Bilo gde: import { toast } from '../lib/toast.js'; toast('Sačuvano');
// Prikazuje je App.jsx preko hook-a useToast().

import { useEffect, useState } from 'react';

const listeners = new Set();

export function toast(message) {
  listeners.forEach((fn) => fn(message));
}

export function useToast() {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    let timer;
    const show = (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 2200);
    };
    listeners.add(show);
    return () => { listeners.delete(show); clearTimeout(timer); };
  }, []);
  return message;
}
