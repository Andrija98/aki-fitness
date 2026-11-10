// Tekst cilja stavke treninga, bez browsera i baze.

import { test, expect } from '@playwright/test';
import { formatTarget } from '../src/lib/format.js';

test('cilj vežbe: raspon, tačan broj, sekunde i oblik reči "serija"', () => {
  expect(formatTarget({ sets: 4, reps: 10, repsMax: 12, seconds: null })).toBe('4 serije × 10–12 ponavljanja');
  expect(formatTarget({ sets: 3, reps: 10, repsMax: null, seconds: null })).toBe('3 serije × 10 ponavljanja');
  expect(formatTarget({ sets: 3, reps: null, repsMax: null, seconds: 30 })).toBe('3 serije × 30 s');
  expect(formatTarget({ sets: 1, reps: 15, repsMax: null, seconds: null })).toBe('1 serija × 15 ponavljanja');
  expect(formatTarget({ sets: 5, reps: 8, repsMax: 12, seconds: null })).toBe('5 serija × 8–12 ponavljanja');
  expect(formatTarget({ sets: 12, reps: 5, repsMax: null, seconds: null })).toBe('12 serija × 5 ponavljanja');
});
