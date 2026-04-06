'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createPackingItem, updatePackingItem, deletePackingItem } from '@/lib/db'
import type { PackingItem, ItemLocation } from '@/types'

const CAT_ICONS: Record<string, string> = { ropa: '👕', escolar: '📚', ocio: '🎮', salud: '💊', otro: '📦' }
const LOC_CONFIG: Record<ItemLocation, { label: string; color: string; bg: string }> = {
  casa1:       { label: 'Casa 1',      color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  casa2:       { label: 'Casa 2',      color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  desconocido: { label: 'Sin localizar', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
}

export function PackingPanel() {
  const { user } = useAuth()
  const { packingItems, children, selectedChildId } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  // Build location labels from parent names
  const locLabels: Record<ItemLocation, string> = useMemo(() => {
    if (!child) return { casa1: 'Casa 1', casa2: 'Casa 2', desconocido: 'Sin localizar' }
    const [p1, p2] = child.parents
    return {
      casa1: child.parentNames?.[p1] ? `Casa ${child.parentNames[p1].split(' ')[0]}` : 'Casa 1',
      casa2: child.parentNames?.[p2] ? `Casa ${child.parentNames[p2].split(' ')[0]}` : 'Casa 2',
      desconocido: 'Sin localizar',
    }
  }, [child])

  const byLocation = useMemo(() => {
    const items = filterCat === 'all' ? packingItems : packingItems.filter(i => i.category === filterCat)
    return {
      casa1: items.filter(i => i.location === 'casa1'),
      casa2: items.filter(i => i.location === 'casa2'),
      desconocido: items.filter(i => i.location === 'desconocido'),
    }
  }, [packingItems, filterCat])

  const lost = packingItems.filter(i => i.location === 'desconocido').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="page-title" style={{ marginBottom: 0 }}>Equipaje</div>
          {lost > 0 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>🔍 {lost} sin localizar</span>}
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: '#8b5cf6', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Objeto</button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {[['all', '🎒', 'Todo'], ['ropa', '👕', 'Ropa'], ['escolar', '📚', 'Escolar'], ['ocio', '🎮', 'Ocio'], ['salud', '💊', 'Salud'], ['otro', '📦', 'Otro']].map(([k, icon, label]) => (
          <button key={k} onClick={() => setFilterCat(k)}
            style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1px solid ${filterCat === k ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`, background: filterCat === k ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: filterCat === k ? '#fff' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {showForm && <PackingForm onClose={() => setShowForm(false)} locLabels={locLabels} />}

      {packingItems.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧳</div>
          <div className="empty-state-title">Lista de equipaje vacía</div>
          <div className="empty-state-sub">Añade los objetos que viajan entre casas</div>
        </div>
      ) : (
        <div>
          {(['casa1', 'casa2', 'desconocido'] as ItemLocation[]).map(loc => {
            const items = byLocation[loc]
            if (items.length === 0) return null
            const cfg = LOC_CONFIG[loc]
            return (
              <div key={loc} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{locLabels[loc]} ({items.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {items.map(item => <PackingItemCard key={item.id} item={item} locLabels={locLabels} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PackingItemCard({ item, locLabels }: { item: PackingItem; locLabels: Record<ItemLocation, string> }) {
  const { user } = useAuth()
  const cfg = LOC_CONFIG[item.location]
  const locs: ItemLocation[] = ['casa1', 'casa2', 'desconocido']
  const nextLoc = locs[(locs.indexOf(item.location) + 1) % 3]

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <div>
          <div style={{ fontSize: 20, marginBottom: 4 }}>{CAT_ICONS[item.category]}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', lineHeight: 1.3 }}>{item.name}</div>
          {item.isRecurring && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>🔄 Recurrente</div>}
          {item.notes && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{item.notes}</div>}
        </div>
        <button onClick={() => deletePackingItem(item.id)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 14, flexShrink: 0, lineHeight: 1 }}>✕</button>
      </div>
      <button onClick={() => updatePackingItem(item.id, { location: nextLoc })}
        style={{ width: '100%', marginTop: 8, padding: '5px 8px', borderRadius: 8, border: `1px solid ${cfg.color}44`, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
        📍 {locLabels[item.location]}
      </button>
    </div>
  )
}

function PackingForm({ onClose, locLabels }: { onClose: () => void; locLabels: Record<ItemLocation, string> }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('ropa')
  const [location, setLocation] = useState<ItemLocation>('casa1')
  const [isRecurring, setIsRecurring] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!user || !child || !name.trim()) return
    setLoading(true)
    try {
      await createPackingItem({ childId: child.id, name: name.trim(), category: category as any, location, isRecurring, notes: notes.trim() || undefined, createdBy: user.uid, updatedAt: new Date() })
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(139,92,246,0.3)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🧳 Nuevo objeto</div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Nombre</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Mochila del cole" className="settings-input" />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Categoría</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {[['ropa','👕'],['escolar','📚'],['ocio','🎮'],['salud','💊'],['otro','📦']].map(([k, icon]) => (
            <button key={k} onClick={() => setCategory(k)}
              style={{ padding: '8px 4px', borderRadius: 10, border: `1px solid ${category===k ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`, background: category===k ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: category===k ? '#fff' : '#9ca3af', fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">¿Dónde está ahora?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(['casa1', 'casa2', 'desconocido'] as ItemLocation[]).map(loc => {
            const cfg = LOC_CONFIG[loc]
            return (
              <button key={loc} onClick={() => setLocation(loc)}
                style={{ padding: '8px 4px', borderRadius: 10, border: `1px solid ${location===loc ? cfg.color : 'rgba(255,255,255,0.1)'}`, background: location===loc ? cfg.bg : 'rgba(255,255,255,0.04)', color: location===loc ? cfg.color : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {locLabels[loc]}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div onClick={() => setIsRecurring(!isRecurring)}
            style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isRecurring ? '#8b5cf6' : 'rgba(255,255,255,0.2)'}`, background: isRecurring ? '#8b5cf6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            {isRecurring && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>🔄 Viaja siempre en cada cambio de custodia</span>
        </label>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="settings-label">Notas (opcional)</div>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Talla, color, descripción..." className="settings-input" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className={`btn-primary btn-violet ${(!name.trim() || loading) ? 'btn-disabled' : ''}`} style={{ flex: 1 }} onClick={handleSubmit}>
          {loading ? 'Guardando...' : 'Añadir objeto'}
        </button>
      </div>
    </div>
  )
}
