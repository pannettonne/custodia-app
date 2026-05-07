'use client'

import { DocumentAssociations } from '@/components/documents/DocumentAssociations'
import type { EventReminderAudience } from '@/types'

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 18, background: checked ? 'rgba(124,58,237,.10)' : 'var(--bg-card)' }}>
      <span>
        <strong>{label}</strong><br />
        <small style={{ color: 'var(--text-secondary)' }}>{hint}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
  )
}

type Props = {
  childId?: string
  reminderEnabled: boolean
  setReminderEnabled: (value: boolean) => void
  reminderDaysBefore: number
  setReminderDaysBefore: (value: number) => void
  reminderAudience: EventReminderAudience
  setReminderAudience: (value: EventReminderAudience) => void
  notesEnabled: boolean
  setNotesEnabled: (value: boolean) => void
  notes: string
  setNotes: (value: string) => void
  documentsEnabled: boolean
  setDocumentsEnabled: (value: boolean) => void
  documentIds: string[]
  setDocumentIds: (value: string[]) => void
}

export function GuidedOptionsStep(props: Props) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <ToggleRow label="Recordatorio" hint="Recibir aviso antes del evento" checked={props.reminderEnabled} onChange={props.setReminderEnabled} />
      {props.reminderEnabled ? (
        <div style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 18, background: 'var(--bg-card)' }}>
          <select className="settings-input" value={props.reminderDaysBefore} onChange={event => props.setReminderDaysBefore(Number(event.target.value))}>
            <option value={0}>El mismo día</option>
            <option value={1}>1 día antes</option>
            <option value={2}>2 días antes</option>
            <option value={3}>3 días antes</option>
            <option value={7}>7 días antes</option>
          </select>
          <select className="settings-input" value={props.reminderAudience} onChange={event => props.setReminderAudience(event.target.value as EventReminderAudience)}>
            <option value="self">Solo para mí</option>
            <option value="both">Para ambos progenitores</option>
          </select>
        </div>
      ) : null}

      <ToggleRow label="Notas" hint="Añadir observaciones al evento" checked={props.notesEnabled} onChange={props.setNotesEnabled} />
      {props.notesEnabled ? <textarea value={props.notes} onChange={event => props.setNotes(event.target.value)} className="settings-textarea" rows={3} placeholder="Añade detalles importantes..." /> : null}

      <ToggleRow label="Documentos" hint="Asociar archivos existentes o subir uno nuevo" checked={props.documentsEnabled} onChange={props.setDocumentsEnabled} />
      {props.documentsEnabled && props.childId ? <DocumentAssociations childId={props.childId} value={props.documentIds} onChange={props.setDocumentIds} /> : null}
    </div>
  )
}
