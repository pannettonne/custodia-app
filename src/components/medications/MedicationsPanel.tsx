'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNotification } from '@/lib/db'
import { createMedicationPlan, deleteMedicationPlan, setMedicationLog, updateMedicationPlan } from '@/lib/medications-db'
import { getMedicationOccurrencesForDate, getUpcomingMedicationOccurrences } from '@/lib/medications'
import type { MedicationPlan, MedicationLogStatus } from '@/types'

const ROUTES = ['Oral', 'Inhalada', 'Tópica', 'Nasal', 'Ocular', 'Otra']
const UNITS = ['ml', 'mg', 'comprimido(s)', 'gota(s)', 'puff(s)', 'sobre(s)']
const REMINDER_OPTIONS = [0, 10, 30, 60]

export function MedicationsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, medications, medicationLogs } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const [editing, setEditing] = useState<MedicationPlan | null>(null)
  const [showForm, setShowForm] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const todayOccurrences = useMemo(() => child ? getMedicationOccurrencesForDate(medications, medicationLogs, today) : [], [child, medications, medicationLogs, today])
  const upcomingOccurrences = useMemo(() => child ? getUpcomingMedicationOccurrences(medications, medicationLogs, today, 3) : [], [child, medications, medicationLogs, today])
  const activePlans = medications.filter(item => item.status === 'active')
  const archivedPlans = medications.filter(item => item.status !== 'active')
  const dueCount = todayOccurrences.filter(item => item.status === 'overdue' || item.status === 'due_soon').length

  const handleMark = async (occurrence: (typeof todayOccurrences)[number], status: MedicationLogStatus) => {
    if (!user || !child) return
    await setMedicationLog({
      childId: child.id,
      medicationId: occurrence.medicationId,
      medicationName: occurrence.medicationName,
      scheduledAt: occurrence.scheduledAt,
      status,
      actedBy: user.uid,
      actedByName: user.displayName || user.email || 'Usuario',
    })
    if (status === 'administered') {
      const otherParentIds = child.parents.filter(id => id !== user.uid)
      await Promise.all(otherParentIds.map(userId => createNotification({
        userId,
        childId: child.id,
        childName: child.name,
        type: 'medication_reminder',
        title: 'Toma registrada',
        body: `${user.displayName || user.email || 'Alguien'} ha marcado ${occurrence.medicationName} como administrada (${occurrence.scheduledTime}).`,
        dateKey: `medication-log:${occurrence.key}:administered`,
        targetTab: 'medications',
        targetDate: occurrence.scheduledDate,
      })))
    }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <div className="page-title" style={{ marginBottom:4 }}>Medicación</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Tratamientos visibles para progenitores y colaboradores, con control de tomas y alertas.</div>
        </div>
        {isParentForSelectedChild && <button onClick={() => { setEditing(null); setShowForm(true) }} style={{ background:'#ef4444', border:'none', borderRadius:12, padding:'9px 14px', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}>+ Tratamiento</button>}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <span style={{ padding:'5px 10px', borderRadius:999, background:'rgba(239,68,68,0.12)', color:'#f87171', fontSize:11, fontWeight:800 }}>{activePlans.length} activo(s)</span>
        <span style={{ padding:'5px 10px', borderRadius:999, background:'rgba(59,130,246,0.12)', color:'#60a5fa', fontSize:11, fontWeight:800 }}>{todayOccurrences.length} toma(s) hoy</span>
        {dueCount > 0 && <span style={{ padding:'5px 10px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:11, fontWeight:800 }}>{dueCount} pendiente(s)</span>}
      </div>

      {showForm && child && isParentForSelectedChild && <MedicationForm childId={child.id} userId={user?.uid || ''} userName={user?.displayName || user?.email || 'Progenitor'} editing={editing} onClose={() => { setShowForm(false); setEditing(null) }} />}

      <Section title="Tomas de hoy" empty="No hay tomas previstas para hoy.">
        {todayOccurrences.map(item => (
          <OccurrenceCard key={item.key} occurrence={item} canMark={!!user} onAdminister={() => handleMark(item, 'administered')} onSkip={() => handleMark(item, 'skipped')} />
        ))}
      </Section>

      <Section title="Próximas tomas" empty="No hay tomas próximas en las siguientes 72 horas.">
        {upcomingOccurrences.slice(0, 8).map(item => (
          <OccurrenceCard key={item.key} occurrence={item} canMark={!!user} compact onAdminister={() => handleMark(item, 'administered')} onSkip={() => handleMark(item, 'skipped')} />
        ))}
      </Section>

      <Section title="Tratamientos activos" empty="No hay tratamientos activos.">
        {activePlans.map(item => (
          <PlanCard key={item.id} plan={item} canEdit={isParentForSelectedChild} onEdit={() => { setEditing(item); setShowForm(true) }} />
        ))}
      </Section>

      {archivedPlans.length > 0 && (
        <Section title="Archivados" empty="">
          {archivedPlans.map(item => (
            <PlanCard key={item.id} plan={item} canEdit={isParentForSelectedChild} onEdit={() => { setEditing(item); setShowForm(true) }} />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>{title}</div>
      {hasChildren ? <div style={{ display:'grid', gap:8 }}>{children}</div> : <div className="card" style={{ color:'var(--text-muted)' }}>{empty}</div>}
    </div>
  )
}

function OccurrenceCard({ occurrence, canMark, compact, onAdminister, onSkip }: { occurrence: any; canMark: boolean; compact?: boolean; onAdminister: () => void; onSkip: () => void }) {
  const tone = occurrence.status === 'administered' ? '#10b981' : occurrence.status === 'skipped' ? '#ef4444' : occurrence.status === 'overdue' ? '#f59e0b' : occurrence.status === 'due_soon' ? '#60a5fa' : 'var(--text-muted)'
  return (
    <div className="card" style={{ padding: compact ? 12 : 14, borderColor: `${tone}44` }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-strong)' }}>💊 {occurrence.medicationName}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{occurrence.scheduledDate} · {occurrence.scheduledTime} · {occurrence.dosage} {occurrence.dosageUnit || ''}</div>
          {occurrence.route ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Vía {occurrence.route.toLowerCase()}</div> : null}
          {occurrence.instructions ? <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:6 }}>{occurrence.instructions}</div> : null}
          {occurrence.log?.actedByName ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>Registrada por {occurrence.log.actedByName}</div> : null}
        </div>
        <span style={{ padding:'4px 9px', borderRadius:999, background:`${tone}22`, color:tone, fontSize:11, fontWeight:800 }}>{labelForOccurrenceStatus(occurrence.status)}</span>
      </div>
      {canMark && occurrence.status !== 'administered' && occurrence.status !== 'skipped' && (
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button className="req-action-btn btn-accept" onClick={onAdminister}>Marcar administrada</button>
          <button className="req-action-btn btn-reject" onClick={onSkip}>Omitir</button>
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, canEdit, onEdit }: { plan: MedicationPlan; canEdit: boolean; onEdit: () => void }) {
  return (
    <div className="card" style={{ padding:14 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-strong)' }}>{plan.name}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{plan.dosage} {plan.dosageUnit || ''} · cada {plan.intervalHours} h · desde {plan.startDate} hasta {plan.endDate}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Primera toma {plan.firstDoseTime}{plan.route ? ` · vía ${plan.route.toLowerCase()}` : ''}</div>
          {plan.instructions ? <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:6 }}>{plan.instructions}</div> : null}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ padding:'4px 9px', borderRadius:999, background:plan.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)', color:plan.status === 'active' ? '#10b981' : 'var(--text-muted)', fontSize:11, fontWeight:800 }}>{plan.status === 'active' ? 'ACTIVO' : plan.status.toUpperCase()}</span>
          {canEdit && <button onClick={onEdit} style={{ background:'none', border:'none', color:'#60a5fa', fontSize:12, fontWeight:800, cursor:'pointer' }}>Editar</button>}
        </div>
      </div>
    </div>
  )
}

function labelForOccurrenceStatus(status: string) {
  if (status === 'administered') return 'Administrada'
  if (status === 'skipped') return 'Omitida'
  if (status === 'overdue') return 'Atrasada'
  if (status === 'due_soon') return 'Próxima'
  return 'Pendiente'
}

function MedicationForm({ childId, userId, userName, editing, onClose }: { childId: string; userId: string; userName: string; editing: MedicationPlan | null; onClose: () => void }) {
  const [name, setName] = useState(editing?.name ?? '')
  const [dosage, setDosage] = useState(editing?.dosage ?? '')
  const [dosageUnit, setDosageUnit] = useState(editing?.dosageUnit ?? 'ml')
  const [route, setRoute] = useState(editing?.route ?? 'Oral')
  const [intervalHours, setIntervalHours] = useState(String(editing?.intervalHours ?? 8))
  const [firstDoseTime, setFirstDoseTime] = useState(editing?.firstDoseTime ?? '08:00')
  const [startDate, setStartDate] = useState(editing?.startDate ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(editing?.endDate ?? new Date().toISOString().slice(0, 10))
  const [instructions, setInstructions] = useState(editing?.instructions ?? '')
  const [observations, setObservations] = useState(editing?.observations ?? '')
  const [status, setStatus] = useState<MedicationPlan['status']>(editing?.status ?? 'active')
  const [reminderEnabled, setReminderEnabled] = useState(editing?.reminderEnabled ?? true)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(editing?.reminderMinutesBefore ?? 30)
  const [loading, setLoading] = useState(false)

  const isValid = name.trim().length > 0 && dosage.trim().length > 0 && Number(intervalHours) > 0 && !!firstDoseTime && !!startDate && !!endDate && startDate <= endDate

  const handleSave = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const payload = {
        childId,
        createdBy: editing?.createdBy ?? userId,
        createdByName: editing?.createdByName ?? userName,
        name: name.trim(),
        dosage: dosage.trim(),
        dosageUnit,
        route,
        intervalHours: Number(intervalHours),
        firstDoseTime,
        startDate,
        endDate,
        instructions: instructions.trim() || undefined,
        observations: observations.trim() || undefined,
        status,
        reminderEnabled,
        reminderMinutesBefore: reminderEnabled ? reminderMinutesBefore : undefined,
      }
      if (editing) await updateMedicationPlan(editing.id, payload)
      else await createMedicationPlan(payload)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom:14, borderColor:'rgba(239,68,68,0.24)' }}>
      <div style={{ fontSize:13, fontWeight:800, color:'#fca5a5', marginBottom:12 }}>{editing ? 'Editar tratamiento' : 'Nuevo tratamiento'}</div>
      <div style={{ display:'grid', gap:10 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del medicamento" className="settings-input" />
        <div className="date-pair">
          <input value={dosage} onChange={e => setDosage(e.target.value)} placeholder="Posología / dosis" className="settings-input" />
          <select value={dosageUnit} onChange={e => setDosageUnit(e.target.value)} className="settings-select">{UNITS.map(item => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        <div className="date-pair">
          <select value={route} onChange={e => setRoute(e.target.value)} className="settings-select">{ROUTES.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <input type="number" min="1" value={intervalHours} onChange={e => setIntervalHours(e.target.value)} placeholder="Cada X horas" className="settings-input" />
        </div>
        <div className="date-pair">
          <input type="time" value={firstDoseTime} onChange={e => setFirstDoseTime(e.target.value)} className="settings-input" />
          <select value={status} onChange={e => setStatus(e.target.value as MedicationPlan['status'])} className="settings-select">
            <option value="active">Activo</option>
            <option value="paused">Pausado</option>
            <option value="completed">Finalizado</option>
          </select>
        </div>
        <div className="date-pair">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="settings-input" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="settings-input" />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}>
          <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} /> Activar alertas de toma
        </label>
        {reminderEnabled && <select value={String(reminderMinutesBefore)} onChange={e => setReminderMinutesBefore(Number(e.target.value))} className="settings-select">{REMINDER_OPTIONS.map(item => <option key={item} value={String(item)}>{item === 0 ? 'A la hora exacta' : `${item} min antes`}</option>)}</select>}
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instrucciones" rows={2} className="settings-textarea" />
        <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Observaciones" rows={2} className="settings-textarea" />
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        {editing && <button className="btn-primary btn-outline" style={{ flex:1 }} onClick={async () => { if (window.confirm('¿Eliminar tratamiento?')) { await deleteMedicationPlan(editing.id); onClose() } }}>Eliminar</button>}
        <button className="btn-primary btn-outline" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:(!isValid||loading)?'rgba(255,255,255,0.08)':'#ef4444', color:(!isValid||loading)?'#6b7280':'#fff', fontSize:13, fontWeight:800, cursor:(!isValid||loading)?'not-allowed':'pointer' }} disabled={!isValid || loading} onClick={handleSave}>{loading ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}</button>
      </div>
    </div>
  )
}
