'use client'

export function ReminderSettings({
  reminderEnabled, setReminderEnabled, reminderDaysBefore, setReminderDaysBefore,
  reminderAudience, setReminderAudience,
}) {
  return (
    <div style={{ marginBottom: 14, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} />
        Recordatorio antes del evento
      </label>
      {reminderEnabled && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div className="settings-label">Cuándo avisar</div>
            <select value={String(reminderDaysBefore)} onChange={e => setReminderDaysBefore(Number(e.target.value))} className="settings-select">
              <option value="0">El mismo día</option>
              <option value="1">1 día antes</option>
              <option value="2">2 días antes</option>
              <option value="3">3 días antes</option>
              <option value="7">7 días antes</option>
            </select>
          </div>
          <div>
            <div className="settings-label">Avisar a</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              <button onClick={() => setReminderAudience('self')} style={{ padding: '10px 8px', borderRadius: 12, border: `1px solid ${reminderAudience === 'self' ? '#3b82f6' : 'var(--border)'}`, background: reminderAudience === 'self' ? 'rgba(59,130,246,0.14)' : 'var(--bg-card)', color: reminderAudience === 'self' ? '#93c5fd' : 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Solo yo</button>
              <button onClick={() => setReminderAudience('both')} style={{ padding: '10px 8px', borderRadius: 12, border: `1px solid ${reminderAudience === 'both' ? '#3b82f6' : 'var(--border)'}`, background: reminderAudience === 'both' ? 'rgba(59,130,246,0.14)' : 'var(--bg-card)', color: reminderAudience === 'both' ? '#93c5fd' : 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ambos progenitores</button>
            </div>
          </div>
        </>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Desactivado por defecto.</div>
    </div>
  )
}
