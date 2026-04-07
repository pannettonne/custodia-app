'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createSpecialPeriod, deleteSpecialPeriod } from '@/lib/db'
import { formatDate, PERIOD_LABELS } from '@/lib/utils'
import type { SpecialPeriod, SpecialPeriodLabel } from '@/types'

const PERIOD_OPTIONS: { value: SpecialPeriodLabel; label: string }[] = [
  { value: 'verano',      label: '☀️ Verano' },
  { value: 'navidad',     label: '🎄 Navidad' },
  { value: 'semana_santa',label: '✝️ Semana Santa' },
  { value: 'pascua',      label: '🐣 Pascua' },
  { value: 'otro',        label: '📅 Otro' },
]

export function SpecialPeriodsManager() {
  const { user } = useAuth()
  const { specialPeriods, children, selectedChildId } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  if (!child) return null

  const today = new Date().toISOString().slice(0, 10)
  const sorted = [...specialPeriods].sort((a, b) => {
    const aFuture = a.endDate >= today
    const bFuture = b.endDate >= today
    if (aFuture && !bFuture) return -1
    if (!aFuture && bFuture) return 1
    return a.startDate.localeCompare(b.startDate)
  })

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🗓️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Periodos especiales</span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ fontSize: 12, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
          {showForm ? 'Cancelar' : '+ Añadir'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
        Define quién tiene al menor durante vacaciones u otros periodos puntuales. Tienen prioridad sobre el patrón habitual.
      </p>

      {showForm && <SpecialPeriodForm child={child} onClose={() => setShowForm(false)} />}

      {sorted.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin periodos especiales. Añade verano, Navidad...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(sp => <SpecialPeriodCard key={sp.id} period={sp} child={child} today={today} />)}
        </div>
      )}
    </div>
  )
}

