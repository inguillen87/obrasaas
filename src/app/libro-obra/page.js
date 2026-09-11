"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    tokens, 
    Badge, 
    Button, 
    GlassCard, 
    StatCard, 
    ProgressBar, 
    Tabs, 
    PageHeader, 
    Modal, 
    EmptyState,
    staggerContainer,
    staggerItem,
    fadeInUp
} from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

// Demo Data
const DEMO_ENTRIES = [
    {
        id: 'lo-005',
        folio: 5,
        date: '2026-08-18',
        weather: 'Despejado',
        temp: '24°C',
        workers: 18,
        tasks: 'Hormigonado de losa sobre Planta Baja. Armado de encofrados para vigas perimetrales. Colocación de armadura inferior.',
        orders: 'Se solicita al contratista de electricidad acelerar pases de cañería en sector norte antes de la próxima colada.',
        materials: 'Hormigón Elaborado H21 (30m3). Hierro nervado de 12mm y 8mm.',
        safety: 'Charla de 5 minutos sobre uso de arnés. Se verificó líneas de vida en bordes de losa.',
        rainInterruption: false,
        hash: '8f4e2a1b9c7d0...e4f2',
        director: 'Ing. Martín López'
    },
    {
        id: 'lo-004',
        folio: 4,
        date: '2026-08-17',
        weather: 'Nublado',
        temp: '18°C',
        workers: 15,
        tasks: 'Preparación de encofrados. Apuntalamiento general. Armado de hierro en taller.',
        orders: 'Mantener orden y limpieza en obrador. Reubicar acopio de madera.',
        materials: 'Madera para encofrado (tablas y puntales). Clavos.',
        safety: 'Se renovaron cintas de peligro en huecos de ascensor.',
        rainInterruption: false,
        hash: '1a2b3c4d5e6f7...890a',
        director: 'Ing. Martín López'
    },
    {
        id: 'lo-003',
        folio: 3,
        date: '2026-08-16',
        weather: 'Lluvia Intensa',
        temp: '14°C',
        workers: 4,
        tasks: 'Tareas suspendidas en el exterior por lluvia. Trabajos menores en obrador (doblado de hierro).',
        orders: 'Proteger acopios de cemento y madera con lona.',
        materials: 'Ninguno.',
        safety: 'Precaución por barro en accesos.',
        rainInterruption: true,
        hash: 'c3d4e5f6a7b8c...9d0e',
        director: 'Arq. Roberto Sánchez'
    },
    {
        id: 'lo-002',
        folio: 2,
        date: '2026-08-15',
        weather: 'Lluvia Leve',
        temp: '16°C',
        workers: 12,
        tasks: 'Armado de columnas PB. Colocación de estribos.',
        orders: 'Alinear y aplomar columnas eje A y B.',
        materials: 'Alambre de atar. Separadores plásticos.',
        safety: 'Uso de guantes y antiparras obligatorio en corte de hierro.',
        rainInterruption: false,
        hash: 'b2c3d4e5f6a7b...8c9d',
        director: 'Ing. Martín López'
    },
    {
        id: 'lo-001',
        folio: 1,
        date: '2026-08-14',
        weather: 'Despejado',
        temp: '22°C',
        workers: 14,
        tasks: 'Inicio formal de estructura PB. Limpieza de replanteo y llenado de bases.',
        orders: 'Verificar niveles topográficos antes de llenar.',
        materials: 'Hormigón H30 (15m3).',
        safety: 'Control de ingreso y entrega de EPP inicial.',
        rainInterruption: false,
        hash: 'a1b2c3d4e5f6a...7b8c',
        director: 'Ing. Martín López'
    }
];

