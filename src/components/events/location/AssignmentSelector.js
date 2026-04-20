'use client'

export function AssignmentSelector({ child, assignedParentId, setAssignedParentId }) {
  if (!child || child.parents.length <= 1) return null

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="settings-label">Solicitar asignación a progenitor (opcional)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {child.parents.map(pid => {
          const selected = assignedParentId === pid
          return (
            <button
              key={pid}
              onClick={() => setAssignedParentId(selected ? '' : pid)}
              style={{
                padding: '10px 8px',
                borderRadius: 12,
                border: `1px solid ${selected ? child.parentColors?.[pid] ?? '#3b82f6' : 'var(--border)'}`,
                background: selected ? `${child.parentColors?.[pid] ?? '#3b82f6'}22` : 'var(--bg-soft)',
                color: selected ? child.parentColors?.[pid] ?? '#93c5fd' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {child.parentNames?.[pid] ?? 'Progenitor'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
