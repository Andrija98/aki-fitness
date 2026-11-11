import { parseVideo, playerUrl } from '../lib/video.js';

// Prugasto polje iz dizajna: stoji umesto slike ili videa dok ih trener ne doda.
// tone: 'accent' | 'sage' | 'neutral' | 'dark'
export function Striped({ tone = 'accent', label, className = '', style, children }) {
  const toneClass = { accent: '', sage: 'striped--sage', neutral: 'striped--neutral', dark: 'striped--dark', strong: 'striped--accent' }[tone] ?? '';
  return (
    <div className={`striped ${toneClass} ${className}`} style={style} aria-hidden={!children ? 'true' : undefined}>
      {label}
      {children}
    </div>
  );
}

// Video (YouTube ili Bunny Stream) ako postoji link, inače placeholder sa natpisom.
export function VideoPlayer({ url, label }) {
  const video = parseVideo(url);
  if (video) {
    return (
      <iframe
        src={playerUrl(video)}
        title={label}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <Striped tone="dark" label={label} />;
}