function SpecialPeriodCard({ period, child, today }: { period: SpecialPeriod; child: any; today: string }) {
  const { user } = useAuth()
  const color = child.parentColors?.[period.parentId] ?? '#6B7280'
  const name = child.parentNames?.[period.parentId] ?? 'Progenitor'
  const labelStr = period.label === 'otro' ? (period.customLabel ?? 'Período especial') : PERIOD_LABELS[period.label]

  const isActive = period.startDate <= today && period.endDate >= today
  const isPast = period.endDate < today

  const start = new Date(period.startDate + 'T12:00:00')
  const end = new Date(period.endDate + 'T12:00:00')
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14,
      background: isPast ? 'var(--bg-soft)' : color + '15',
      border: `1px solid ${isPast ? 'var(--border)' : color + '40'}`,
      opacity: isPast ? 0.72 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{labelStr.split(' ')[0]}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: isPast ? 'var(--text-secondary)' : 'var(--text-strong)' }}>
              {labelStr.replace(/^.\s/, '')}
            </span>
            {isActive && (
              <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>
                ● Activo ahora
              </span>
            )}
            {isPast && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>Pasado</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              📅 {formatDate(period.startDate)} → {formatDate(period.endDate)}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>({days} días)</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: isPast ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
              Corresponde a <strong style={{ color: isPast ? 'var(--text-secondary)' : color }}>{name}</strong>
              {period.parentId === user?.uid ? ' (tú)' : ''}
            </span>
          </div>

          {period.notes && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>{period.notes}</div>
          )}
        </div>

        <button onClick={() => deleteSpecialPeriod(period.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

function SpecialPeriodForm({ child, onClose }: { child: any; onClose: () => void }) {
  const { user } = useAuth()

  const [label, setLabel] = useState<SpecialPeriodLabel>('verano')
  const [customLabel, setCustomLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [parentId, setParentId] = useState<string>(child.parents[0] ?? '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const isValid = !!startDate && !!endDate && startDate <= endDate && !!parentId && (label !== 'otro' || !!customLabel.trim())

  const handleSubmit = async () => {
    if (!user || !child || !isValid) return
    setLoading(true)
    try {
      await createSpecialPeriod({
        childId: child.id,
        label,
        customLabel: label === 'otro' ? customLabel.trim() : undefined,
        startDate,
        endDate,
        parentId,
        notes: notes.trim() || undefined,
        createdBy: user.uid,
      })
      onClose()
    } finally { setLoading(false) }
  }

  const currentYear = new Date().getFullYear()
  const quickFill = (type: string) => {
    const y = currentYear
    const presets: Record<string, [string, string, SpecialPeriodLabel]> = {
      verano1:       [`${y}-06-22`, `${y}-07-21`, 'verano'],
      verano2:       [`${y}-07-22`, `${y}-08-31`, 'verano'],
      navidad1:      [`${y}-12-23`, `${y+1}-01-02`, 'navidad'],
      semana_santa:  [`${y}-04-13`, `${y}-04-20`, 'semana_santa'],
    }
    const p = presets[type]
    if (p) { setStartDate(p[0]); setEndDate(p[1]); setLabel(p[2]) }
  }

  return (
    <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>🗓️ Nuevo periodo especial</div>

      <div style={{ marginBottom: 12 }}>
        <div className="settings-label">Acceso rápido</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['verano1', '☀️ Verano 1ª mitad'],
            ['verano2', '☀️ Verano 2ª mitad'],
            ['navidad1', '🎄 Navidad'],
            ['semana_santa', '✝️ Semana Santa'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => quickFill(k)}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Tipo de periodo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {PERIOD_OPTIONS.map(({ value, label: lbl }) => (
            <button key={value} onClick={() => setLabel(value)}
              style={{ padding: '8px 4px', borderRadius: 10, border: `1px solid ${label===value ? 'rgba(245,158,11,0.6)' : 'var(--border)'}`, background: label===value ? 'rgba(245,158,11,0.2)' : 'var(--bg-soft)', color: label===value ? '#f59e0b' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>
        {label === 'otro' && (
          <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
            placeholder="Nombre del periodo..." className="settings-input" style={{ marginTop: 8 }} />
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="date-pair">
          <div><div className="date-pair-label">Desde</div><input type="date" value={startDate} onChange={e => { const next = e.target.value; setStartDate(next); if (!endDate || endDate < next) setEndDate(next) }} className="settings-input" /></div>
          <div><div className="date-pair-label">Hasta</div><input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="settings-input" /></div>
        </div>
        {startDate && endDate && startDate <= endDate && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {Math.round((new Date(endDate+'T12:00:00').getTime() - new Date(startDate+'T12:00:00').getTime()) / 86400000) + 1} días
          </div>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">¿A quién le corresponde?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {child.parents.map((pid: string) => {
            const color = child.parentColors?.[pid] ?? '#6B7280'
            const name = child.parentNames?.[pid] ?? 'Progenitor'
            const isSelected = parentId === pid
            return (
              <button key={pid} onClick={() => setParentId(pid)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `2px solid ${isSelected ? color : 'var(--border)'}`, background: isSelected ? color + '20' : 'var(--bg-soft)', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? color : 'var(--text-secondary)' }}>{name}</div>
                  {pid === user?.uid && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tú</div>}
                </div>
                {isSelected && <div style={{ marginLeft: 'auto', color, fontSize: 16 }}>✓</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="settings-label">Observaciones (opcional)</div>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Incluye recogida el viernes a las 17h" className="settings-input" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button
          style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:(!isValid||loading)?'rgba(255,255,255,0.08)':'#f59e0b', color:(!isValid||loading)?'#6b7280':'#fff', fontSize:13, fontWeight:700, cursor:(!isValid||loading)?'not-allowed':'pointer' }}
          onClick={handleSubmit}
          disabled={!isValid||loading}
        >
          {loading ? 'Guardando...' : 'Guardar periodo'}
        </button>
      </div>
    </div>
  )
}
