// Predlog programa posle onboardinga, bez browsera i baze.

import { test, expect } from '@playwright/test';
import { pickSuggestedProgram } from '../src/lib/programs.js';

const p = (title, location, level) => ({ id: title, title, location, level });
const PROGRAMS = [ // abecedno, kao u aplikaciji
  p('Kućni svi nivoi', 'kuca', 'Svi nivoi'),
  p('Kućni za početnike', 'kuca', 'Početnik'),
  p('Teretana napredni', 'teretana', 'Napredni'),
  p('Teretana srednji', 'teretana', 'Srednji'),
];

test('mesto i nivo se poklapaju: taj program', () => {
  expect(pickSuggestedProgram(PROGRAMS, { location: 'kuca', level: 'pocetnik' }).title).toBe('Kućni za početnike');
  expect(pickSuggestedProgram(PROGRAMS, { location: 'teretana', level: 'srednji' }).title).toBe('Teretana srednji');
});

test('nema programa za taj nivo: program za sve nivoe na istom mestu, pre programa sa drugog mesta', () => {
  expect(pickSuggestedProgram(PROGRAMS, { location: 'kuca', level: 'napredni' }).title).toBe('Kućni svi nivoi');
  // Kod kuće se teretana ne može odraditi, čak ni kad joj nivo odgovara.
  expect(pickSuggestedProgram([p('Teretana početnici', 'teretana', 'Početnik'), p('Kuća napredni', 'kuca', 'Napredni')],
    { location: 'kuca', level: 'pocetnik' }).title).toBe('Kuća napredni');
});

test('klijent koji trenira na oba mesta dobija program po nivou', () => {
  expect(pickSuggestedProgram(PROGRAMS, { location: 'oba', level: 'napredni' }).title).toBe('Teretana napredni');
});

test('isti rezultat: prvi u listi; nema programa: null; program bez mesta i nivoa važi svuda', () => {
  expect(pickSuggestedProgram([p('A', 'kuca', 'Početnik'), p('B', 'kuca', 'Početnik')], { location: 'kuca', level: 'pocetnik' }).title).toBe('A');
  expect(pickSuggestedProgram([], { location: 'kuca', level: 'pocetnik' })).toBeNull();
  expect(pickSuggestedProgram([p('Opšti', null, null)], { location: 'teretana', level: 'srednji' }).title).toBe('Opšti');
});
