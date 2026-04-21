'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/store/app'
import { getMedicationOccurrencesForDate } from '@/lib/medications'
import { formatDate } from '@/lib/utils'

export function CalendarMedicationAgenda() {
  const { selectedCalendarDate, medications, medicationLogs } = useAppStore()
  const date = selectedCalendarDate || new Date().toISOString().slice(0, 10)
  const occurrences = useMemo(() => getMedicationOccurrencesForDate(medications, medicationLogs, date), [medications, medicationLogs, date])

  if (occurrences.length === 0) return null

  return (
    <div className="card" style={{ marginTop: 14, borderColor: 'rgba(239,68,68,0.24)', background:'linear-gradient(180deg, rgba(239,68,68,0.08) 0%, var(--bg-card) 100%)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:12, color:'#f87171', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4 }}>Medicación</div>
          <div style={{ fontSize:14, color:'var(--text-strong)', fontWeight:800, marginTop:4 }}>{formatDate(date)}</div>
        </div>
        <div style={{ padding:'5px 10px', borderRadius:999, background:'rgba(239,68,68,0.12)', color:'#f87171', fontSize:11, fontWeight:800 }}>{occurrences.length} toma(s)</div>
      </div>
      <div style={{ display:'grid', gap:8 }}>
        {occurrences.map(item => (
          <div key={item.key} style={{ padding:'10px 12px', borderRadius:14, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <div style={{ fontSize:13, color:'var(--text-strong)', fontWeight:800 }}>💊 {item.medicationName}</div>
              <div style={{ fontSize:11, color:'#f87171', fontWeight:800 }}>{item.scheduledTime}</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:6 }}>{item.dosage} {item.dosageUnit || ''}{item.route ? ` · vía ${item.route.toLowerCase()}` : ''}</div>
            {item.instructions ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{item.instructions}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
