// Kalkulator dnevnog cilja: kalorije i makroi. Čista funkcija, bez React-a i baze, da može da se testira.
// Okvirna preporuka, ne medicinski savet; trener može da je zameni svojim brojevima.

export const ACTIVITY = [
  { id: 'sedeci', label: 'Sedeći', hint: 'Kancelarija, malo kretanja', factor: 1.2 },
  { id: 'lako', label: 'Lako aktivan', hint: 'Trening 1–3 puta nedeljno', factor: 1.375 },
  { id: 'umereno', label: 'Umereno aktivan', hint: 'Trening 3–5 puta nedeljno', factor: 1.55 },
  { id: 'aktivno', label: 'Aktivan', hint: 'Trening 6–7 puta nedeljno', factor: 1.725 },
  { id: 'veoma', label: 'Veoma aktivan', hint: 'Fizički posao i svakodnevni trening', factor: 1.9 },
];

const GOAL_FACTOR = { mrsavljenje: 0.8, snaga: 1.1, kondicija: 1 };
const PROTEIN_PER_KG = { mrsavljenje: 2.0, snaga: 1.8, kondicija: 1.6 };
const MIN_KCAL = { m: 1500, z: 1200 };
const FAT_SHARE = 0.25;
export const MIN_AGE = 18;

const round5 = (x) => Math.round(x / 5) * 5;
const round10 = (x) => Math.round(x / 10) * 10;

// Godine iz godine rođenja: može da odstupi za jednu godinu, što je za ovu formulu zanemarljivo.
export function ageFromBirthYear(birthYear, now = new Date()) {
  return now.getFullYear() - birthYear;
}

// Vraća null ako fali podatak, { minor: true } ispod 18 godina, inače { kcal, protein, carbs, fat, bmr, tdee }.
export function calculateTargets({ sex, age, heightCm, weightKg, activity, goal }) {
  const factor = ACTIVITY.find((a) => a.id === activity)?.factor;
  if (!sex || !age || !heightCm || !weightKg || !factor || !GOAL_FACTOR[goal]) return null;
  if (age < MIN_AGE) return { minor: true };

  // Mifflin-St Jeor: osnovni metabolizam (kcal dnevno u mirovanju).
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
  const tdee = bmr * factor;
  const kcal = round10(Math.max(MIN_KCAL[sex], tdee * GOAL_FACTOR[goal]));
  const protein = round5(weightKg * PROTEIN_PER_KG[goal]);
  const fat = round5((kcal * FAT_SHARE) / 9);
  const carbs = Math.max(0, round5((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}
