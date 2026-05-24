'use client'
import { WEEKDAYS } from './shared'

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Una vez' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
]

const usesWeekdays = recurrence => recurrence === 'weekly' || recurrence === 'biweekly'

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
  const selectRecurrence = value => {
    setRecurrence(value)
    if (value !== 'none' && date && (!recurrenceUntil || recurrenceUntil < date)) {
      setRecurrenceUntil(date)
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="settings-label">Repetición</div>
      {event ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Puedes cambiar la temporalidad del evento sin perder los días ni la frecuencia guardados.
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
        {RECURRENCE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => selectRecurrence(option.value)}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: 12,
              border: `1px solid ${recurrence === option.value ? '#8b5cf6' : 'var(--border)'}`,
              background: recurrence === option.value ? 'rgba(139,92,246,0.18)' : 'var(--bg-soft)',
              color: recurrence === option.value ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {usesWeekdays(recurrence) && (
        <>
          <div className="settings-label" style={{ marginBottom: 6 }}>Días de la semana</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {WEEKDAYS.map(day => (
              <button
                key={day.value}
                type="button"
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
