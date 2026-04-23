'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createContact, deleteContact, updateContact } from '@/lib/contacts-db'
import type { Child, ChildContact, ChildContactCategory, ChildContactKind, ChildContactVisibility } from '@/types'

const CATEGORY_LABELS: Record<ChildContactCategory, string> = {
  teacher: 'Profesor/a',
  doctor: 'Médico/a',
  specialist: 'Especialista',
  caregiver: 'Cuidador/a',
  family: 'Familiar',
  school: 'Centro escolar',
  activity: 'Actividad',
  other: 'Otro',
}

const KIND_LABELS: Record<ChildContactKind, string> = {
  person: 'Persona',
  place: 'Sitio / centro',
}

const VISIBILITY_LABELS: Record<ChildContactVisibility, string> = {
  all_access: 'Todos con acceso',
  parents_only: 'Solo progenitores',
}

export function ContactsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, contacts } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const parentManagedChildren = useMemo(() => children.filter(item => !!user?.uid && item.parents.includes(user.uid)), [children, user?.uid])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | ChildContactCategory>('all')
  const [editing, setEditing] = useState<ChildContact | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filteredContacts = useMemo(() => {
    const q = normalize(query)
    return contacts.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (!q) return true
      return [item.name, item.role, item.organization, item.phone, item.email, item.locationName, item.locationAddress, item.notes]
        .some(value => normalize(value).includes(q))
    })
  }, [contacts, query, categoryFilter])

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <div className="page-title" style={{ marginBottom:4 }}>Contactos</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Agenda compartida con personas y lugares importantes en la vida del menor.</div>
        </div>
        {isParentForSelectedChild && <button onClick={() => { setEditing(null); setShowForm(true) }} style={{ background:'#3B82F6', border:'none', borderRadius:12, padding:'9px 14px', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}>+ Contacto</button>}
      </div>

      <div className="card" style={{ marginBottom:14, padding:12 }}>
        <div style={{ display:'grid', gap:10 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, cargo, centro, teléfono..." className="settings-input" style={{ marginBottom:0 }} />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {(['all', ...Object.keys(CATEGORY_LABELS)] as Array<'all' | ChildContactCategory>).map(key => (
              <button key={key} onClick={() => setCategoryFilter(key)} style={{ padding:'6px 10px', borderRadius:999, border:`1px solid ${categoryFilter === key ? '#3B82F6' : 'var(--border)'}`, background: categoryFilter === key ? 'rgba(59,130,246,0.10)' : 'transparent', color: categoryFilter === key ? '#3B82F6' : 'var(--text-secondary)', fontSize:11, fontWeight:800, cursor:'pointer' }}>{key === 'all' ? 'Todos' : CATEGORY_LABELS[key]}</button>
            ))}
          </div>
        </div>
      </div>

      {showForm && user && isParentForSelectedChild && (
        <ContactForm
          parentManagedChildren={parentManagedChildren}
          selectedChildId={selectedChildId}
          userId={user.uid}
          userName={user.displayName || user.email || 'Progenitor'}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {filteredContacts.length === 0 ? (
        <div className="card" style={{ color:'var(--text-muted)' }}>No hay contactos para este menor todavía.</div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {filteredContacts.map(item => (
            <ContactCard key={item.id} contact={item} children={children} canEdit={isParentForSelectedChild && !!user?.uid && item.editableByUserIds.includes(user.uid)} onEdit={() => { setEditing(item); setShowForm(true) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function ContactCard({ contact, children, canEdit, onEdit }: { contact: ChildContact; children: Child[]; canEdit: boolean; onEdit: () => void }) {
  const childBadges = contact.childIds.map(id => children.find(c => c.id === id)?.name || 'Menor')
  const mapHref = contact.locationLatitude != null && contact.locationLongitude != null
    ? `https://www.google.com/maps?q=${contact.locationLatitude},${contact.locationLongitude}`
    : contact.locationAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.locationAddress)}`
      : contact.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
        : null
  const phoneHref = contact.phone ? `tel:${contact.phone}` : null
  const whatsappHref = (contact.whatsapp || contact.phone) ? `https://wa.me/${String(contact.whatsapp || contact.phone).replace(/[^\d]/g, '')}` : null
  const emailHref = contact.email ? `mailto:${contact.email}` : null

  return (
    <div className="card" style={{ padding:14 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:12, minWidth:0 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:'rgba(59,130,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {contact.photoUrl ? <img src={contact.photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ color:'#3B82F6', fontSize:16, fontWeight:900 }}>{(contact.name || '?').slice(0,1).toUpperCase()}</span>}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <div style={{ fontSize:15, fontWeight:900, color:'var(--text-strong)' }}>{contact.name}</div>
              <span style={{ padding:'3px 8px', borderRadius:999, background:'rgba(148,163,184,0.12)', color:'var(--text-secondary)', fontSize:10, fontWeight:800 }}>{KIND_LABELS[contact.kind]}</span>
              <span style={{ padding:'3px 8px', borderRadius:999, background:'rgba(59,130,246,0.10)', color:'#3B82F6', fontSize:10, fontWeight:800 }}>{CATEGORY_LABELS[contact.category]}</span>
              {contact.isPrimary && <span style={{ padding:'3px 8px', borderRadius:999, background:'rgba(16,185,129,0.12)', color:'#10b981', fontSize:10, fontWeight:800 }}>Principal</span>}
              {contact.canPickup && <span style={{ padding:'3px 8px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:10, fontWeight:800 }}>Recogida autorizada</span>}
            </div>
            {(contact.role || contact.organization) && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{[contact.role, contact.organization].filter(Boolean).join(' · ')}</div>}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
              {childBadges.map(name => <span key={name} style={{ padding:'3px 8px', borderRadius:999, background:'var(--bg-soft)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:10, fontWeight:700 }}>{name}</span>)}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ padding:'4px 8px', borderRadius:999, background:'rgba(148,163,184,0.12)', color:'var(--text-secondary)', fontSize:10, fontWeight:800 }}>{VISIBILITY_LABELS[contact.visibility]}</span>
          {canEdit && <button onClick={onEdit} style={{ background:'none', border:'none', color:'#3B82F6', fontSize:12, fontWeight:800, cursor:'pointer' }}>Editar</button>}
        </div>
      </div>

      <div style={{ display:'grid', gap:6, marginTop:12 }}>
        {contact.phone && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Teléfono: {contact.phone}</div>}
        {contact.email && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Email: {contact.email}</div>}
        {(contact.locationName || contact.locationAddress || contact.address) && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Ubicación: {contact.locationName || contact.locationAddress || contact.address}</div>}
        {contact.availability && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Disponibilidad: {contact.availability}</div>}
        {contact.notes && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{contact.notes}</div>}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
        {phoneHref && <a href={phoneHref} style={actionPillStyle('#10b981')}>Llamar</a>}
        {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" style={actionPillStyle('#22c55e')}>WhatsApp</a>}
        {emailHref && <a href={emailHref} style={actionPillStyle('#60a5fa')}>Email</a>}
        {mapHref && <a href={mapHref} target="_blank" rel="noreferrer" style={actionPillStyle('#f59e0b')}>Abrir mapa</a>}
      </div>
    </div>
  )
}

function ContactForm({ parentManagedChildren, selectedChildId, userId, userName, editing, onClose }: { parentManagedChildren: Child[]; selectedChildId: string | null; userId: string; userName: string; editing: ChildContact | null; onClose: () => void }) {
  const [name, setName] = useState(editing?.name ?? '')
  const [kind, setKind] = useState<ChildContactKind>(editing?.kind ?? 'person')
  const [category, setCategory] = useState<ChildContactCategory>(editing?.category ?? 'teacher')
  const [role, setRole] = useState(editing?.role ?? '')
  const [organization, setOrganization] = useState(editing?.organization ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(editing?.whatsapp ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [address, setAddress] = useState(editing?.address ?? '')
  const [locationName, setLocationName] = useState(editing?.locationName ?? '')
  const [locationAddress, setLocationAddress] = useState(editing?.locationAddress ?? '')
  const [photoUrl, setPhotoUrl] = useState(editing?.photoUrl ?? '')
  const [availability, setAvailability] = useState(editing?.availability ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [visibility, setVisibility] = useState<ChildContactVisibility>(editing?.visibility ?? 'all_access')
  const [isPrimary, setIsPrimary] = useState(!!editing?.isPrimary)
  const [canPickup, setCanPickup] = useState(!!editing?.canPickup)
  const [useAsLocation, setUseAsLocation] = useState(editing?.useAsLocation ?? true)
  const [selectedIds, setSelectedIds] = useState<string[]>(editing?.childIds?.length ? editing.childIds : (selectedChildId ? [selectedChildId] : []))
  const [loading, setLoading] = useState(false)

  const isValid = name.trim().length > 0 && selectedIds.length > 0

  const toggleChild = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const buildAccess = () => {
    const selectedChildren = parentManagedChildren.filter(child => selectedIds.includes(child.id))
    const editableByUserIds = Array.from(new Set(selectedChildren.flatMap(child => child.parents)))
    const visibleToUserIds = visibility === 'parents_only'
      ? editableByUserIds
      : Array.from(new Set(selectedChildren.flatMap(child => [...child.parents, ...(child.collaborators || [])])))
    return {
      childNames: selectedChildren.map(child => child.name),
      editableByUserIds,
      visibleToUserIds,
    }
  }

  const handleSave = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const access = buildAccess()
      const payload = {
        childIds: selectedIds,
        childNames: access.childNames,
        createdBy: editing?.createdBy ?? userId,
        createdByName: editing?.createdByName ?? userName,
        updatedBy: userId,
        updatedByName: userName,
        visibleToUserIds: access.visibleToUserIds,
        editableByUserIds: access.editableByUserIds,
        kind,
        category,
        visibility,
        name: name.trim(),
        role: role.trim() || undefined,
        organization: organization.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        availability: availability.trim() || undefined,
        notes: notes.trim() || undefined,
        isPrimary,
        canPickup,
        useAsLocation,
        locationName: locationName.trim() || undefined,
        locationAddress: locationAddress.trim() || undefined,
      }
      if (editing) await updateContact(editing.id, payload)
      else await createContact(payload)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom:14, borderColor:'rgba(59,130,246,0.24)' }}>
      <div style={{ fontSize:13, fontWeight:800, color:'#93c5fd', marginBottom:12 }}>{editing ? 'Editar contacto' : 'Nuevo contacto'}</div>
      <div style={{ display:'grid', gap:10 }}>
        <div className="date-pair">
          <select value={kind} onChange={e => setKind(e.target.value as ChildContactKind)} className="settings-select">{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={category} onChange={e => setCategory(e.target.value as ChildContactCategory)} className="settings-select">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'place' ? 'Nombre del lugar o centro' : 'Nombre del contacto'} className="settings-input" />
        <div className="date-pair">
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="Cargo o relación" className="settings-input" />
          <input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Centro / organización" className="settings-input" />
        </div>
        <div className="date-pair">
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono" className="settings-input" />
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp" className="settings-input" />
        </div>
        <div className="date-pair">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="settings-input" />
          <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="URL de foto / avatar" className="settings-input" />
        </div>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección" className="settings-input" />
        <div className="date-pair">
          <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Nombre de ubicación" className="settings-input" />
          <input value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="Dirección para mapas" className="settings-input" />
        </div>
        <input value={availability} onChange={e => setAvailability(e.target.value)} placeholder="Horario o disponibilidad" className="settings-input" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas" rows={3} className="settings-textarea" />
        <select value={visibility} onChange={e => setVisibility(e.target.value as ChildContactVisibility)} className="settings-select">{Object.entries(VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>

        <div style={{ padding:10, borderRadius:14, background:'var(--bg-soft)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Aplica a menores</div>
          <div style={{ display:'grid', gap:6 }}>
            {parentManagedChildren.map(child => (
              <label key={child.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}>
                <input type="checkbox" checked={selectedIds.includes(child.id)} onChange={() => toggleChild(child.id)} />
                {child.name}
              </label>
            ))}
          </div>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}><input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} /> Contacto principal</label>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}><input type="checkbox" checked={canPickup} onChange={e => setCanPickup(e.target.checked)} /> Autorizado para recogida</label>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}><input type="checkbox" checked={useAsLocation} onChange={e => setUseAsLocation(e.target.checked)} /> Se puede usar como ubicación rápida</label>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        {editing && <button className="btn-primary btn-outline" style={{ flex:1 }} onClick={async () => { if (window.confirm('¿Eliminar contacto?')) { await deleteContact(editing.id); onClose() } }}>Eliminar</button>}
        <button className="btn-primary btn-outline" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex:1, padding:'11px', borderRadius:12, border:'none', background:(!isValid || loading) ? 'rgba(255,255,255,0.08)' : '#3B82F6', color:(!isValid || loading) ? '#6b7280' : '#fff', fontSize:13, fontWeight:800, cursor:(!isValid || loading) ? 'not-allowed' : 'pointer' }} disabled={!isValid || loading} onClick={handleSave}>{loading ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}</button>
      </div>
    </div>
  )
}

function normalize(value?: string | null) {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function actionPillStyle(color: string) {
  return {
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    padding:'6px 10px',
    borderRadius:999,
    border:`1px solid ${color}33`,
    background:`${color}14`,
    color,
    textDecoration:'none',
    fontSize:11,
    fontWeight:800,
  } as const
}
