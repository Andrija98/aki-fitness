// Mali hash router (bez biblioteke), da se vidi kako routing radi.
// Adrese izgledaju ovako:  #/treninzi   #/program/masa   #/trening/masa/noge
// Prednost hash-a: radi na bilo kom hostingu bez podešavanja, a Android "nazad" dugme radi samo od sebe.

import { useEffect, useState } from 'react';

function parse() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'pocetna', params: parts.slice(1) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(...parts) {
  window.location.hash = '/' + parts.map(encodeURIComponent).join('/');
}

export function back(fallback = 'pocetna') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}

export const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/');
