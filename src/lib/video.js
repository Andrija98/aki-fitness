// Video vežbe: YouTube ili Bunny Stream. Čiste funkcije (testovi u e2e/video.spec.js).
// U bazi (exercises.video_url) se čuva jedan, isti oblik linka za svakog pružaoca (canonicalVideoUrl).

// YouTube: youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID, /live/ID (ID ima 11 znakova).
export function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Bunny Stream: iframe.mediadelivery.net ili player.mediadelivery.net, /embed/ ili /play/, broj biblioteke i GUID videa.
const BUNNY = /^https?:\/\/(?:iframe|player)\.mediadelivery\.net\/(?:embed|play)\/(\d{1,12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#].*)?$/i;

// { provider: 'bunny', libraryId, videoId } | { provider: 'youtube', id } | null
export function parseVideo(url) {
  const text = String(url ?? '').trim();
  if (!text) return null;
  const bunny = text.match(BUNNY);
  if (bunny) return { provider: 'bunny', libraryId: bunny[1], videoId: bunny[2].toLowerCase() };
  const id = youtubeId(text);
  return id ? { provider: 'youtube', id } : null;
}

// Oblik u kome se link čuva u bazi.
export function canonicalVideoUrl(video) {
  if (!video) return null;
  return video.provider === 'bunny'
    ? `https://iframe.mediadelivery.net/embed/${video.libraryId}/${video.videoId}`
    : `https://youtu.be/${video.id}`;
}

// Adresa plejera za <iframe>. YouTube u režimu bez kolačića; Bunny bez automatskog puštanja i bez unapred učitavanja
// (štedi mobilni internet dok klijent ne pritisne Play).
export function playerUrl(video) {
  return video.provider === 'bunny'
    ? `https://iframe.mediadelivery.net/embed/${video.libraryId}/${video.videoId}?autoplay=false&preload=false&responsive=true`
    : `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&playsinline=1&modestbranding=1`;
}
