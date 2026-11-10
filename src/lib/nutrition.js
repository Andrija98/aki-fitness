// Kalkulator dnevnog cilja: kalorije i makroi. Čista funkcija, bez React-a i baze, da može da se testira.
// Okvirna preporuka, ne medicinski savet; trener može da je zameni svojim brojevima.

import { formatNumber, GOAL_LABEL } from './format.js';

export const ACTIVITY = [
  { id: 'sedeci', label: 'Sedeći', hint: 'Kancelarija, malo kretanja', factor: 1.2 },
  { id: 'lako', label: 'Lako aktivan', hint: 'Trening 1–3 puta nedeljno', factor: 1.375 },
  { id: 'umereno', label: 'Umereno aktivan', hint: 'Trening 3–5 puta nedeljno', factor: 1.55 },
  { id: 'aktivno', label: 'Aktivan', hint: 'Trening 6–7 puta nedeljno', factor: 1.725 },
  { id: 'veoma', label: 'Veoma aktivan', hint: 'Fizički posao i svakodnevni trening', factor: 1.9 },
];

export const FOOD_GROUPS = [
  { id: 'protein', label: 'Protein' },
  { id: 'uh', label: 'Ugljeni hidrati' },
  { id: 'mast', label: 'Mast' },
  { id: 'povrce', label: 'Povrće' },
  { id: 'voce', label: 'Voće' },
  { id: 'mlecni', label: 'Mlečni proizvodi' },
];

export const MEAL_TYPES = [
  { id: 'dorucak', label: 'Doručak' },
  { id: 'uzina1', label: 'Prva užina' },
  { id: 'rucak', label: 'Ručak' },
  { id: 'uzina2', label: 'Druga užina' },
  { id: 'vecera', label: 'Večera' },
];

// Kalorije iz makroa: 4 kcal po gramu proteina i UH, 9 po gramu masti.
export function kcalFromMacros(protein, carbs, fat) {
  return 4 * protein + 4 * carbs + 9 * fat;
}

// Hvata greške u kucanju (npr. 320 g proteina umesto 32). Vlakna i alkohol prave malo odstupanje,
// pa dozvoljavamo 15 %, a kod namirnica sa vrlo malo kalorija (povrće) 10 kcal.
export function macrosMatchKcal({ kcal, protein, carbs, fat }) {
  const diff = Math.abs(kcalFromMacros(protein, carbs, fat) - kcal);
  return diff <= Math.max(10, kcal * 0.15);
}

const GOAL_FACTOR = { mrsavljenje: 0.8, snaga: 1.1, kondicija: 1 };
const PROTEIN_PER_KG = { mrsavljenje: 2.0, snaga: 1.8, kondicija: 1.6 };
const MIN_KCAL = { m: 1500, z: 1200 };
const FAT_SHARE = 0.25;
// Iznad BMI 30 proteini se računaju za težinu koja odgovara BMI 25, inače bi 2 g/kg kod 120 kg dalo 240 g.
const PROTEIN_BMI_LIMIT = 30;
const PROTEIN_BMI_BASIS = 25;
export const MIN_AGE = 18;

const round5 = (x) => Math.round(x / 5) * 5;
const round10 = (x) => Math.round(x / 10) * 10;

// Godine iz godine rođenja: može da odstupi za jednu godinu, što je za ovu formulu zanemarljivo.
export function ageFromBirthYear(birthYear, now = new Date()) {
  return now.getFullYear() - birthYear;
}

// Težina za koju se računaju proteini (kg).
export function proteinBasisKg(weightKg, heightCm) {
  const h = heightCm / 100;
  return weightKg / (h * h) > PROTEIN_BMI_LIMIT ? Math.round(PROTEIN_BMI_BASIS * h * h) : weightKg;
}

// Vraća null ako fali podatak, { minor: true } ispod 18 godina,
// inače { kcal, protein, carbs, fat, bmr, tdee, proteinBasisKg, atMinimum }.
export function calculateTargets({ sex, age, heightCm, weightKg, activity, goal }) {
  const factor = ACTIVITY.find((a) => a.id === activity)?.factor;
  if (!sex || !age || !heightCm || !weightKg || !factor || !GOAL_FACTOR[goal]) return null;
  if (age < MIN_AGE) return { minor: true };

  // Mifflin-St Jeor: osnovni metabolizam (kcal dnevno u mirovanju).
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
  const tdee = bmr * factor;
  const atMinimum = tdee * GOAL_FACTOR[goal] < MIN_KCAL[sex];
  const kcal = round10(Math.max(MIN_KCAL[sex], tdee * GOAL_FACTOR[goal]));
  const basis = proteinBasisKg(weightKg, heightCm);
  const protein = round5(basis * PROTEIN_PER_KG[goal]);
  const fat = round5((kcal * FAT_SHARE) / 9);
  const carbs = Math.max(0, round5((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee), proteinBasisKg: basis, atMinimum };
}

// Jedan red koji objašnjava odakle broj kalorija, npr. "Mršavljenje · 550 kcal manje od potrošnje (2.760)".
export function goalSummary(goal, computed) {
  const label = GOAL_LABEL[goal] ?? '';
  const tdee = formatNumber(computed.tdee, 0);
  if (computed.atMinimum) return `${label} · donja granica od ${formatNumber(computed.kcal, 0)} kcal (potrošnja ${tdee})`;
  const delta = computed.kcal - computed.tdee;
  if (goal === 'kondicija') return `${label} · održavanje, koliko trošiš (${tdee} kcal)`;
  return `${label} · ${formatNumber(Math.abs(delta), 0)} kcal ${delta < 0 ? 'manje' : 'više'} od potrošnje (${tdee})`;
}
