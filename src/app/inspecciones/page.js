"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, Tabs, PageHeader, EmptyState } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function InspeccionesPage() {
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    const [activeTab, setActiveTab] = useState('mis_inspecciones');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [selectedTemplate, setSelectedTemplate] = useState('Seguridad e Higiene SRT');
    const [checklistItems, setChecklistItems] = useState({});

    const tabs = [
        { id: 'mis_inspecciones', label: 'Mis Inspecciones', icon: '📋' },
        { id: 'nueva_inspeccion', label: 'Nueva Inspección', icon: '🆕' },
        { id: 'compliance', label: 'Compliance', icon: '📊' }
    ];

    const inspections = [
        { id: 'INSP-101', type: 'Seguridad e Higiene', icon: '👷', title: 'Inspección de Seguridad e Higiene (SRT Res. 319/99)', date: '19 Ago, 2026', inspector: 'Ing. Carlos Mendez', status: 'APROBADA', score: 92, passed: 11, failed: 1 },
        { id: 'INSP-102', type: 'Estructura', icon: '🏗️', title: 'Inspección de Estructura pre-Hormigonado (CIRSOC 201)', date: '18 Ago, 2026', inspector: 'Arq. Lucía Fernandez', status: 'OBSERVADA', score: 75, passed: 9, failed: 3 },
        { id: 'INSP-103', type: 'Instalación Eléctrica', icon: '⚡', title: 'Verificación de Instalación Eléctrica (RIEI)', date: '17 Ago, 2026', inspector: 'Tec. Marcelo Rojas', status: 'RECHAZADA', score: 40, passed: 4, failed: 6 },
        { id: 'INSP-104', type: 'Terminaciones', icon: '🔍', title: 'Inspección de Terminaciones y Vicios Ocultos', date: '19 Ago, 2026', inspector: 'Arq. Lucía Fernandez', status: 'PENDIENTE', score: 0, passed: 0, failed: 0 }
    ];

    const templates = [
        'Seguridad e Higiene SRT',
        'Pre-Hormigonado CIRSOC',
        'Instalación Eléctrica',
        'Instalación Sanitaria',
        'Terminaciones Finales'
    ];

    const safetyChecklist = [
        { id: 'chk-1', desc: 'EPP completo (casco, guantes, zapatos de seguridad)' },
        { id: 'chk-2', desc: 'Matafuegos operativos y vigentes' },
        { id: 'chk-3', desc: 'Tablero eléctrico con disyuntor diferencial' },
        { id: 'chk-4', desc: 'Vallado perimetral y señalización' },
        { id: 'chk-5', desc: 'Escaleras con barandas y atadas' },
        { id: 'chk-6', desc: 'Orden y limpieza del obrador' },
        { id: 'chk-7', desc: 'Botiquín de primeros auxilios completo' },
        { id: 'chk-8', desc: 'Capacitación documentada del personal' }
    ];

    const handleChecklistToggle = (id, value) => {
        setChecklistItems(prev => ({
            ...prev,
            [id]: { ...prev[id], status: value }
        }));
    };

    const handleChecklistNote = (id, note) => {
        setChecklistItems(prev => ({
            ...prev,
            [id]: { ...prev[id], note }
        }));
    };

    const calculateScore = () => {
        const items = Object.values(checklistItems);
        const answered = items.filter(i => i.status && i.status !== 'na');
        if (answered.length === 0) return 0;
        const passed = answered.filter(i => i.status === 'pass').length;
        return Math.round((passed / answered.length) * 100);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'APROBADA': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: '✅' };
            case 'OBSERVADA': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', icon: '⚠️' };
            case 'RECHAZADA': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: '❌' };
            case 'PENDIENTE': return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', icon: '⏳' };
            default: return { bg: 'rgba(255,255,255,0.1)', color: '#fff', icon: '' };
        }
    };

    const filteredInspections = inspections.filter(i => {
        if (filterStatus !== 'all' && i.status !== filterStatus) return false;
        if (filterType !== 'all' && i.type !== filterType) return false;
        return true;
    });

    return (
        <div style={{ minHeight: '100vh', background: tokens.colors.bg.primary, color: tokens.colors.text.primary, fontFamily: tokens.font.sans }}>
            <PageHeader
                title="Inspecciones & Checklists"
                subtitle="Gestión integral de calidad, seguridad y cumplimiento en obra"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inspecciones & Checklists' }]}
                actions={
                    <>
                        <Button variant="secondary" size="sm" onClick={() => setActiveTab('mis_inspecciones')}>Mis Inspecciones</Button>
                        <Button variant="primary" size="sm" icon="➕" onClick={() => setActiveTab('nueva_inspeccion')}>Crear Inspección</Button>
                    </>
                }
            />

            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 clamp(16px, 5vw, 32px) 48px' }}>
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} style={{ marginBottom: '32px' }} />

                <AnimatePresence mode="wait">
                    {/* TAB 1: MIS INSPECCIONES */}
                    {activeTab === 'mis_inspecciones' && (
                        <motion.div key="tab-mis-inspecciones" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                <select 
                                    value={filterStatus} 
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    style={{ background: tokens.colors.bg.elevated, color: tokens.colors.text.primary, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, padding: '8px 16px', outline: 'none' }}
                                >
                                    <option value="all">Todos los estados</option>
                                    <option value="APROBADA">Aprobadas</option>
                                    <option value="OBSERVADA">Observadas</option>
                                    <option value="RECHAZADA">Rechazadas</option>
                                    <option value="PENDIENTE">Pendientes</option>
                                </select>
                                <select 
                                    value={filterType} 
                                    onChange={(e) => setFilterType(e.target.value)}
                                    style={{ background: tokens.colors.bg.elevated, color: tokens.colors.text.primary, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, padding: '8px 16px', outline: 'none' }}
                                >
                                    <option value="all">Todos los tipos</option>
                                    <option value="Seguridad e Higiene">Seguridad e Higiene</option>
                                    <option value="Estructura">Estructura</option>
                                    <option value="Instalación Eléctrica">Instalación Eléctrica</option>
                                    <option value="Terminaciones">Terminaciones</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '24px' }}>
                                {filteredInspections.map((insp) => {
                                    const st = getStatusColor(insp.status);
                                    return (
                                        <GlassCard key={insp.id} hover style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '24px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: tokens.radius.md }}>
                                                        {insp.icon}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '13px', color: tokens.colors.text.secondary, marginBottom: '2px' }}>{insp.id} • {insp.type}</div>
                                                        <div style={{ fontWeight: 600, fontSize: '15px', color: tokens.colors.text.primary, lineHeight: 1.3 }}>{insp.title}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: tokens.colors.text.secondary }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>👤</span> {insp.inspector}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>📅</span> {insp.date}
                                                </div>
                                            </div>

                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: tokens.radius.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: tokens.radius.full, background: st.bg, color: st.color, fontSize: '12px', fontWeight: 600 }}>
                                                        {st.icon} {insp.status}
                                                    </div>
                                                    {insp.status !== 'PENDIENTE' && (
                                                        <div style={{ fontSize: '13px', color: tokens.colors.text.secondary, marginTop: '8px' }}>
                                                            {insp.passed} aprobados, {insp.failed} fallados
                                                        </div>
                                                    )}
                                                </div>
                                                {insp.status !== 'PENDIENTE' && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '24px', fontWeight: 700, color: insp.score >= 80 ? tokens.colors.accent.success : insp.score >= 60 ? tokens.colors.accent.warning : tokens.colors.accent.danger }}>
                                                            {insp.score}%
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: tokens.colors.text.secondary }}>Score</div>
                                                    </div>
                                                )}
                                            </div>
                                            <Button variant="secondary" size="sm" style={{ width: '100%' }}>Ver Detalles</Button>
                                        </GlassCard>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 2: NUEVA INSPECCIÓN */}
                    {activeTab === 'nueva_inspeccion' && (
                        <motion.div key="tab-nueva-inspeccion" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <GlassCard style={{ padding: '28px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: tokens.colors.text.primary }}>1. Seleccionar Plantilla</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {templates.map(tpl => (
                                                <div 
                                                    key={tpl}
                                                    onClick={() => setSelectedTemplate(tpl)}
                                                    style={{ 
                                                        padding: '16px', 
                                                        borderRadius: tokens.radius.md, 
                                                        border: `1px solid ${selectedTemplate === tpl ? tokens.colors.accent.primary : tokens.colors.border.default}`,
                                                        background: selectedTemplate === tpl ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.02)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px'
                                                    }}
                                                >
                                                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${selectedTemplate === tpl ? tokens.colors.accent.primary : tokens.colors.border.strong}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {selectedTemplate === tpl && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: tokens.colors.accent.primary }} />}
                                                    </div>
                                                    <span style={{ fontSize: '15px', color: selectedTemplate === tpl ? tokens.colors.text.primary : tokens.colors.text.secondary }}>{tpl}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </GlassCard>

                                    <GlassCard style={{ padding: '24px', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                                        <div style={{ fontSize: '14px', color: tokens.colors.text.secondary, marginBottom: '8px' }}>Score Actual</div>
                                        <div style={{ fontSize: '48px', fontWeight: 700, color: tokens.colors.accent.primary }}>
                                            {calculateScore()}%
                                        </div>
                                        <ProgressBar progress={calculateScore()} color={tokens.colors.accent.primary} height={8} />
                                    </GlassCard>
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <GlassCard style={{ padding: '32px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, paddingBottom: '16px' }}>
                                            <h2 style={{ fontSize: '24px', fontWeight: 600 }}>{selectedTemplate}</h2>
                                            <Badge variant="outline">{safetyChecklist.length} Ítems</Badge>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {safetyChecklist.map((item, idx) => {
                                                const state = checklistItems[item.id]?.status;
                                                return (
                                                    <div key={item.id} style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.md, padding: '20px' }}>
                                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                                            <div style={{ background: 'rgba(255,255,255,0.05)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
                                                                {idx + 1}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '16px', color: tokens.colors.text.primary, marginBottom: '16px', lineHeight: 1.4 }}>
                                                                    {item.desc}
                                                                </div>
                                                                
                                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                                    <button
                                                                        onClick={() => handleChecklistToggle(item.id, 'pass')}
                                                                        style={{ padding: '8px 16px', borderRadius: tokens.radius.sm, border: `1px solid ${state === 'pass' ? tokens.colors.accent.success : tokens.colors.border.strong}`, background: state === 'pass' ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: state === 'pass' ? tokens.colors.accent.success : tokens.colors.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, transition: 'all 0.2s' }}
                                                                    >
                                                                        ✅ CUMPLE
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleChecklistToggle(item.id, 'fail')}
                                                                        style={{ padding: '8px 16px', borderRadius: tokens.radius.sm, border: `1px solid ${state === 'fail' ? tokens.colors.accent.danger : tokens.colors.border.strong}`, background: state === 'fail' ? 'rgba(239, 68, 68, 0.15)' : 'transparent', color: state === 'fail' ? tokens.colors.accent.danger : tokens.colors.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, transition: 'all 0.2s' }}
                                                                    >
                                                                        ❌ NO CUMPLE
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleChecklistToggle(item.id, 'na')}
                                                                        style={{ padding: '8px 16px', borderRadius: tokens.radius.sm, border: `1px solid ${state === 'na' ? '#94a3b8' : tokens.colors.border.strong}`, background: state === 'na' ? 'rgba(148, 163, 184, 0.15)' : 'transparent', color: state === 'na' ? '#cbd5e1' : tokens.colors.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, transition: 'all 0.2s' }}
                                                                    >
                                                                        ➖ N/A
                                                                    </button>
                                                                    
                                                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder="Agregar observaciones..." 
                                                                            value={checklistItems[item.id]?.note || ''}
                                                                            onChange={(e) => handleChecklistNote(item.id, e.target.value)}
                                                                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radius.sm, color: tokens.colors.text.primary, outline: 'none' }}
                                                                        />
                                                                    </div>
                                                                    
                                                                    <button style={{ padding: '8px', borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.strong}`, background: 'transparent', color: tokens.colors.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        📷
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '24px' }}>
                                            <Button variant="secondary">Guardar Borrador</Button>
                                            <Button variant="primary" icon="📝">Finalizar Inspección</Button>
                                        </div>
                                    </GlassCard>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 3: COMPLIANCE */}
                    {activeTab === 'compliance' && (
                        <motion.div key="tab-compliance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                                <StatCard title="Total Inspecciones" value="128" trend="+12% este mes" variant="default" icon="📋" />
                                <StatCard title="Tasa de Aprobación" value="84%" trend="Estable" variant="success" icon="✅" />
                                <StatCard title="Inspecciones Atrasadas" value="3" trend="Requiere atención" variant="danger" icon="⚠️" />
                                <StatCard title="Score Promedio" value="88/100" trend="+2 pts vs mes anterior" variant="warning" icon="📈" />
                            </div>

                            <GlassCard style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text.primary }}>Línea de Tiempo de Cumplimiento (Últimas 6 inspecciones)</h3>
                                
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '20px 0' }}>
                                    <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: tokens.colors.border.strong, transform: 'translateY(-50%)', zIndex: 0 }} />
                                    
                                    {[
                                        { status: 'APROBADA', date: '01 Ago', name: 'SRT-01' },
                                        { status: 'APROBADA', date: '05 Ago', name: 'E-02' },
                                        { status: 'OBSERVADA', date: '08 Ago', name: 'IE-01' },
                                        { status: 'APROBADA', date: '12 Ago', name: 'S-03' },
                                        { status: 'RECHAZADA', date: '17 Ago', name: 'IE-02' },
                                        { status: 'APROBADA', date: '19 Ago', name: 'SRT-02' }
                                    ].map((item, idx) => {
                                        const st = getStatusColor(item.status);
                                        return (
                                            <div key={idx} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: tokens.colors.bg.card, padding: '0 8px' }}>
                                                <div style={{ fontSize: '12px', color: tokens.colors.text.secondary }}>{item.date}</div>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: st.bg, border: `2px solid ${st.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${st.color}40` }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color }} />
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: tokens.colors.text.primary }}>{item.name}</div>
                                                <div style={{ fontSize: '11px', color: st.color, fontWeight: 600 }}>{item.status}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function clamp(min, pref, max) {
    return `clamp(${min}px, ${pref}, ${max}px)`;
}
