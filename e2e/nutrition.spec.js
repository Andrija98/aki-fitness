// Formula kalkulatora, bez browsera i baze. Očekivane vrednosti su izračunate ručno, korak po korak.

import { test, expect } from '@playwright/test';
import { calculateTargets, ageFromBirthYear } from '../src/lib/nutrition.js';

test('muškarac, kondicija: Mifflin-St Jeor × aktivnost, bez korekcije', () => {
  // BMR = 10·80 + 6,25·180 − 5·30 + 5 = 1780; × 1,55 = 2759 → 2760 kcal
  // proteini 1,6·80 = 128 → 130 g; masti 25 % = 76,7 → 75 g; UH (2760 − 520 − 675) / 4 = 391 → 390 g
  expect(calculateTargets({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 'umereno', goal: 'kondicija' }))
    .toEqual({ kcal: 2760, protein: 130, carbs: 390, fat: 75, bmr: 1780, tdee: 2759 });
});

test('muškarac, mršavljenje: −20 % i više proteina', () => {
  // 2759 · 0,8 = 2207 → 2210 kcal; proteini 2,0·80 = 160 g; masti 61,4 → 60 g; UH (2210 − 640 − 540) / 4 = 257,5 → 260 g
  expect(calculateTargets({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 'umereno', goal: 'mrsavljenje' }))
    .toMatchObject({ kcal: 2210, protein: 160, carbs: 260, fat: 60 });
});

test('žena, snaga: +10 %', () => {
  // BMR = 600 + 1031,25 − 125 − 161 = 1345,25; × 1,375 = 1849,7; × 1,1 = 2034,7 → 2030 kcal
  // proteini 1,8·60 = 108 → 110 g; masti 56,4 → 55 g; UH (2030 − 440 − 495) / 4 = 273,75 → 275 g
  expect(calculateTargets({ sex: 'z', age: 25, heightCm: 165, weightKg: 60, activity: 'lako', goal: 'snaga' }))
    .toMatchObject({ kcal: 2030, protein: 110, carbs: 275, fat: 55 });
});

test('donja granica: žena ne ide ispod 1.200 kcal', () => {
  // BMR = 450 + 937,5 − 300 − 161 = 926,5; × 1,2 × 0,8 = 889 → podiže se na 1200
  expect(calculateTargets({ sex: 'z', age: 60, heightCm: 150, weightKg: 45, activity: 'sedeci', goal: 'mrsavljenje' }))
    .toMatchObject({ kcal: 1200 });
});

test('donja granica: muškarac ne ide ispod 1.500 kcal', () => {
  expect(calculateTargets({ sex: 'm', age: 70, heightCm: 160, weightKg: 50, activity: 'sedeci', goal: 'mrsavljenje' }))
    .toMatchObject({ kcal: 1500 });
});

test('ispod 18 godina nema preporuke, a fali li podatak, nema ni računa', () => {
  expect(calculateTargets({ sex: 'm', age: 17, heightCm: 175, weightKg: 65, activity: 'aktivno', goal: 'snaga' })).toEqual({ minor: true });
  expect(calculateTargets({ sex: 'm', age: 30, heightCm: null, weightKg: 80, activity: 'umereno', goal: 'snaga' })).toBeNull();
  expect(calculateTargets({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 'nepostojeca', goal: 'snaga' })).toBeNull();
});

test('godine iz godine rođenja', () => {
  expect(ageFromBirthYear(1995, new Date('2026-11-09'))).toBe(31);
});
