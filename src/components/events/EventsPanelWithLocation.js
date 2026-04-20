'use client';
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/app';
import { CAT_CONFIG } from './location/shared';
import { EventCard } from './location/EventCard';
import { EventForm } from './location/EventForm';
export function EventsPanel({ focusTargetId, focusSeq, initialCreateDate, createSeq, } = {}) {
    const { events } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showPast, setShowPast] = useState(false);
    const [showUpcoming, setShowUpcoming] = useState(true);
    const [showPendingAssignments, setShowPendingAssignments] = useState(true);
    const [highlightedId, setHighlightedId] = useState(null);
    const cardRefs = useRef({});
    const filtered = useMemo(() => {
        const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
        return filter === 'all' ? sorted : sorted.filter(event => event.category === filter);
    }, [events, filter]);
    const today = new Date().toISOString().slice(0, 10);
    const pendingAssignments = filtered.filter(event => event.assignmentStatus === 'pending');
    const todayEvents = filtered.filter(event => event.date === today && event.assignmentStatus !== 'pending');
    const upcoming = filtered.filter(event => event.date > today && event.assignmentStatus !== 'pending');
    const past = filtered.filter(event => event.date < today && event.assignmentStatus !== 'pending');
    useEffect(() => {
        if (!focusTargetId || !focusTargetId.startsWith('event-'))
            return;
        const targetEventId = focusTargetId.replace('event-', '');
        const targetEvent = events.find(event => event.id === targetEventId);
        if (!targetEvent)
            return;
        if (targetEvent.assignmentStatus === 'pending' && !showPendingAssignments) {
            setShowPendingAssignments(true);
            return;
        }
        if (targetEvent.date < today && !showPast) {
            setShowPast(true);
            return;
        }
        if (targetEvent.date > today && !showUpcoming) {
            setShowUpcoming(true);
            return;
        }
        const target = cardRefs.current[focusTargetId];
        if (!target)
            return;
        const timer = window.setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedId(focusTargetId);
        }, 80);
        const clearTimer = window.setTimeout(() => {
            setHighlightedId(current => (current === focusTargetId ? null : current));
        }, 2600);
        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(clearTimer);
        };
    }, [events, focusSeq, focusTargetId, showPast, showPendingAssignments, showUpcoming, today]);
    useEffect(() => {
        if (!initialCreateDate || !createSeq)
            return;
        setEditingEvent(null);
        setShowForm(true);
    }, [initialCreateDate, createSeq]);
    const Section = ({ title, count, open, onToggle, children, }) => {
        if (count === 0)
            return null;
        return (_jsxs("div", { style: { marginBottom: 14 }, children: [_jsxs("button", { onClick: onToggle, style: {
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'none',
                        border: 'none',
                        padding: '0 0 8px 0',
                        cursor: 'pointer',
                    }, children: [_jsxs("div", { className: "section-title", style: { margin: 0 }, children: [title, " (", count, ")"] }), _jsx("span", { style: { color: 'var(--text-muted)', fontSize: 12 }, children: open ? 'Ocultar' : 'Mostrar' })] }), open && children] }));
    };
    const renderEventCard = (event) => {
        const searchId = `event-${event.id}`;
        return (_jsx("div", { ref: element => {
                cardRefs.current[searchId] = element;
            }, style: highlightedId === searchId
                ? {
                    borderRadius: 22,
                    boxShadow: '0 0 0 2px rgba(16,185,129,0.45), 0 20px 44px rgba(16,185,129,0.16)',
                    transition: 'box-shadow 0.2s ease',
                }
                : undefined, children: _jsx(EventCard, { event: event, onEdit: () => {
                    setEditingEvent(event);
                    setShowForm(true);
                } }) }, event.id));
    };
    return (_jsxs("div", { children: [_jsx("div", { className: "card", style: {
                    marginBottom: 16,
                    padding: 16,
                    borderRadius: 20,
                    background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)',
                }, children: _jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                    }, children: [_jsxs("div", { children: [_jsx("div", { style: {
                                        fontSize: 11,
                                        color: 'var(--text-muted)',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.4,
                                        marginBottom: 4,
                                    }, children: "Agenda escolar" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsx("div", { className: "page-title", style: { marginBottom: 0 }, children: "Eventos" }), todayEvents.length + upcoming.length > 0 && (_jsxs("span", { style: {
                                                background: 'rgba(16,185,129,0.15)',
                                                color: '#10b981',
                                                fontSize: 11,
                                                fontWeight: 800,
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                            }, children: [todayEvents.length + upcoming.length, " activos"] }))] }), _jsx("div", { style: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }, children: "Tus eventos ya creados ahora tambi\u00E9n se ven m\u00E1s limpios y consistentes." })] }), _jsx("button", { onClick: () => {
                                setEditingEvent(null);
                                setShowForm(true);
                            }, style: {
                                background: '#10b981',
                                border: 'none',
                                borderRadius: 12,
                                padding: '10px 14px',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 10px 24px rgba(16,185,129,0.22)',
                            }, children: "+ Evento" })] }) }), _jsx("div", { style: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }, children: [['all', '🗓️', 'Todos'], ...Object.entries(CAT_CONFIG).map(([key, value]) => [key, value.icon, value.label])].map(([key, icon, label]) => (_jsxs("button", { onClick: () => setFilter(key), style: {
                        flexShrink: 0,
                        padding: '7px 12px',
                        borderRadius: 999,
                        border: `1px solid ${filter === key ? 'var(--text-strong)' : 'var(--border)'}`,
                        background: filter === key ? 'var(--bg-soft)' : 'var(--bg-card)',
                        color: filter === key ? 'var(--text-strong)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }, children: [_jsx("span", { style: { fontSize: 13 }, children: icon }), label] }, key))) }), showForm && (_jsx(EventForm, { event: editingEvent, onClose: () => {
                    setShowForm(false);
                    setEditingEvent(null);
                }, initialDate: initialCreateDate })), !showForm && filtered.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-state-icon", children: "\uD83C\uDF93" }), _jsx("div", { className: "empty-state-title", children: "Sin eventos" }), _jsx("div", { className: "empty-state-sub", children: "A\u00F1ade reuniones, ex\u00E1menes, vacaciones..." })] })) : null, _jsx(Section, { title: "Asignaciones pendientes", count: pendingAssignments.length, open: showPendingAssignments, onToggle: () => setShowPendingAssignments(value => !value), children: _jsx("div", { children: pendingAssignments.map(renderEventCard) }) }), todayEvents.length > 0 && (_jsxs("div", { style: { marginBottom: 14 }, children: [_jsxs("div", { className: "section-title", style: { marginBottom: 8 }, children: ["Hoy (", todayEvents.length, ")"] }), _jsx("div", { children: todayEvents.map(renderEventCard) })] })), _jsx(Section, { title: "Pr\u00F3ximos", count: upcoming.length, open: showUpcoming, onToggle: () => setShowUpcoming(value => !value), children: _jsx("div", { children: upcoming.map(renderEventCard) }) }), _jsx(Section, { title: "Pasados", count: past.length, open: showPast, onToggle: () => setShowPast(value => !value), children: _jsx("div", { children: past.map(renderEventCard) }) })] }));
}
