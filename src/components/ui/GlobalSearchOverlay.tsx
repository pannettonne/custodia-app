'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'

type Tab = 'today' | 'calendar' | 'requests' | 'events' | 'more' | 'notes' | 'documents' | 'packing' | 'contacts' | 'medications' | 'stats' | 'settings' | 'blocks'
type FocusTarget = { id: string; seq: number } | null
type SearchResultType = 'child' | 'parent' | 'collaborator' | 'contact' | 'event' | 'assignment' | 'note' | 'request' | 'special_period' | 'document' | 'document_folder' | 'location'
type SearchFilter = 'all' | 'events' | 'people' | 'locations' | 'requests' | 'documents' | 'notes'

type SearchResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  meta?: string
  childId?: string
  date?: string
  endDate?: string
  targetTab: Tab
  focusTargetId?: string
}

type GlobalSearchOverlayProps = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  navigate: (tab: Tab) => void
  setFocusTarget: (target: FocusTarget) => void
}

const SEARCH_FILTERS: Array<{ value: SearchFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'events', label: 'Eventos' },
  { value: 'people', label: 'Personas' },
  { value: 'locations', label: 'Direcciones' },
  { value: 'requests', label: 'Cambios' },
  { value: 'documents', label: 'Documentos' },
  { value: 'notes', label: 'Notas' },
]

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function matchesSearchQuery(query: string, ...fields: Array<string | undefined | null>) {
  const q = normalizeText(query)
  if (!q) return true
  return fields.some(field => normalizeText(field).includes(q))
}

function matchesFilter(result: SearchResult, filter: SearchFilter) {
  if (filter === 'all') return true
  if (filter === 'events') return result.type === 'event' || result.type === 'assignment' || result.type === 'special_period'
  if (filter === 'people') return result.type === 'child' || result.type === 'parent' || result.type === 'collaborator' || result.type === 'contact'
  if (filter === 'locations') return result.type === 'location'
  if (filter === 'requests') return result.type === 'request'
  if (filter === 'documents') return result.type === 'document' || result.type === 'document_folder'
  if (filter === 'notes') return result.type === 'note'
  return true
}

function groupLabel(type: SearchResultType) {
  if (type === 'event' || type === 'assignment') return 'Eventos'
  if (type === 'location') return 'Direcciones'
  if (type === 'child') return 'Menores'
  if (type === 'parent' || type === 'collaborator' || type === 'contact') return 'Personas'
  if (type === 'note') return 'Notas'
  if (type === 'request') return 'Cambios'
  if (type === 'special_period') return 'Períodos especiales'
  return 'Documentos'
}

function resultIcon(type: SearchResultType) {
  if (type === 'event' || type === 'assignment') return '📅'
  if (type === 'location') return '📍'
  if (type === 'child') return '👧'
  if (type === 'parent' || type === 'collaborator' || type === 'contact') return '👤'
  if (type === 'note') return '📝'
  if (type === 'request') return '🔁'
  if (type === 'special_period') return '⭐'
  return '📄'
}

function statusLabel(status?: string) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'accepted') return 'Aceptado'
  if (status === 'rejected') return 'Rechazado'
  if (status === 'cancelled') return 'Cancelado'
  return status || ''
}

function dateRangeLabel(start?: string, end?: string) {
  if (!start) return ''
  return end && end !== start ? `${start} → ${end}` : start
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find(value => !!value?.trim())?.trim() || ''
}

function SearchResultButton({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: '1px solid var(--border)',
        background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)',
        borderRadius: 18,
        padding: 12,
        textAlign: 'left',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'pointer',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.12)', flexShrink: 0 }}>{resultIcon(result.type)}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 900, color: 'var(--text-strong)', lineHeight: 1.25 }}>{result.title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 3 }}>{result.subtitle}</span>
        {result.meta ? <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35, marginTop: 4 }}>{result.meta}</span> : null}
      </span>
    </button>
  )
}

