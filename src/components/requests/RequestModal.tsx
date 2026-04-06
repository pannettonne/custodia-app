'use client'

import { useState, useMemo } from 'react'
import { X, Calendar, ArrowRight, FileText } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { createChangeRequest } from '@/lib/db'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  initialDate?: string | null
}

export function RequestModal({ open, onClose, initialDate }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId, requests } = useAppStore()

  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )

  const otherParentId = useMemo(() => {
    if (!child || !user) return null
    return child.parents.find((p) => p !== user.uid) ?? null
  }, [child, user])

  const [type, setType] = useState<'single' | 'range'>(initialDate ? 'single' : 'single')
  const [date, setDate] = useState(initialDate ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const otherParentName = otherParentId ? (child?.parentNames?.[otherParentId] ?? 'El otro progenitor') : '—'

  const handleSubmit = async () => {
    if (!user || !child || !otherParentId || !reason.trim()) return

    setLoading(true)
    try {
      await createChangeRequest({
        childId: child.id,
        fromParentId: user.uid,
        fromParentName: user.displayName ?? user.email ?? 'Progenitor',
        toParentId: otherParentId,
        type,
        ...(type === 'single' ? { date } : { startDate, endDate }),
        reason: reason.trim(),
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 1500)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const isValid =
    reason.trim().length > 0 &&
    (type === 'single' ? !!date : !!startDate && !!endDate && startDate <= endDate)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">Solicitar cambio de custodia</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Se enviará a <span className="text-blue-400">{otherParentName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-white font-semibold">Solicitud enviada</p>
            <p className="text-slate-400 text-sm mt-1">{otherParentName} recibirá tu petición</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Tipo de solicitud */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Tipo de cambio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'single', label: 'Día concreto', icon: Calendar },
                  { value: 'range', label: 'Rango de fechas', icon: ArrowRight },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setType(value as 'single' | 'range')}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all',
                      type === value
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    )}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                {type === 'single' ? 'Fecha' : 'Período'}
              </label>
              {type === 'single' ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Desde</p>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Hasta</p>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Motivo */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                <div className="flex items-center gap-1.5">
                  <FileText size={12} />
                  Motivo / Observaciones
                </div>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explica el motivo del cambio..."
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 resize-none"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-400 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