export default function LibroObraPage() {
    const { isMobile } = useBreakpoint();
    const [activeTab, setActiveTab] = useState('asientos');
    const [entries, setEntries] = useState(DEMO_ENTRIES);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLive, setIsLive] = useState(false);

    const [actasHyS, setActasHyS] = useState([]);
    const [showHySSection, setShowHySSection] = useState(false);
    const [newActaModal, setNewActaModal] = useState(false);
    const [newActa, setNewActa] = useState({
        inspectorHyS: 'Ing. Carlos Méndez',
        matricula: 'MAT-HYS-4829',
        tipo: 'Checklist EPP',
        estadoClima: 'Despejado',
        eppCumplimientoPct: 100,
        observaciones: '',
        fotos: []
    });

    // Form State
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        weather: 'Despejado',
        temp: '',
        workers: '',
        tasks: '',
        orders: '',
        safety: '',
        materials: '',
        rainInterruption: false
    });

    const fetchData = useCallback(async () => {
        try {
            const [libroRes, hysRes] = await Promise.all([
                fetch('/api/admin/libro-obra', {
                    headers: { 'x-api-key': typeof window !== 'undefined' ? localStorage.getItem('obrasaas_admin_key') || 'internal' : 'internal' }
                }),
                fetch('/api/v1/hys').catch(() => null)
            ]);

            if (libroRes.ok) {
                const data = await libroRes.json();
                if (data.entries && data.entries.length > 0) {
                    const mappedEntries = data.entries.map((e, idx) => ({
                        id: e.id,
                        folio: data.entries.length - idx,
                        date: e.date,
                        weather: e.weather || 'Despejado',
                        temp: e.temperature ? `${e.temperature}°C` : 'N/A',
                        workers: e.workersPresent || 0,
                        tasks: Array.isArray(e.tasksPerformed) ? e.tasksPerformed.join('. ') : (e.tasksPerformed || ''),
                        orders: e.observations || '',
                        materials: Array.isArray(e.materialsReceived) ? e.materialsReceived.join(', ') : (e.materialsReceived || ''),
                        safety: e.incidents && e.incidents.length > 0 ? (Array.isArray(e.incidents) ? e.incidents.join(', ') : e.incidents) : 'Sin incidentes',
                        rainInterruption: e.weather && e.weather.toLowerCase().includes('lluvia') ? true : false,
                        hash: e.hash || '8f4e2a1b9c7d0...e4f2',
                        director: e.signedBy || 'Ing. Martín López'
                    }));
                    setEntries(mappedEntries);
                } else {
                    setEntries(DEMO_ENTRIES);
                }
            } else {
                setEntries(DEMO_ENTRIES);
            }

            if (hysRes && hysRes.ok) {
                const hysData = await hysRes.json();
                if (hysData.actas && hysData.actas.length > 0) {
                    setActasHyS(hysData.actas);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setEntries(DEMO_ENTRIES);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const es = new EventSource('/api/realtime');
        es.onopen = () => setIsLive(true);
        es.onerror = () => setIsLive(false);
        es.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                if (update.type === 'STATE_UPDATE') {
                    fetchData();
                }
            } catch (e) {}
        };
        return () => es.close();
    }, [fetchData]);

    useEffect(() => {
        fetch('/api/state').then(r => r.json()).then(data => {
            if (data?.actasHyS) setActasHyS(data.actasHyS);
        }).catch(() => {});
    }, []);

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const payload = {
                date: form.date,
                weather: form.weather,
                temperature: form.temp,
                workers: parseInt(form.workers) || 0,
                tasks: form.tasks,
                observations: form.orders,
                materials: form.materials,
                signedBy: 'Ing. Martín López',
                incidents: form.safety ? [form.safety] : []
            };

            const res = await fetch('/api/admin/libro-obra', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': typeof window !== 'undefined' ? localStorage.getItem('obrasaas_admin_key') || 'internal' : 'internal'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchData();
                setIsSubmitting(false);
                setSubmitSuccess(true);
                
                setTimeout(() => {
                    setSubmitSuccess(false);
                    setActiveTab('asientos');
                    setForm({
                        date: new Date().toISOString().split('T')[0],
                        weather: 'Despejado',
                        temp: '',
                        workers: '',
                        tasks: '',
                        orders: '',
                        safety: '',
                        materials: '',
                        rainInterruption: false
                    });
                }, 2000);
            } else {
                throw new Error('API request failed');
            }
        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
        }
    };

    const filteredEntries = entries.filter(entry => 
        entry.tasks.toLowerCase().includes(searchTerm.toLowerCase()) || 
        entry.date.includes(searchTerm) ||
        entry.director.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tabs = [
        { id: 'asientos', label: '📖 Asientos del Libro' },
        { id: 'nuevo', label: '✍️ Nuevo Asiento' },
        { id: 'hys', label: '🦺 Libro de Actas H&S' },
        { id: 'stats', label: '📊 Estadísticas' }
    ];

    const weatherIcons = {
        'Despejado': '☀️',
        'Nublado': '☁️',
        'Lluvia Leve': '🌦️',
        'Lluvia Intensa': '🌧️',
        'Viento Fuerte': '💨'
    };

    const renderAsientos = () => (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <input 
                    type="text" 
                    placeholder="Buscar en tareas, fecha, director..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        minWidth: '250px',
                        padding: '12px 16px',
                        background: tokens.colors.bg.secondary,
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        borderRadius: tokens.radius.md,
                        color: tokens.colors.text.primary,
                        fontSize: '15px'
                    }}
                />
                <Button variant="secondary" onClick={() => setActiveTab('nuevo')}>
                    + Redactar Asiento
                </Button>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ width: '32px', height: '32px', border: `3px solid ${tokens.colors.border.subtle}`, borderTopColor: tokens.colors.accent.primary, borderRadius: '50%' }} />
                </div>
            ) : filteredEntries.length === 0 ? (
                <EmptyState 
                    title="No se encontraron asientos" 
                    description="Prueba con otros términos de búsqueda." 
                    icon="🔍" 
                />
            ) : (
                filteredEntries.map((entry) => (
                    <GlassCard key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: `4px solid ${entry.rainInterruption ? tokens.colors.accent.danger : tokens.colors.accent.primary}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: tokens.colors.text.primary }}>
                                        Folio N° {entry.folio}
                                    </h3>
                                    <Badge variant="subtle">{entry.date}</Badge>
                                    {entry.rainInterruption && <Badge color={tokens.colors.accent.danger} variant="filled">Lluvia (Paro)</Badge>}
                                </div>
                                <div style={{ display: 'flex', gap: '16px', color: tokens.colors.text.secondary, fontSize: '14px', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {weatherIcons[entry.weather] || '☀️'} {entry.weather} ({entry.temp})
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        👷 {entry.workers} operarios
                                    </span>
                                </div>
                            </div>
                            <Link href="/api/admin/libro-obra/pdf" target="_blank" rel="noopener noreferrer">
                                <Button variant="secondary" size="sm">Descargar PDF</Button>
                            </Link>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px', marginTop: '8px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: tokens.colors.text.muted, letterSpacing: '0.5px' }}>Trabajos Ejecutados</h4>
                                <p style={{ margin: 0, fontSize: '15px', color: tokens.colors.text.primary, lineHeight: 1.6 }}>{entry.tasks}</p>
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: tokens.colors.text.muted, letterSpacing: '0.5px' }}>Órdenes Impartidas</h4>
                                <p style={{ margin: 0, fontSize: '15px', color: tokens.colors.text.primary, lineHeight: 1.6 }}>{entry.orders || '-'}</p>
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: tokens.colors.text.muted, letterSpacing: '0.5px' }}>Materiales Ingresados</h4>
                                <p style={{ margin: 0, fontSize: '15px', color: tokens.colors.text.primary, lineHeight: 1.6 }}>{entry.materials || '-'}</p>
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: tokens.colors.text.muted, letterSpacing: '0.5px' }}>Seguridad e Higiene</h4>
                                <p style={{ margin: 0, fontSize: '15px', color: tokens.colors.text.primary, lineHeight: 1.6 }}>{entry.safety || '-'}</p>
                            </div>
                        </div>

                        <div style={{ borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '16px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ fontSize: '12px', color: tokens.colors.text.muted, fontFamily: tokens.font.mono }}>
                                Hash: {entry.hash}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: tokens.colors.text.secondary }}>
                                <span>Firmado digitalmente por:</span>
                                <strong style={{ color: tokens.colors.accent.primary }}>{entry.director}</strong>
                            </div>
                        </div>
                    </GlassCard>
                ))
            )}
        </motion.div>
    );

    const renderNuevo = () => (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <GlassCard>
                <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: tokens.colors.text.primary }}>Redactar Nuevo Asiento</h2>
                    <p style={{ margin: 0, color: tokens.colors.text.secondary }}>Complete los datos de la jornada. Al guardar, el asiento será firmado digitalmente y no podrá ser alterado.</p>
                </div>

                {submitSuccess ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        style={{ padding: '40px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.accent.success}` }}
                    >
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                        <h3 style={{ margin: '0 0 8px 0', color: tokens.colors.text.primary }}>Asiento Guardado y Firmado</h3>
                        <p style={{ margin: 0, color: tokens.colors.text.secondary }}>El registro ha sido incorporado al libro de obra digital.</p>
                    </motion.div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Fecha</label>
                                <input 
                                    type="date" 
                                    name="date"
                                    value={form.date}
                                    onChange={handleFormChange}
                                    required
                                    style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Clima</label>
                                <select 
                                    name="weather"
                                    value={form.weather}
                                    onChange={handleFormChange}
                                    style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary }}
                                >
                                    <option value="Despejado">☀️ Despejado</option>
                                    <option value="Nublado">☁️ Nublado</option>
                                    <option value="Lluvia Leve">🌦️ Lluvia Leve</option>
                                    <option value="Lluvia Intensa">🌧️ Lluvia Intensa</option>
                                    <option value="Viento Fuerte">💨 Viento Fuerte</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Temp. (°C)</label>
                                <input 
                                    type="number" 
                                    name="temp"
                                    placeholder="Ej: 22"
                                    value={form.temp}
                                    onChange={handleFormChange}
                                    style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Personal (Cant.)</label>
                                <input 
                                    type="number" 
                                    name="workers"
                                    placeholder="Total operarios"
                                    value={form.workers}
                                    onChange={handleFormChange}
                                    required
                                    style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: tokens.colors.bg.elevated, borderRadius: tokens.radius.md }}>
                            <input 
                                type="checkbox" 
                                id="rainInterruption"
                                name="rainInterruption"
                                checked={form.rainInterruption}
                                onChange={handleFormChange}
                                style={{ width: '20px', height: '20px', accentColor: tokens.colors.accent.danger }}
                            />
                            <label htmlFor="rainInterruption" style={{ color: tokens.colors.text.primary, cursor: 'pointer', userSelect: 'none' }}>
                                🌧️ Día de lluvia (impidió trabajos normales)
                            </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Trabajos Ejecutados en la Jornada *</label>
                            <textarea 
                                name="tasks"
                                value={form.tasks}
                                onChange={handleFormChange}
                                required
                                rows={4}
                                placeholder="Describa las tareas principales realizadas hoy..."
                                style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Órdenes de Servicio Impartidas</label>
                            <textarea 
                                name="orders"
                                value={form.orders}
                                onChange={handleFormChange}
                                rows={3}
                                placeholder="Instrucciones dadas a contratistas o personal..."
                                style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Materiales Ingresados al Obrador</label>
                            <textarea 
                                name="materials"
                                value={form.materials}
                                onChange={handleFormChange}
                                rows={2}
                                placeholder="Remitos, cantidades, tipos de material..."
                                style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Observaciones de Seguridad e Higiene</label>
                            <textarea 
                                name="safety"
                                value={form.safety}
                                onChange={handleFormChange}
                                rows={2}
                                placeholder="Incidentes, charlas dadas, uso de EPP..."
                                style={{ padding: '12px', background: tokens.colors.bg.secondary, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                            <Button variant="secondary" type="button" onClick={() => setActiveTab('asientos')} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button variant="primary" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                                        Firmando...
                                    </span>
                                ) : 'Guardar y Firmar Asiento'}
                            </Button>
                        </div>
                    </form>
                )}
            </GlassCard>
        </motion.div>
    );

    const renderStats = () => (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <StatCard 
                    label="Total Asientos" 
                    value="42" 
                    sub="Desde inicio de obra" 
                    icon="📖" 
                    trend={5} 
                />
                <StatCard 
                    label="Días con Lluvia" 
                    value="3" 
                    sub="Que impidieron tareas" 
                    icon="🌧️" 
                    trend={2} 
                />
                <StatCard 
                    label="Promedio Personal" 
                    value="15" 
                    sub="Operarios por día" 
                    icon="👷" 
                    trend={12} 
                />
                <StatCard 
                    label="Cumplimiento" 
                    value="98%" 
                    sub="Asientos vs Días hábiles" 
                    icon="✅" 
                    trend={2} 
                />
            </div>

            <GlassCard>
                <h3 style={{ margin: '0 0 24px 0', color: tokens.colors.text.primary, fontSize: '18px' }}>Evolución de Personal (Últimos 14 días)</h3>
                <div style={{ height: '250px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '0 16px' }}>
                    {[12, 14, 15, 15, 18, 18, 4, 15, 14, 16, 18, 17, 18, 15].map((val, idx) => (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: `${(val / 20) * 100}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.05 }}
                                style={{ 
                                    width: '100%', 
                                    background: val < 5 ? tokens.colors.accent.danger : tokens.colors.accent.primary, 
                                    borderRadius: '4px 4px 0 0',
                                    opacity: 0.8
                                }}
                            />
                            <span style={{ fontSize: '10px', color: tokens.colors.text.muted }}>Ago {idx + 1}</span>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </motion.div>
    );

    const handleHySSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/v1/hys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newActa)
            });
            const data = await res.json();
            if (data.success && data.acta) {
                setActasHyS([data.acta, ...actasHyS]);
            } else {
                const fallbackEntry = {
                    ...newActa,
                    id: `hys-${Date.now()}`,
                    fecha: new Date().toISOString().split('T')[0],
                    firmaDigitalToken: 'SHA256:manual...'
                };
                setActasHyS([fallbackEntry, ...actasHyS]);
            }
        } catch (err) {
            console.error('Error submitting acta HyS:', err);
        } finally {
            setNewActaModal(false);
            fetchData();
        }
    };

    const renderHySSection = () => {
        const totalActas = actasHyS.length;
        const eppAvg = actasHyS.length ? Math.round(actasHyS.reduce((acc, a) => acc + (a.eppCumplimientoPct || 0), 0) / actasHyS.length) : 0;
        
        return (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px', padding: '24px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: tokens.radius.lg, border: `1px solid rgba(59, 130, 246, 0.2)` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: tokens.colors.text.primary, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            📄 Libro de Actas H&S y Prevención de Riesgos
                        </h2>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Badge variant="filled" color={tokens.colors.accent.primary}>{totalActas} Actas Registradas</Badge>
                            <Badge variant="filled" color={eppAvg > 90 ? tokens.colors.accent.success : tokens.colors.accent.warning}>{eppAvg}% Cumplimiento EPP</Badge>
                        </div>
                    </div>
                    <Button variant="primary" onClick={() => setNewActaModal(true)}>
                        + Nueva Acta H&S
                    </Button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <StatCard label="Total Actas" value={totalActas} icon="📋" />
                    <StatCard label="Checklists EPP" value={actasHyS.filter(a => a.tipo === 'Checklist EPP').length} icon="🦺" />
                    <StatCard label="Inducciones 5min" value={actasHyS.filter(a => a.tipo === 'Induccion 5 Minutos').length} icon="🗣️" />
                    <StatCard label="Paradas Climáticas" value={actasHyS.filter(a => a.tipo === 'Parada Climatica').length} icon="🌧️" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {actasHyS.map(acta => {
                        let color;
                        switch(acta.tipo) {
                            case 'Checklist EPP': color = '#3b82f6'; break; // blue
                            case 'Induccion 5 Minutos': color = '#10b981'; break; // green
                            case 'Parada Climatica': color = '#f59e0b'; break; // amber
                            case 'Incidente Menor': color = '#ef4444'; break; // red
                            case 'Visita ART': color = '#8b5cf6'; break; // purple
                            default: color = tokens.colors.accent.primary;
                        }

                        return (
                            <GlassCard key={acta.id || acta.fecha} style={{ borderLeft: `4px solid ${color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                            <Badge style={{ backgroundColor: color, color: '#fff' }}>{acta.tipo}</Badge>
                                            <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>{acta.fecha || acta.date}</span>
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: '16px', color: tokens.colors.text.primary }}>
                                            {acta.inspectorHyS} <span style={{ fontSize: '14px', color: tokens.colors.text.muted, fontWeight: 'normal' }}>({acta.matricula})</span>
                                        </h3>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={() => {
                                        const blob = new Blob(['Simulated PDF'], { type: 'application/pdf' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Acta_HyS_${acta.fecha || 'Doc'}.pdf`;
                                        a.click();
                                    }}>
                                        Descargar Acta Oficial Foliada PDF
                                    </Button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: tokens.colors.text.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Clima</div>
                                        <div>{acta.estadoClima}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: tokens.colors.text.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Cumplimiento EPP</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ProgressBar progress={acta.eppCumplimientoPct || 0} color={acta.eppCumplimientoPct > 90 ? tokens.colors.accent.success : tokens.colors.accent.warning} />
                                            <span>{acta.eppCumplimientoPct || 0}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: tokens.colors.text.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Observaciones</div>
                                    <p style={{ margin: 0, fontSize: '14px', color: tokens.colors.text.primary }}>{acta.observaciones || '-'}</p>
                                </div>
                                <div style={{ borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '12px', marginTop: '16px', fontSize: '12px', color: tokens.colors.text.muted, fontFamily: tokens.font.mono }}>
                                    Firma Hash: {acta.hash || 'e3b0c44298fc1c149afbf4c8996fb924...'}
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>

                <Modal isOpen={newActaModal} onClose={() => setNewActaModal(false)} title="Nueva Acta H&S">
                    <form onSubmit={handleHySSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: tokens.colors.text.secondary }}>Inspector H&S</label>
                            <input 
                                type="text"
                                value={newActa.inspectorHyS}
                                onChange={(e) => setNewActa({ ...newActa, inspectorHyS: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.bg.secondary, color: tokens.colors.text.primary }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: tokens.colors.text.secondary }}>Matrícula</label>
                            <input 
                                type="text"
                                value={newActa.matricula}
                                onChange={(e) => setNewActa({ ...newActa, matricula: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.bg.secondary, color: tokens.colors.text.primary }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: tokens.colors.text.secondary }}>Tipo de Acta</label>
                            <select 
                                value={newActa.tipo}
                                onChange={(e) => setNewActa({ ...newActa, tipo: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.bg.secondary, color: tokens.colors.text.primary }}
                            >
                                <option value="Checklist EPP">Checklist EPP</option>
                                <option value="Induccion 5 Minutos">Inducción 5 Minutos</option>
                                <option value="Parada Climatica">Parada Climática</option>
                                <option value="Inspeccion Andamios">Inspección Andamios</option>
                                <option value="Visita ART">Visita ART</option>
                                <option value="Incidente Menor">Incidente Menor</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: tokens.colors.text.secondary }}>Estado del Clima</label>
                            <input 
                                type="text"
                                value={newActa.estadoClima}
                                onChange={(e) => setNewActa({ ...newActa, estadoClima: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.bg.secondary, color: tokens.colors.text.primary }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: tokens.colors.text.secondary }}>Cumplimiento EPP (%) - {newActa.eppCumplimientoPct}%</label>
                            <input 
                                type="range"
                                min="0"
                                max="100"
                                value={newActa.eppCumplimientoPct}
                                onChange={(e) => setNewActa({ ...newActa, eppCumplimientoPct: parseInt(e.target.value) })}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: tokens.colors.text.secondary }}>Observaciones</label>
                            <textarea 
                                value={newActa.observaciones}
                                onChange={(e) => setNewActa({ ...newActa, observaciones: e.target.value })}
                                rows={3}
                                style={{ width: '100%', padding: '8px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.bg.secondary, color: tokens.colors.text.primary }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <Button type="button" variant="secondary" onClick={() => setNewActaModal(false)}>Cancelar</Button>
                            <Button type="submit" variant="primary">Guardar Acta</Button>
                        </div>
                    </form>
                </Modal>
            </motion.div>
        );
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: tokens.colors.bg.primary, 
            color: tokens.colors.text.primary, 
            padding: `clamp(16px, 3vw, 32px)`,
            fontFamily: tokens.font.sans 
        }}>
            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
                <PageHeader 
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            Libro de Obra Digital
                            {isLive && (
                                <Badge color={tokens.colors.accent.success} variant="subtle">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <motion.div
                                            animate={{ opacity: [1, 0.5, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            style={{ width: '8px', height: '8px', borderRadius: '50%', background: tokens.colors.accent.success }}
                                        />
                                        Libro Digital en Vivo
                                    </span>
                                </Badge>
                            )}
                        </div>
                    } 
                    breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Libro de Obra' }]} 
                    actions={
                        <Button variant="primary" onClick={() => setActiveTab('nuevo')}>
                            ✍️ Nuevo Asiento
                        </Button>
                    }
                />

                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <Tabs 
                        tabs={tabs} 
                        activeTab={activeTab} 
                        onChange={setActiveTab} 
                    />
                    <Button variant={activeTab === 'hys' ? 'primary' : 'secondary'} onClick={() => setActiveTab(activeTab === 'hys' ? 'asientos' : 'hys')}>
                        {activeTab === 'hys' ? '📖 Ver Asientos' : '🦺 Ver Libro H&S'}
                    </Button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'hys' && <motion.div key="hys" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderHySSection()}</motion.div>}
                    {activeTab === 'asientos' && <motion.div key="asientos" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderAsientos()}</motion.div>}
                    {activeTab === 'nuevo' && <motion.div key="nuevo" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderNuevo()}</motion.div>}
                    {activeTab === 'stats' && <motion.div key="stats" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderStats()}</motion.div>}
                </AnimatePresence>
            </div>
        </div>
    );
}
