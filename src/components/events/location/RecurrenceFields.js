'use client'
import { WEEKDAYS } from './shared'

export function RecurrenceFields({
  event,
  recurrence,
  setRecurrence,
  recurrenceWeekdays,
  toggleWeekday,
  recurrenceUntil,
  setRecurrenceUntil,
  monthlyDay,
  setMonthlyDay,
  date,
}) {
  if (event) return null

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="settings-label">Repetición</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {['none', 'weekly', 'monthly'].map(value => (
          <button
            key={value}
            onClick={() => setRecurrence(value)}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: 12,
              border: `1px solid ${recurrence === value ? '#8b5cf6' : 'var(--border)'}`,
              background: recurrence === value ? 'rgba(139,92,246,0.18)' : 'var(--bg-soft)',
              color: recurrence === value ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {value === 'none' ? 'Una vez' : value === 'weekly' ? 'Semanal' : 'Mensual'}
          </button>
        ))}
      </div>

      {recurrence === 'weekly' && (
        <>
          <div className="settings-label" style={{ marginBottom: 6 }}>Días de la semana</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {WEEKDAYS.map(day => (
              <button
                key={day.value}
                onClick={() => toggleWeekday(day.value)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  border: `1px solid ${recurrenceWeekdays.includes(day.value) ? '#8b5cf6' : 'var(--border)'}`,
                  background: recurrenceWeekdays.includes(day.value) ? 'rgba(139,92,246,0.18)' : 'var(--bg-soft)',
                  color: recurrenceWeekdays.includes(day.value) ? '#a78bfa' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
          <div className="settings-label" style={{ marginBottom: 6 }}>Repetir hasta</div>
          <input type="date" value={recurrenceUntil} min={date} onChange={e => setRecurrenceUntil(e.target.value)} className="settings-input" />
        </>
      )}

      {recurrence === 'monthly' && (
        <>
          <div className="settings-label" style={{ marginBottom: 6 }}>Día del mes</div>
          <input type="number" min="1" max="31" value={monthlyDay} onChange={e => setMonthlyDay(Number(e.target.value || 1))} className="settings-input" />
          <div className="settings-label" style={{ marginTop: 8, marginBottom: 6 }}>Repetir hasta</div>
          <input type="date" value={recurrenceUntil} min={date} onChange={e => setRecurrenceUntil(e.target.value)} className="settings-input" />
        </>
      )}
    </div>
  )
}
