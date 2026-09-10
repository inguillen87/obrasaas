"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, Tabs, PageHeader, Modal } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

const TIPOS_CITA = [
  'Visita Comitente',
  'Inspección Municipal',
  'Entrega Material',
  'Coordinación Gremios'
];

const TIPO_COLORS = {
  'Visita Comitente': tokens.colors.accent.primary,
  'Inspección Municipal': tokens.colors.accent.danger,
  'Entrega Material': tokens.colors.accent.info,
  'Coordinación Gremios': tokens.colors.accent.purple
};

const ESTADOS = {
  programada: { label: 'Programada', color: tokens.colors.accent.info },
  confirmada: { label: 'Confirmada', color: tokens.colors.accent.primary },
  en_curso: { label: 'En Curso', color: tokens.colors.accent.warning },
  completada: { label: 'Completada', color: tokens.colors.accent.success },
  cancelada: { label: 'Cancelada', color: tokens.colors.text.muted }
};

export default function CalendarioPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [activeTab, setActiveTab] = useState('mensual');
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({
    citasEstaSemana: 0,
    pendientesConfirmacion: 0,
    visitasCumplidas: 0,
    alertasReprogramacion: 0
  });
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  // Filter states for list view
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterEstado, setFilterEstado] = useState('Todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    obra: '',
    date: '',
    time: '',
    tipo: 'Visita Comitente',
    contacto: '',
    telefono: '',
    participants: '',
    notas: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/calendario');
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
        setStats(data.stats || {
          citasEstaSemana: 0,
          pendientesConfirmacion: 0,
          visitasCumplidas: 0,
          alertasReprogramacion: 0
        });
      } else {
        // Fallback demo data
        setAppointments([
          {
            id: '1',
            title: 'Reunión de Avance',
            obra: 'Torre Central',
            date: new Date().toISOString().split('T')[0],
            time: '10:00',
            tipo: 'Visita Comitente',
            estado: 'confirmada',
            contacto: 'Juan Pérez',
            telefono: '+5491112345678',
            participants: 'Arq. Martínez, Ing. Gómez',
            notas: 'Revisión de planos de instalación eléctrica'
          },
          {
            id: '2',
            title: 'Inspección Estructura',
            obra: 'Complejo Norte',
            date: new Date().toISOString().split('T')[0],
            time: '14:30',
            tipo: 'Inspección Municipal',
            estado: 'programada',
            contacto: 'Inspector Suárez',
            telefono: '+5491187654321',
            participants: 'Ing. López',
            notas: 'Inspección de hormigón en losa'
          }
        ]);
        setStats({
          citasEstaSemana: 12,
          pendientesConfirmacion: 3,
          visitasCumplidas: 45,
          alertasReprogramacion: 1
        });
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const evtSource = new EventSource('/api/v1/sse');
    evtSource.onopen = () => setSseConnected(true);
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CALENDAR_UPDATE') {
          loadData();
        }
      } catch (e) {}
    };
    evtSource.onerror = () => setSseConnected(false);

    return () => evtSource.close();
  }, [loadData]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        loadData();
        setFormData({
          title: '',
          obra: '',
          date: '',
          time: '',
          tipo: 'Visita Comitente',
          contacto: '',
          telefono: '',
          participants: '',
          notas: ''
        });
      }
    } catch (error) {
      console.error('Error submitting appointment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotify = async (id) => {
    try {
      await fetch('/api/v1/calendario/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      alert('Recordatorio enviado exitosamente');
    } catch (error) {
      console.error('Error notifying:', error);
    }
  };

  const tabs = [
    { id: 'mensual', label: 'Mensual', icon: <i className="fa-solid fa-calendar-days"></i> },
    { id: 'semanal', label: 'Semanal', icon: <i className="fa-solid fa-calendar-week"></i> },
    { id: 'lista', label: 'Lista', icon: <i className="fa-solid fa-list"></i> }
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 30, height: 30, border: `3px solid ${tokens.colors.accent.primary}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
        </div>
      );
    }

    if (activeTab === 'mensual') {
      const daysInMonth = 30; // Septiembre 2026
      const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const weekDayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

      return (
        <GlassCard style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: tokens.colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-calendar-days" style={{ color: tokens.colors.accent.primary }}></i> Septiembre 2026
            </h3>
            <Badge color={tokens.colors.accent.primary} variant="filled" size="xs">
              {appointments.length} Citas Programadas
            </Badge>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {weekDayHeaders.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: tokens.colors.text.muted, padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid (Sept 1 2026 starts on Tuesday, offset = 1) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            <div style={{ minHeight: '80px', background: 'rgba(255,255,255,0.01)', borderRadius: tokens.radius.sm }}></div>
            {monthDays.map(day => {
              const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
              const dayAppts = appointments.filter(a => (a.fecha || a.date) === dateStr);
              const isToday = day === 10;

              return (
                <div 
                  key={day} 
                  style={{
                    minHeight: '80px',
                    padding: '8px',
                    borderRadius: tokens.radius.sm,
                    background: dayAppts.length > 0 ? 'rgba(56, 189, 248, 0.08)' : isToday ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${dayAppts.length > 0 ? 'rgba(56, 189, 248, 0.3)' : isToday ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#fbbf24' : tokens.colors.text.secondary }}>
                      {day} {isToday && '• Hoy'}
                    </span>
                    {dayAppts.length > 0 && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }}></span>
                    )}
                  </div>

                  {dayAppts.map(a => (
                    <div 
                      key={a.id} 
                      style={{
                        fontSize: '0.68rem',
                        padding: '3px 5px',
                        marginBottom: '3px',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#f8fafc',
                        borderLeft: `2px solid ${TIPO_COLORS[a.tipo] || '#38bdf8'}`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`${a.title} (${a.hora || a.time} hs)`}
                    >
                      {a.hora || a.time} {a.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </GlassCard>
      );
    }

    if (activeTab === 'semanal') {
      const weekDays = [
        { label: 'Lun 14', date: '2026-09-14' },
        { label: 'Mar 15', date: '2026-09-15' },
        { label: 'Mié 16', date: '2026-09-16' },
        { label: 'Jue 17', date: '2026-09-17' },
        { label: 'Vie 18', date: '2026-09-18' },
        { label: 'Sáb 19', date: '2026-09-19' },
        { label: 'Dom 20', date: '2026-09-20' }
      ];

      return (
        <GlassCard style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: tokens.colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-calendar-week" style={{ color: tokens.colors.accent.primary }}></i> Semana 14 al 20 de Septiembre 2026
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {weekDays.map(wd => {
              const dayAppts = appointments.filter(a => (a.fecha || a.date) === wd.date);
              return (
                <div 
                  key={wd.date}
                  style={{
                    padding: '12px',
                    borderRadius: tokens.radius.sm,
                    background: dayAppts.length > 0 ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${dayAppts.length > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)'}`,
                    minHeight: '220px'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: dayAppts.length > 0 ? '#38bdf8' : tokens.colors.text.secondary, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '10px' }}>
                    {wd.label}
                  </div>

                  {dayAppts.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: tokens.colors.text.muted, fontStyle: 'italic', paddingTop: '20px', textAlign: 'center' }}>
                      Sin citas
                    </div>
                  ) : (
                    dayAppts.map(a => (
                      <div 
                        key={a.id}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.7)',
                          borderLeft: `3px solid ${TIPO_COLORS[a.tipo] || '#38bdf8'}`,
                          marginBottom: '8px',
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}
                      >
                        <Badge color={TIPO_COLORS[a.tipo] || tokens.colors.accent.primary} variant="outline" size="xs">
                          {a.tipo}
                        </Badge>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                          {a.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                          <i className="fa-regular fa-clock"></i> {a.hora || a.time} hs
                        </div>
                        {a.estado === 'programada' && (
                          <div style={{ marginTop: '6px' }}>
                            <Button variant="whatsapp" size="xs" onClick={() => handleNotify(a.id)}>
                              WhatsApp
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      );
    }

    const filteredAppointments = appointments.filter(app => {
      const matchTipo = filterTipo === 'Todos' || app.tipo === filterTipo;
      const matchEstado = filterEstado === 'Todos' || app.estado === filterEstado;
      return matchTipo && matchEstado;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <GlassCard style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '16px' }}>
          <select 
            value={filterTipo} 
            onChange={e => setFilterTipo(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, color: 'white', borderRadius: tokens.radius.sm }}
          >
            <option value="Todos">Todos los Tipos</option>
            {TIPOS_CITA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select 
            value={filterEstado} 
            onChange={e => setFilterEstado(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, color: 'white', borderRadius: tokens.radius.sm }}
          >
            <option value="Todos">Todos los Estados</option>
            {Object.keys(ESTADOS).map(k => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
          </select>
        </GlassCard>

        <AnimatePresence>
          {filteredAppointments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: tokens.colors.text.muted }}>
              <p>No hay citas que coincidan con los filtros.</p>
            </div>
          ) : (
            filteredAppointments.map(app => (
              <GlassCard key={app.id} delay={0.1}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <Badge color={TIPO_COLORS[app.tipo] || tokens.colors.accent.primary} variant="outline" size="xs">
                        {app.tipo}
                      </Badge>
                      <Badge color={ESTADOS[app.estado]?.color || tokens.colors.text.muted} variant="filled" size="xs">
                        {ESTADOS[app.estado]?.label || app.estado}
                      </Badge>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', color: tokens.colors.text.primary }}>{app.title}</h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: tokens.colors.text.secondary }}>
                      <i className="fa-solid fa-location-dot" style={{ width: '20px' }}></i> {app.obra || app.obraId || 'Torre Palermo Soho'}
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: tokens.colors.text.secondary }}>
                      <i className="fa-solid fa-clock" style={{ width: '20px' }}></i> {app.fecha || app.date} a las {app.hora || app.time} hs
                    </p>
                    {(app.participantes || app.participants) && (
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: tokens.colors.text.muted }}>
                        <strong>Participantes:</strong> {Array.isArray(app.participantes) ? app.participantes.join(', ') : (app.participantes || app.participants)}
                      </p>
                    )}
                    {app.notas && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: tokens.colors.text.muted, fontStyle: 'italic' }}>
                        "{app.notas}"
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' }}>
                    {app.estado === 'programada' && (
                      <Button variant="whatsapp" size="sm" onClick={() => handleNotify(app.id)} icon={<i className="fa-brands fa-whatsapp"></i>}>
                        Recordatorio
                      </Button>
                    )}
                    <Button variant="secondary" size="sm">
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: tokens.colors.bg.primary, color: tokens.colors.text.primary, paddingBottom: '80px' }}>
      <PageHeader 
        title="Calendario de Citas" 
        subtitle="Coordinación de visitas, inspecciones y entregas"
        icon={<i className="fa-solid fa-calendar-days" style={{ color: tokens.colors.accent.primary }}></i>}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Calendario' }
        ]}
        actions={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {sseConnected && <span style={{ fontSize: '0.75rem', color: tokens.colors.accent.success, display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.colors.accent.success }}></div> En vivo</span>}
            <Button variant="primary" icon={<i className="fa-solid fa-plus"></i>} onClick={() => setIsModalOpen(true)}>
              Nueva Cita
            </Button>
          </div>
        }
      />

      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <StatCard 
            label="Citas Esta Semana" 
            value={stats.citasEstaSemana} 
            icon={<i className="fa-solid fa-calendar-week"></i>}
            color={tokens.colors.accent.primary}
          />
          <StatCard 
            label="Pendientes Confirmación" 
            value={stats.pendientesConfirmacion} 
            icon={<i className="fa-solid fa-clock"></i>}
            color={tokens.colors.accent.warning}
          />
          <StatCard 
            label="Visitas Cumplidas" 
            value={stats.visitasCumplidas} 
            icon={<i className="fa-solid fa-check"></i>}
            color={tokens.colors.accent.success}
          />
          <StatCard 
            label="Alertas Reprogramación" 
            value={stats.alertasReprogramacion} 
            icon={<i className="fa-solid fa-bell"></i>}
            color={tokens.colors.accent.danger}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {renderContent()}

      </main>

      {/* Floating Action Button for mobile */}
      {isMobile && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${tokens.colors.accent.primary}, ${tokens.colors.accent.primaryHover})`,
            color: '#000',
            border: 'none',
            boxShadow: tokens.shadow.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            zIndex: 50,
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-plus"></i>
        </motion.button>
      )}

      {/* Nueva Cita Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Programar Nueva Cita" subtitle="Complete los datos para registrar un nuevo evento en obra.">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Título</label>
            <input 
              required
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
              placeholder="Ej. Inspección de losa" 
            />
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Fecha</label>
              <input 
                required
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Hora</label>
              <input 
                required
                type="time"
                name="time"
                value={formData.time}
                onChange={handleFormChange}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Tipo de Cita</label>
            <select 
              name="tipo"
              value={formData.tipo}
              onChange={handleFormChange}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }}
            >
              {TIPOS_CITA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Obra</label>
            <input 
              required
              name="obra"
              value={formData.obra}
              onChange={handleFormChange}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
              placeholder="Ej. Torre Central" 
            />
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Contacto</label>
              <input 
                name="contacto"
                value={formData.contacto}
                onChange={handleFormChange}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
                placeholder="Nombre del contacto" 
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Teléfono WhatsApp</label>
              <input 
                name="telefono"
                value={formData.telefono}
                onChange={handleFormChange}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
                placeholder="+54 9 11..." 
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Participantes</label>
            <input 
              name="participants"
              value={formData.participants}
              onChange={handleFormChange}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white' }} 
              placeholder="Nombres o cargos" 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: tokens.colors.text.secondary, marginBottom: '6px' }}>Notas</label>
            <textarea 
              name="notas"
              value={formData.notas}
              onChange={handleFormChange}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: 'white', minHeight: '80px', resize: 'vertical' }} 
              placeholder="Detalles adicionales..."
            ></textarea>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={submitting}>Guardar Cita</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
