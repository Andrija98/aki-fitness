// Privremeni ekran za tabove koji stižu u sledećim fazama (vidi docs/PLAN.md).

import Icon from '../components/Icon.jsx';

export default function ComingSoon({ title, icon, text, phase }) {
  return (
    <div className="screen">
      <h1 className="screen-title">{title}</h1>
      <div className="soon">
        <span className="soon-blob"><Icon name={icon} size={44} /></span>
        <span className="tag tag-accent-2">{phase}</span>
        <h2 style={{ margin: 0, fontSize: 26 }}>Stiže uskoro</h2>
        <p className="muted" style={{ margin: 0, maxWidth: 300 }}>{text}</p>
      </div>
    </div>
  );
}
