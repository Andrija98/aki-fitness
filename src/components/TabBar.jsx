import Icon from './Icon.jsx';
import { href } from '../lib/router.js';
import { TRAINER_NAME } from '../config.js';

const TABS = [
  { route: 'pocetna', label: 'Početna', icon: 'home' },
  { route: 'treninzi', label: 'Treninzi', icon: 'dumbbell' },
  { route: 'ishrana', label: 'Ishrana', icon: 'utensils' },
  { route: 'napredak', label: 'Napredak', icon: 'chart' },
  { route: 'poruke', label: TRAINER_NAME, icon: 'message' },
];

export default function TabBar({ active }) {
  return (
    <nav className="tabbar" aria-label="Glavna navigacija">
      {TABS.map((t) => (
        <a key={t.route} href={href(t.route)} className={active === t.route ? 'on' : ''} aria-current={active === t.route ? 'page' : undefined}>
          <Icon name={t.icon} size={24} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}
