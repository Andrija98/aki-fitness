// Generator plana ishrane, bez browsera i baze. Namirnice su sa vrednostima iz USDA seed-a.

import { test, expect } from '@playwright/test';
import { generatePlan, weekdayIndex } from '../src/lib/mealPlan.js';

const ALL = ['dorucak', 'uzina1', 'rucak', 'uzina2', 'vecera'];
const food = (id, group, kcal, protein, carbs, fat, minG, maxG, mealTypes = ALL, extra = {}) =>
  ({ id, name: id, group, kcal, protein, carbs, fat, minG, maxG, mealTypes, verified: true, active: true, ...extra });

const FOODS = [
  food('piletina', 'protein', 120, 22.5, 0, 2.6, 100, 250, ['rucak', 'vecera']),
  food('curetina', 'protein', 114, 23.7, 0.1, 1.5, 100, 250, ['rucak', 'vecera']),
  food('jaja', 'protein', 143, 12.6, 0.7, 9.5, 50, 200, ['dorucak', 'vecera']),
  food('jogurt', 'mlecni', 59, 10.2, 3.6, 0.4, 100, 300, ['dorucak', 'uzina1', 'uzina2']),
  food('ovas', 'uh', 379, 13.2, 67.7, 6.5, 30, 100, ['dorucak']),
  food('pirinac', 'uh', 365, 7.1, 80, 0.7, 40, 120, ['rucak', 'vecera']),
  food('ulje', 'mast', 884, 0, 0, 100, 5, 20, ['dorucak', 'rucak', 'vecera']),
  food('bademi', 'mast', 579, 21.2, 21.6, 49.9, 10, 40, ['dorucak', 'uzina1', 'uzina2']),
  food('brokoli', 'povrce', 34, 2.8, 6.6, 0.4, 100, 300, ['rucak', 'vecera']),
  food('banana', 'voce', 89, 1.1, 22.8, 0.3, 80, 200, ['dorucak', 'uzina1', 'uzina2']),
];
const TEMPLATES = [
  { mealType: 'dorucak', label: 'Doručak', sharePct: 25, timeHint: '08:00', groups: ['protein', 'uh', 'mast'] },
  { mealType: 'uzina1', label: 'Prva užina', sharePct: 10, timeHint: '10:30', groups: ['mlecni', 'voce'] },
  { mealType: 'rucak', label: 'Ručak', sharePct: 30, timeHint: '13:30', groups: ['protein', 'uh', 'povrce', 'mast'] },
  { mealType: 'uzina2', label: 'Druga užina', sharePct: 10, timeHint: '17:00', groups: ['voce', 'mast'] },
  { mealType: 'vecera', label: 'Večera', sharePct: 25, timeHint: '20:00', groups: ['protein', 'povrce', 'mast'] },
];
const ALL_IDS = FOODS.map((f) => f.id);
const within = (actual, goal, pct) => Math.abs(actual - goal) <= goal * pct;

const TARGETS = [
  { name: 'žena, mršavljenje', target: { kcal: 1290, protein: 120, carbs: 125, fat: 35 } },
  { name: 'muškarac, kondicija', target: { kcal: 2760, protein: 130, carbs: 390, fat: 75 } },
  { name: 'muškarac, snaga', target: { kcal: 2400, protein: 145, carbs: 290, fat: 65 } },
];

for (const { name, target } of TARGETS) {
  test(`${name}: svaki dan pogađa kalorije ±10 % i bar 90 % proteina`, () => {
    const { days } = generatePlan({ target, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS });
    expect(days).toHaveLength(7);
    for (const d of days) {
      expect(within(d.totals.kcal, target.kcal, 0.1), `dan ${d.day}: ${Math.round(d.totals.kcal)} kcal`).toBe(true);
      // Manjak proteina je problem (naročito kod mršavljenja); višak nije, pa je granica nesimetrična.
      expect(d.totals.protein, `dan ${d.day}: ${Math.round(d.totals.protein)} g proteina`).toBeGreaterThanOrEqual(target.protein * 0.9);
    }
  });
}

test('kad cilj traži više od najvećih porcija, plan to kaže treneru', () => {
  // 2.760 kcal sa ovim granicama: UH i masti staju na maksimumu, pa ostatak daje protein.
  const { warnings } = generatePlan({ target: TARGETS[1].target, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS });
  expect(warnings).toEqual(['Porcije UH i masti su na maksimumu, pa ostatak kalorija daje protein (više proteina od cilja). Trener može da poveća najveće porcije.']);
  // Sa većim granicama za pirinač i ovas upozorenja nema, a višak proteina je manji
  // (ostaje deo koji nose same UH namirnice: ovas, pirinač, bademi).
  const roomy = FOODS.map((f) => (['pirinac', 'ovas'].includes(f.id) ? { ...f, maxG: 250 } : f));
  const strict = generatePlan({ target: TARGETS[1].target, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS });
  const relaxed = generatePlan({ target: TARGETS[1].target, templates: TEMPLATES, foods: roomy, likedIds: ALL_IDS });
  expect(relaxed.warnings).toEqual([]);
  for (const [i, d] of relaxed.days.entries()) expect(d.totals.protein).toBeLessThan(strict.days[i].totals.protein);
});

