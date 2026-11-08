import { youtubeId } from '../lib/format.js';

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

// YouTube video ako postoji link, inače placeholder sa natpisom.
export function VideoPlayer({ url, label }) {
  const id = youtubeId(url);
  if (id) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&modestbranding=1`}
        title={label}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <Striped tone="dark" label={label} />;
}
