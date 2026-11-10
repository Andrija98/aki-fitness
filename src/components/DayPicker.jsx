// Izbor dana u tekućoj nedelji (P U S Č P S N), danas je istaknut. value/onChange: 0 = ponedeljak.

import { currentWeek, DAY_LETTERS, DAY_NAMES } from '../lib/format.js';

export default function DayPicker({ value, onChange, today }) {
  return (
    <div className="day-pick" role="group" aria-label="Dan u nedelji">
      {currentWeek().map((d, i) => (
        <button key={i} type="button" aria-pressed={i === value} aria-label={`${DAY_NAMES[i]} ${d.getDate()}.`}
          className={[i === value && 'on', i === today && 'today'].filter(Boolean).join(' ')} onClick={() => onChange(i)}>
          {DAY_LETTERS[i]}<br />{d.getDate()}
        </button>
      ))}
    </div>
  );
}