export function GlobalSearchOverlay({ open, onOpen, onClose, navigate, setFocusTarget }: GlobalSearchOverlayProps) {
  const { user } = useAuth()
  const {
    children,
    selectedChildId,
    setSelectedChildId,
    setSelectedCalendarDate,
    setCurrentMonth,
    events,
    notes,
    requests,
    collaboratorAssignments,
    specialPeriods,
    documents,
    documentFolders,
    contacts,
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
      if (event.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen, onClose, open])

  const allSearchResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []
    const childById = new Map(children.map(child => [child.id, child]))
    const childName = (childId: string) => childById.get(childId)?.name || 'Menor'
    const isParentForChild = (childId: string) => {
      const child = childById.get(childId)
      return !!child && !!user?.uid && child.parents.includes(user.uid)
    }
    const canSeeSharedChild = (childId: string) => {
      const child = childById.get(childId)
      return !!child && !!user?.uid && (child.parents.includes(user.uid) || !!child.collaborators?.includes(user.uid))
    }

    for (const child of children) {
      if (!canSeeSharedChild(child.id) && selectedChildId !== child.id) continue
      const role = isParentForChild(child.id) ? `${child.parents.length} progenitor(es)` : 'Colaborador'
      results.push({ id: `child-${child.id}`, type: 'child', title: child.name, subtitle: role, childId: child.id, targetTab: 'calendar' })

      for (const [parentId, parentName] of Object.entries(child.parentNames || {})) {
        results.push({
          id: `parent-${child.id}-${parentId}`,
          type: 'parent',
          title: parentName || 'Progenitor',
          subtitle: `Progenitor de ${child.name}${parentId === user?.uid ? ' · tú' : ''}`,
          childId: child.id,
          targetTab: 'settings',
        })
      }

      for (const [collaboratorId, collaboratorName] of Object.entries(child.collaboratorNames || {})) {
        results.push({
          id: `collaborator-${child.id}-${collaboratorId}`,
          type: 'collaborator',
          title: collaboratorName || 'Colaborador',
          subtitle: `Colaborador de ${child.name}${collaboratorId === user?.uid ? ' · tú' : ''}`,
          childId: child.id,
          targetTab: 'settings',
        })
      }
    }

    for (const event of events) {
      if (!isParentForChild(event.childId)) continue
      const child = childById.get(event.childId)
      const dateText = dateRangeLabel(event.date, event.endDate)
      const timeText = event.time ? `${event.time}${event.endTime ? `-${event.endTime}` : ''}` : event.allDay ? 'Todo el día' : ''
      const assignedName = event.assignedParentId ? child?.parentNames?.[event.assignedParentId] : ''
      const place = firstNonEmpty(event.locationName, event.locationAddress)
      const subtitle = [childName(event.childId), dateText, timeText, assignedName].filter(Boolean).join(' · ')
      const focusTargetId = `event-${event.id}`
      results.push({
        id: focusTargetId,
        type: 'event',
        title: event.title || 'Evento',
        subtitle,
        meta: [place, event.notes].filter(Boolean).join(' · '),
        childId: event.childId,
        date: event.date,
        endDate: event.endDate,
        targetTab: 'events',
        focusTargetId,
      })
      if (place) {
        results.push({
          id: `location-event-${event.id}`,
          type: 'location',
          title: place,
          subtitle: `${event.title || 'Evento'} · ${subtitle}`,
          meta: event.locationAddress,
          childId: event.childId,
          date: event.date,
          targetTab: 'events',
          focusTargetId,
        })
      }
    }

    for (const assignment of collaboratorAssignments) {
      if (!canSeeSharedChild(assignment.childId)) continue
      const dateText = dateRangeLabel(assignment.date, assignment.date)
      const timeText = assignment.startTime ? `${assignment.startTime}${assignment.endTime ? `-${assignment.endTime}` : ''}` : 'Día completo'
      const place = firstNonEmpty(assignment.locationName, assignment.locationAddress)
      const title = assignment.collaboratorName ? `Asignación · ${assignment.collaboratorName}` : 'Asignación de colaborador'
      const subtitle = [childName(assignment.childId), dateText, timeText, statusLabel(assignment.status)].filter(Boolean).join(' · ')
      results.push({
        id: `assignment-${assignment.id}`,
        type: 'assignment',
        title,
        subtitle,
        meta: [place, assignment.notes].filter(Boolean).join(' · '),
        childId: assignment.childId,
        date: assignment.date,
        targetTab: 'calendar',
      })
      if (place) {
        results.push({
          id: `location-assignment-${assignment.id}`,
          type: 'location',
          title: place,
          subtitle: `${title} · ${subtitle}`,
          meta: assignment.locationAddress,
          childId: assignment.childId,
          date: assignment.date,
          targetTab: 'calendar',
        })
      }
    }

    for (const note of notes) {
      if (!isParentForChild(note.childId)) continue
      const dateText = note.type === 'single' ? note.date : dateRangeLabel(note.startDate, note.endDate)
      const focusTargetId = `note-${note.id}`
      results.push({
        id: focusTargetId,
        type: 'note',
        title: note.text || 'Nota',
        subtitle: [childName(note.childId), dateText, note.createdByName].filter(Boolean).join(' · '),
        childId: note.childId,
        date: note.date || note.startDate,
        endDate: note.endDate,
        targetTab: 'notes',
        focusTargetId,
      })
    }

    for (const request of requests) {
      if (!canSeeSharedChild(request.childId)) continue
      const dateText = request.type === 'single' ? request.date : dateRangeLabel(request.startDate, request.endDate)
      const place = firstNonEmpty(request.locationName, request.locationAddress)
      const focusTargetId = `request-${request.id}`
      results.push({
        id: focusTargetId,
        type: 'request',
        title: request.reason || 'Solicitud de cambio',
        subtitle: [childName(request.childId), dateText, statusLabel(request.status)].filter(Boolean).join(' · '),
        meta: [request.fromParentName, place].filter(Boolean).join(' · '),
        childId: request.childId,
        date: request.date || request.startDate,
        endDate: request.endDate,
        targetTab: 'requests',
        focusTargetId,
      })
      if (place) {
        results.push({
          id: `location-request-${request.id}`,
          type: 'location',
          title: place,
          subtitle: `${request.reason || 'Solicitud de cambio'} · ${childName(request.childId)} · ${dateText || ''}`,
          meta: request.locationAddress,
          childId: request.childId,
          date: request.date || request.startDate,
          targetTab: 'requests',
          focusTargetId,
        })
      }
    }

    for (const period of specialPeriods) {
      if (!isParentForChild(period.childId)) continue
      const child = childById.get(period.childId)
      const label = period.label === 'otro' ? (period.customLabel || 'Período especial') : period.label
      const ownerName = child?.parentNames?.[period.parentId] || 'Progenitor'
      results.push({
        id: `special-${period.id}`,
        type: 'special_period',
        title: label,
        subtitle: [childName(period.childId), dateRangeLabel(period.startDate, period.endDate), ownerName].filter(Boolean).join(' · '),
        meta: period.notes,
        childId: period.childId,
        date: period.startDate,
        endDate: period.endDate,
        targetTab: 'settings',
      })
    }

    for (const folder of documentFolders) {
      if (!isParentForChild(folder.childId)) continue
      results.push({
        id: `document_folder-${folder.id}`,
        type: 'document_folder',
        title: folder.name,
        subtitle: `${childName(folder.childId)} · carpeta`,
        childId: folder.childId,
        targetTab: 'documents',
      })
    }

    for (const document of documents) {
      if (!isParentForChild(document.childId)) continue
      const folderName = document.folderId ? documentFolders.find(folder => folder.id === document.folderId)?.name : 'Sin carpeta'
      results.push({
        id: `document-${document.id}`,
        type: 'document',
        title: document.title || 'Documento cifrado',
        subtitle: [childName(document.childId), folderName, document.shareScope === 'only_me' ? 'Solo para mí' : 'Para todos'].filter(Boolean).join(' · '),
        childId: document.childId,
        targetTab: 'documents',
      })
    }

    for (const contact of contacts) {
      if (!contact.childIds.some(canSeeSharedChild)) continue
      const contactChildren = (contact.childNames && contact.childNames.length > 0 ? contact.childNames : contact.childIds.map(id => childName(id))).join(', ')
      const place = firstNonEmpty(contact.locationName, contact.locationAddress, contact.address)
      results.push({
        id: `contact-${contact.id}`,
        type: 'contact',
        title: contact.name,
        subtitle: [contactChildren, contact.role, contact.organization].filter(Boolean).join(' · '),
        meta: [contact.phone, contact.email, place].filter(Boolean).join(' · '),
        childId: contact.childIds[0],
        targetTab: 'contacts',
      })
      if (place) {
        results.push({
          id: `location-contact-${contact.id}`,
          type: 'location',
          title: place,
          subtitle: [contact.name, contactChildren, contact.role || contact.organization].filter(Boolean).join(' · '),
          meta: contact.locationAddress || contact.address,
          childId: contact.childIds[0],
          targetTab: 'contacts',
        })
      }
    }

    return results
  }, [children, selectedChildId, user?.uid, events, notes, requests, collaboratorAssignments, specialPeriods, documents, documentFolders, contacts])

  const filteredResults = useMemo(() => {
    return allSearchResults
      .filter(result => matchesFilter(result, searchFilter) && matchesSearchQuery(searchQuery, result.title, result.subtitle, result.meta))
      .slice(0, 60)
  }, [allSearchResults, searchFilter, searchQuery])

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const result of filteredResults) {
      const key = groupLabel(result.type)
      groups[key] ||= []
      groups[key].push(result)
    }
    return Object.entries(groups)
  }, [filteredResults])

  const suggestedResults = useMemo(() => {
    return allSearchResults
      .filter(result => result.type === 'event' || result.type === 'assignment' || result.type === 'contact' || result.type === 'request')
      .slice(0, 6)
  }, [allSearchResults])

  const hasQuery = searchQuery.trim().length > 0
  const shouldShowResults = hasQuery || searchFilter !== 'all'

  const openSearchResult = (result: SearchResult) => {
    if (result.childId) setSelectedChildId(result.childId)
    if (result.date) {
      setSelectedCalendarDate(result.date)
      setCurrentMonth(new Date(result.date + 'T12:00:00'))
    }
    if (result.focusTargetId) setFocusTarget({ id: result.focusTargetId, seq: Date.now() })
    else setFocusTarget(null)
    navigate(result.targetTab)
    onClose()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(15, 23, 42, 0.38)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '68px 12px 18px',
      }}
    >
      <section
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: 'calc(100dvh - 88px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 28,
          border: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)',
          boxShadow: '0 26px 80px rgba(15,23,42,0.30)',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>Búsqueda global</div>
              <h2 style={{ margin: '2px 0 0', color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>Buscar</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar búsqueda"
              style={{ width: 38, height: 38, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 18, border: '1px solid var(--border-hover)', background: 'var(--bg-card)', boxShadow: 'var(--card-shadow)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>⌕</span>
            <input
              autoFocus
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Buscar eventos, personas o direcciones..."
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-strong)', fontSize: 15, fontWeight: 700 }}
            />
            {searchQuery ? <button type="button" onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>×</button> : null}
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 12 }}>
            {SEARCH_FILTERS.map(filter => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSearchFilter(filter.value)}
                style={{
                  border: `1px solid ${searchFilter === filter.value ? 'rgba(59,130,246,0.70)' : 'var(--border)'}`,
                  background: searchFilter === filter.value ? 'rgba(59,130,246,0.14)' : 'var(--bg-card)',
                  color: searchFilter === filter.value ? '#3B82F6' : 'var(--text-secondary)',
                  borderRadius: 999,
                  padding: '7px 11px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: 16 }}>
          {!shouldShowResults ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>Accesos rápidos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <button type="button" onClick={() => { setSearchFilter('events'); setSearchQuery(localDateKey()) }} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 16, padding: 12, fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}>📅 Eventos de hoy</button>
                  <button type="button" onClick={() => { setSearchFilter('events'); setSearchQuery('cumple') }} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 16, padding: 12, fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}>🎂 Próximos cumpleaños</button>
                  <button type="button" onClick={() => { setSearchFilter('requests'); setSearchQuery('Pendiente') }} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 16, padding: 12, fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}>🔁 Cambios pendientes</button>
                  <button type="button" onClick={() => { setSearchFilter('locations'); setSearchQuery('') }} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 16, padding: 12, fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}>📍 Direcciones</button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>Sugerencias</div>
                {suggestedResults.length === 0 ? <div className="popup-empty">Todavía no hay elementos para buscar.</div> : <div style={{ display: 'grid', gap: 8 }}>{suggestedResults.map(result => <SearchResultButton key={result.id} result={result} onClick={() => openSearchResult(result)} />)}</div>}
              </div>
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="popup-empty" style={{ padding: 28 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔎</div>
              <div style={{ fontWeight: 900, color: 'var(--text-strong)', marginBottom: 4 }}>No encontramos nada</div>
              <div>Prueba con el nombre de una persona, evento, fecha o dirección.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {groupedResults.map(([group, items]) => (
                <div key={group}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>{group}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {items.map(result => <SearchResultButton key={result.id} result={result} onClick={() => openSearchResult(result)} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
