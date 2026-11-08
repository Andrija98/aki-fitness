// Jedan Supabase klijent za celu aplikaciju. Koristi ga samo data sloj (src/data/api.js).
// Vrednosti dolaze iz .env.local (lokalno) ili iz Netlify Environment variables (produkcija).
// VITE_ promenljive završavaju u javnom JS-u: ovde sme samo anon ključ, nikad service_role.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Nedostaju VITE_SUPABASE_URL ili VITE_SUPABASE_ANON_KEY. Proveri .env.local i restartuj dev server.');
}

export const supabase = createClient(url, anonKey);