test('normalan cilj nema upozorenja', () => {
  for (const t of [TARGETS[0].target, TARGETS[2].target]) {
    expect(generatePlan({ target: t, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS }).warnings).toEqual([]);
  }
});

test('gramaže su unutar granica porcije i zaokružene na 5 g', () => {
  const { days } = generatePlan({ target: TARGETS[1].target, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS });
  for (const item of days.flatMap((d) => d.meals.flatMap((m) => m.items))) {
    const f = FOODS.find((x) => x.id === item.foodId);
    expect(item.grams).toBeGreaterThanOrEqual(f.minG);
    expect(item.grams).toBeLessThanOrEqual(f.maxG);
    expect(item.grams % 5 === 0 || item.grams === f.minG || item.grams === f.maxG).toBe(true);
  }
});

test('namirnice koje klijent voli se smenjuju po danima, a ručak i večera istog dana se razlikuju', () => {
  const { days } = generatePlan({ target: TARGETS[0].target, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS });
  const protein = (d, meal) => d.meals.find((m) => m.mealType === meal).items[0].foodId;
  expect(new Set(days.map((d) => protein(d, 'rucak'))).size).toBeGreaterThan(1);
  for (const d of days) expect(protein(d, 'rucak')).not.toBe(protein(d, 'vecera'));
});

test('koristi samo voljene namirnice, a kad grupa fali, trenerov predlog sa oznakom', () => {
  const liked = ['piletina', 'pirinac', 'jaja', 'ovas', 'jogurt', 'banana', 'ulje', 'brokoli']; // bez badema i ćuretine
  const { days } = generatePlan({ target: TARGETS[0].target, templates: TEMPLATES, foods: FOODS, likedIds: liked });
  const items = days.flatMap((d) => d.meals.flatMap((m) => m.items));
  expect(items.some((it) => it.foodId === 'curetina')).toBe(false); // ima voljeni protein za ručak i večeru
  // Druga užina traži mast, a ulje nije dozvoljeno za užinu: uzima se bademi kao predlog trenera.
  const snackFat = days[0].meals.find((m) => m.mealType === 'uzina2').items.find((it) => it.foodId === 'bademi');
  expect(snackFat).toMatchObject({ suggested: true });
  expect(items.filter((it) => it.foodId === 'piletina').every((it) => !it.suggested)).toBe(true);
});

test('neproverene i neaktivne namirnice se nikad ne koriste', () => {
  const foods = FOODS.map((f) => (f.id === 'piletina' ? { ...f, verified: false } : f.id === 'curetina' ? { ...f, active: false } : f));
  const { days } = generatePlan({ target: TARGETS[0].target, templates: TEMPLATES, foods, likedIds: ALL_IDS });
  const ids = days.flatMap((d) => d.meals.flatMap((m) => m.items.map((it) => it.foodId)));
  expect(ids).not.toContain('piletina');
  expect(ids).not.toContain('curetina');
});

test('grupa bez ijedne proverene namirnice daje upozorenje, a obrok ostaje', () => {
  const foods = FOODS.filter((f) => f.group !== 'povrce');
  const { days, warnings } = generatePlan({ target: TARGETS[0].target, templates: TEMPLATES, foods, likedIds: ALL_IDS });
  expect(warnings).toEqual(['Ručak: nema proverene namirnice iz grupe povrće.', 'Večera: nema proverene namirnice iz grupe povrće.']);
  expect(days[0].meals.find((m) => m.mealType === 'rucak').items.length).toBe(3);
});

test('obrok sa udelom 0 % se preskače', () => {
  const templates = TEMPLATES.map((t) => (t.mealType === 'uzina2' ? { ...t, sharePct: 0 } : t.mealType === 'rucak' ? { ...t, sharePct: 40 } : t));
  const { days } = generatePlan({ target: TARGETS[0].target, templates, foods: FOODS, likedIds: ALL_IDS });
  expect(days[0].meals.map((m) => m.mealType)).toEqual(['dorucak', 'uzina1', 'rucak', 'vecera']);
});

test('isti ulaz uvek daje isti plan, a veći cilj veće porcije', () => {
  const input = { target: TARGETS[0].target, templates: TEMPLATES, foods: FOODS, likedIds: ALL_IDS };
  expect(generatePlan(input)).toEqual(generatePlan(input));
  const small = generatePlan(input).days[0].meals.find((m) => m.mealType === 'rucak').items;
  const big = generatePlan({ ...input, target: TARGETS[1].target }).days[0].meals.find((m) => m.mealType === 'rucak').items;
  const grams = (items, id) => items.find((it) => it.foodId === id)?.grams ?? 0;
  expect(grams(big, 'pirinac')).toBeGreaterThan(grams(small, 'pirinac'));
});

test('dan u nedelji kreće od ponedeljka', () => {
  expect(weekdayIndex(new Date('2026-11-09T12:00:00'))).toBe(0); // ponedeljak
  expect(weekdayIndex(new Date('2026-11-15T12:00:00'))).toBe(6); // nedelja
});
