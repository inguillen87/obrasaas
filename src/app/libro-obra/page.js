"use client";

import { useState, useEffect } from 'react';
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
        
        // Simular llamada a la API
        try {
            await fetch('/api/admin/libro-obra', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            }).catch(() => {}); // Ignoramos error si no existe el endpoint en este mock
            
            setTimeout(() => {
                const newEntry = {
                    id: `lo-00${entries.length + 1}`,
                    folio: entries.length + 1,
                    date: form.date,
                    weather: form.weather,
                    temp: form.temp ? `${form.temp}°C` : 'N/A',
                    workers: form.workers || 0,
                    tasks: form.tasks,
                    orders: form.orders,
                    materials: form.materials,
                    safety: form.safety,
                    rainInterruption: form.rainInterruption,
                    hash: Math.random().toString(36).substring(2, 15) + '...f0e1',
                    director: 'Ing. Martín López'
                };
                
                setEntries([newEntry, ...entries]);
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
            }, 1500);
        } catch (error) {
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

            {filteredEntries.map((entry) => (
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
            ))}

            {filteredEntries.length === 0 && (
                <EmptyState 
                    title="No se encontraron asientos" 
                    description="Prueba con otros términos de búsqueda." 
                    icon="🔍" 
                />
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
                    title="Libro de Obra Digital" 
                    breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Libro de Obra' }]} 
                    actions={
                        <Button variant="primary" onClick={() => setActiveTab('nuevo')}>
                            ✍️ Nuevo Asiento
                        </Button>
                    }
                />

                <div style={{ marginBottom: '32px' }}>
                    <Tabs 
                        tabs={tabs} 
                        activeTab={activeTab} 
                        onChange={setActiveTab} 
                    />
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'asientos' && <motion.div key="asientos" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderAsientos()}</motion.div>}
                    {activeTab === 'nuevo' && <motion.div key="nuevo" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderNuevo()}</motion.div>}
                    {activeTab === 'stats' && <motion.div key="stats" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden">{renderStats()}</motion.div>}
                </AnimatePresence>
            </div>
        </div>
    );
}
