'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, X, Clock, MessageSquare } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { respondToRequest, setOverride } from '@/lib/db'
import { cn, formatDate } from '@/lib/utils'
import type { ChangeRequest } from '@/types'
import { eachDayOfInterval, parseISO as parse } from 'date-fns'

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
  accepted: { label: 'Aceptada', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30' },
  rejected: { label: 'Rechazada', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
}

export function RequestsList() {
  const { user } = useAuth()
  const { requests, children, selectedChildId } = useAppStore()

  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )

  const { incoming, outgoing } = useMemo(() => {
    if (!user) return { incoming: [], outgoing: [] }
    return {
      incoming: requests.filter((r) => r.toParentId === user.uid),
      outgoing: requests.filter((r) => r.fromParentId === user.uid),
    }
  }, [requests, user?.uid])

  const handleAccept = async (req: ChangeRequest) => {
    if (!child || !user) return
    await respondToRequest(req.id, 'accepted')

    // Aplicar el cambio como override
    const dates =
      req.type === 'single'
        ? [req.date!]
        : eachDayOfInterval({
            start: parse(req.startDate!),
            end: parse(req.endDate!),
          }).map((d) => format(d, 'yyyy-MM-dd'))

    for (const date of dates) {
      await setOverride({
        childId: req.childId,
        date,
        parentId: req.fromParentId, // el que pidió el cambio se queda ese día
        reason: req.reason,
        createdBy: user.uid,
      })
    }
  }

  const handleReject = async (req: ChangeRequest) => {
    await respondToRequest(req.id, 'rejected')
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare size={40} className="text-slate-600 mb-3" />
        <p className="text-slate-400">No hay solicitudes de cambio</p>
        <p className="text-slate-600 text-sm mt-1">Las peticiones aparecerán aquí</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Recibidas ({incoming.length})
          </h3>
          <div className="space-y-3">
            {incoming.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                isIncoming
                onAccept={() => handleAccept(req)}
                onReject={() => handleReject(req)}
              />
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Enviadas ({outgoing.length})
          </h3>
          <div className="space-y-3">
            {outgoing.map((req) => (
              <RequestCard key={req.id} req={req} isIncoming={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RequestCard({
  req,
  isIncoming,
  onAccept,
  onReject,
}: {
  req: ChangeRequest
  isIncoming: boolean
  onAccept?: () => void
  onReject?: () => void
}) {
  const status = STATUS_CONFIG[req.status]

  const dateText =
    req.type === 'single'
      ? formatDate(req.date!)
      : `${formatDate(req.startDate!)} → ${formatDate(req.endDate!)}`

  return (
    <div className={cn('p-4 rounded-2xl border', status.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-bold', status.color)}>{status.label}</span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-slate-500 text-xs">
              {req.type === 'single' ? 'Día concreto' : 'Rango'}
            </span>
          </div>

          <p className="text-white font-semibold text-sm">
            {isIncoming ? req.fromParentName : 'Tú'} pide cambio
          </p>

          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="text-slate-300 text-sm font-mono bg-white/10 px-2 py-0.5 rounded-lg">
              {dateText}
            </div>
          </div>

          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            <span className="text-slate-500">Motivo: </span>
            {req.reason}
          </p>
        </div>
      </div>

      {isIncoming && req.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors"
          >
            <X size={14} />
            Rechazar
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm font-medium transition-colors"
          >
            <Check size={14} />
            Aceptar
          </button>
        </div>
      )}
    </div>
  )
}
