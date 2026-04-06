'use client'

import { useState, useMemo } from 'react'
import { Baby, Mail, Settings, Palette, Calendar as CalIcon, UserPlus } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { createChild, createInvitation, acceptInvitation, setPattern } from '@/lib/db'
import { cn, PARENT_COLORS, PATTERN_LABELS } from '@/lib/utils'
import type { Child } from '@/types'

export function SettingsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId, invitations, pattern } = useAppStore()

  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )

  return (
    <div className="space-y-6">
      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <PendingInvitations invitations={invitations} />
      )}

      {/* Selector / creador de menor */}
      <ChildSection child={child} />

      {/* Configuración de patrón */}
      {child && <PatternSection child={child} />}

      {/* Invitar al otro progenitor */}
      {child && child.parents.length < 2 && <InviteParentSection child={child} />}

      {/* Info del otro progenitor */}
      {child && child.parents.length >= 2 && <ParentsInfo child={child} />}
    </div>
  )
}

// ─── Pending Invitations ─────────────────────────────────────────────────────

function PendingInvitations({ invitations }: { invitations: any[] }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)

  const handleAccept = async (inv: any) => {
    if (!user) return
    setLoading(inv.id)
    try {
      await acceptInvitation(inv, user.uid, user.displayName ?? user.email ?? 'Progenitor')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mail size={16} className="text-blue-400" />
        <h3 className="text-blue-300 font-semibold text-sm">Invitaciones recibidas</h3>
      </div>
      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-white text-sm font-medium">
              {inv.fromName} te invita a gestionar a <strong>{inv.childName}</strong>
            </p>
            <p className="text-slate-400 text-xs">{inv.fromEmail}</p>
          </div>
          <button
            onClick={() => handleAccept(inv)}
            disabled={loading === inv.id}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading === inv.id ? '...' : 'Aceptar'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Child Section ────────────────────────────────────────────────────────────

function ChildSection({ child }: { child: Child | null }) {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId } = useAppStore()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [color, setColor] = useState(PARENT_COLORS[0])
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!user || !name.trim()) return
    setLoading(true)
    try {
      const id = await createChild({
        name: name.trim(),
        birthDate,
        createdBy: user.uid,
        parents: [user.uid],
        parentEmails: [user.email ?? ''],
        parentNames: { [user.uid]: user.displayName ?? user.email ?? 'Yo' },
        parentColors: { [user.uid]: color },
      })
      setSelectedChildId(id)
      setShowForm(false)
      setName('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Baby size={16} className="text-pink-400" />
          <h3 className="text-slate-300 font-semibold text-sm">Menor</h3>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            + Añadir menor
          </button>
        )}
      </div>

      {/* Lista de menores */}
      {children.length > 0 && (
        <div className="space-y-2 mb-3">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChildId(c.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                selectedChildId === c.id
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
                {c.name[0]}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{c.name}</p>
                <p className="text-slate-500 text-xs">{c.parents.length} progenitor(es)</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nombre del menor</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Fecha de nacimiento (opcional)</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Tu color en el calendario</label>
            <div className="flex gap-2 flex-wrap">
              {PARENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-transform',
                    color === c && 'scale-125 ring-2 ring-white'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-xl border border-white/20 text-slate-400 text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              className="flex-1 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-sm font-bold transition-colors"
            >
              {loading ? '...' : 'Crear'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pattern Section ──────────────────────────────────────────────────────────

function PatternSection({ child }: { child: Child }) {
  const { user } = useAuth()
  const { pattern } = useAppStore()

  const [patternType, setPatternType] = useState<string>(pattern?.type ?? 'alternating_weekly')
  const [startDate, setStartDate] = useState(pattern?.startDate ?? '')
  const [startParentId, setStartParentId] = useState(pattern?.startParentId ?? child.parents[0])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!user || !startDate) return
    setLoading(true)
    try {
      await setPattern({
        childId: child.id,
        type: patternType as any,
        startDate,
        startParentId,
        createdBy: user.uid,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalIcon size={16} className="text-violet-400" />
        <h3 className="text-slate-300 font-semibold text-sm">Patrón de custodia</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Tipo de régimen</label>
          <select
            value={patternType}
            onChange={(e) => setPatternType(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          >
            {Object.entries(PATTERN_LABELS).map(([v, l]) => (
              <option key={v} value={v} className="bg-slate-900">
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Fecha de inicio del patrón</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>

        {child.parents.length >= 2 && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">¿Quién empieza?</label>
            <div className="grid grid-cols-2 gap-2">
              {child.parents.map((pid) => (
                <button
                  key={pid}
                  onClick={() => setStartParentId(pid)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all',
                    startParentId === pid
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: child.parentColors?.[pid] }}
                  />
                  {child.parentNames?.[pid]?.split(' ')[0] ?? 'Progenitor'}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!startDate || loading}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-bold transition-all',
            saved
              ? 'bg-green-600 text-white'
              : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white'
          )}
        >
          {loading ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar patrón'}
        </button>
      </div>
    </div>
  )
}

// ─── Invite Parent Section ────────────────────────────────────────────────────

function InviteParentSection({ child }: { child: Child }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleInvite = async () => {
    if (!user || !email.trim()) return
    setLoading(true)
    try {
      await createInvitation({
        childId: child.id,
        childName: child.name,
        fromEmail: user.email ?? '',
        fromName: user.displayName ?? user.email ?? 'Progenitor',
        toEmail: email.trim().toLowerCase(),
      })
      setSent(true)
      setEmail('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus size={16} className="text-green-400" />
        <h3 className="text-slate-300 font-semibold text-sm">Invitar al otro progenitor</h3>
      </div>

      {sent ? (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">📨</div>
          <p className="text-green-400 text-sm font-medium">Invitación enviada</p>
          <p className="text-slate-500 text-xs mt-1">
            Cuando acepte, verá el mismo calendario
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-3 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Invitar a otro
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-500 text-xs">
            Introduce el email de Google del otro progenitor. Recibirá acceso al calendario de{' '}
            <strong className="text-slate-300">{child.name}</strong>.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleInvite}
            disabled={!email.includes('@') || loading}
            className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-bold transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Parents Info ─────────────────────────────────────────────────────────────

function ParentsInfo({ child }: { child: Child }) {
  const { user } = useAuth()

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings size={16} className="text-slate-400" />
        <h3 className="text-slate-300 font-semibold text-sm">Progenitores</h3>
      </div>
      <div className="space-y-2">
        {child.parents.map((pid) => (
          <div key={pid} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: child.parentColors?.[pid] ?? '#6B7280' }}
            >
              {(child.parentNames?.[pid] ?? '?')[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-medium">
                {child.parentNames?.[pid] ?? 'Progenitor'}
                {pid === user?.uid && (
                  <span className="ml-2 text-xs text-slate-400">(tú)</span>
                )}
              </p>
              <p className="text-slate-500 text-xs">{child.parentEmails?.[child.parents.indexOf(pid)]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
