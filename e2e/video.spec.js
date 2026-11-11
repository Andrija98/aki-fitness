// Linkovi videa (YouTube i Bunny Stream), bez browsera i baze.

import { test, expect } from '@playwright/test';
import { canonicalVideoUrl, parseVideo, playerUrl, youtubeId } from '../src/lib/video.js';

const GUID = '7a9b2c4d-1e2f-4a3b-9c8d-0123456789ab';

test('YouTube: svi uobičajeni oblici linka daju isti ID i isti sačuvan oblik', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ]) {
    expect(parseVideo(url)).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(canonicalVideoUrl(parseVideo(url))).toBe('https://youtu.be/dQw4w9WgXcQ');
  }
  expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
});

test('Bunny: embed i play linkovi, oba domena, sa parametrima i velikim slovima', () => {
  const expected = { provider: 'bunny', libraryId: '123456', videoId: GUID };
  for (const url of [
    `https://iframe.mediadelivery.net/embed/123456/${GUID}`,
    `https://iframe.mediadelivery.net/play/123456/${GUID}`,
    `https://player.mediadelivery.net/embed/123456/${GUID}?autoplay=true&loop=false`,
    `  https://iframe.mediadelivery.net/embed/123456/${GUID.toUpperCase()}  `,
  ]) {
    expect(parseVideo(url)).toEqual(expected);
    expect(canonicalVideoUrl(parseVideo(url))).toBe(`https://iframe.mediadelivery.net/embed/123456/${GUID}`);
  }
});

test('pogrešni linkovi se odbijaju', () => {
  for (const url of [
    '', null, 'nije link', 'https://vimeo.com/123',
    'https://iframe.mediadelivery.net/embed/123456/nije-guid',
    `https://evil.example/iframe.mediadelivery.net/embed/123456/${GUID}`,
    `https://iframe.mediadelivery.net.evil.example/embed/123456/${GUID}`,
  ]) {
    expect(parseVideo(url)).toBeNull();
  }
});

test('adresa plejera: YouTube bez kolačića, Bunny bez automatskog puštanja', () => {
  expect(playerUrl({ provider: 'youtube', id: 'dQw4w9WgXcQ' })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&modestbranding=1');
  expect(playerUrl({ provider: 'bunny', libraryId: '123456', videoId: GUID }))
    .toBe(`https://iframe.mediadelivery.net/embed/123456/${GUID}?autoplay=false&preload=false&responsive=true`);
});
