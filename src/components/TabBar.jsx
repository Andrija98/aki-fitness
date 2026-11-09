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

// unread: broj nepročitanih poruka na tabu poruka. Trener na tom tabu vidi "Poruke" umesto svog imena.
export default function TabBar({ active, unread = 0, isTrainer = false }) {
  return (
    <nav className="tabbar" aria-label="Glavna navigacija">
      {TABS.map((t) => {
        const label = t.route === 'poruke' && isTrainer ? 'Poruke' : t.label;
        const badge = t.route === 'poruke' && unread > 0;
        return (
          <a key={t.route} href={href(t.route)} className={active === t.route ? 'on' : ''} aria-current={active === t.route ? 'page' : undefined}
            aria-label={badge ? `${label}, nepročitanih: ${unread}` : undefined}>
            <span className="tab-icon">
              <Icon name={t.icon} size={24} />
              {badge && <span className="tab-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
            </span>
            {label}
          </a>
        );
      })}
    </nav>
  );
}
