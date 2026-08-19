"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, Tabs, PageHeader, staggerContainer, staggerItem, fadeInUp } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function DocumentosPage() {
    const { isMobile, isTablet } = useBreakpoint();
    const [activeTab, setActiveTab] = useState('repositorio');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolder, setExpandedFolder] = useState(null);

    // Dummy Data
    const folders = [
        { id: 'planos', icon: '📐', name: 'Planos & Láminas', count: 12, lastUpdated: 'Hace 2 horas', size: '145 MB' },
        { id: 'especificaciones', icon: '📋', name: 'Especificaciones Técnicas', count: 8, lastUpdated: 'Ayer', size: '24 MB' },
        { id: 'permisos', icon: '🧾', name: 'Permisos & Habilitaciones', count: 5, lastUpdated: 'Hace 3 días', size: '12 MB' },
        { id: 'contratos', icon: '📑', name: 'Contratos & Licitaciones', count: 3, lastUpdated: 'Hace 1 semana', size: '8 MB' },
        { id: 'presupuesto', icon: '🏗️', name: 'Cómputo & Presupuesto', count: 6, lastUpdated: 'Hace 2 semanas', size: '18 MB' },
        { id: 'fotos', icon: '📸', name: 'Registro Fotográfico', count: 24, lastUpdated: 'Hace 1 hora', size: '450 MB' },
    ];

    const dummyFiles = {
        planos: [
            { id: 'f1', name: 'PL-ARQ-01_PlantaBaja.pdf', version: 'v3', uploader: 'Arq. Marcelo', date: '20 Ago 2026', size: '4.2 MB' },
            { id: 'f2', name: 'PL-EST-04_LosaSobrePB.dwg', version: 'v1', uploader: 'Ing. Carlos', date: '18 Ago 2026', size: '12.5 MB' },
            { id: 'f3', name: 'PL-SAN-02_Cloacas.pdf', version: 'v2', uploader: 'Arq. Marcelo', date: '15 Ago 2026', size: '3.1 MB' },
        ],
        especificaciones: [
            { id: 'f4', name: 'ET-Hormigon-H21.pdf', version: 'v1', uploader: 'Ing. Carlos', date: '10 Jul 2026', size: '1.2 MB' },
            { id: 'f5', name: 'ET-Carpinterias-Aluminio.pdf', version: 'v2', uploader: 'Arq. Marcelo', date: '05 Ago 2026', size: '2.4 MB' },
        ]
    };

    const submittals = [
        { id: 's1', title: 'Muestra de Porcelanato Ilva Soho 60x120', category: 'Terminaciones', submittedBy: 'Constructora SUR', date: '15 Ago 2026', status: 'APROBADO', reviewer: 'Estudio Arquitectura', responseDate: '18 Ago 2026', observations: 'Aprobado para áreas comunes y pasillos.' },
        { id: 's2', title: 'Prototipo de Carpintería DVH Aluar', category: 'Carpinterías', submittedBy: 'Aberturas Metal', date: '17 Ago 2026', status: 'EN_REVISION', reviewer: 'Dirección de Obra', responseDate: '-', observations: '-' },
        { id: 's3', title: 'Especificación de Membrana Megaflex', category: 'Aislaciones', submittedBy: 'Techos SRL', date: '12 Ago 2026', status: 'APROBADO_CON_OBSERVACIONES', reviewer: 'Estudio Arquitectura', responseDate: '14 Ago 2026', observations: 'Aprobado. Asegurar solape mínimo de 15cm.' },
        { id: 's4', title: 'Pintura Sherwin Williams ColorLife', category: 'Pintura', submittedBy: 'Pintores CABA', date: '19 Ago 2026', status: 'ENVIADO', reviewer: 'Dirección de Obra', responseDate: '-', observations: '-' }
    ];

    const versions = [
        { id: 'v1', document: 'PL-ARQ-01_PlantaBaja.pdf', current: 'v3', previous: 'v2', changedBy: 'Arq. Marcelo', date: '20 Ago 2026', notes: 'Actualización de cotas en lobby.' },
        { id: 'v2', document: 'ET-Carpinterias-Aluminio.pdf', current: 'v2', previous: 'v1', changedBy: 'Estudio Arquitectura', date: '05 Ago 2026', notes: 'Cambio de DVH a TVH en fachada sur.' },
        { id: 'v3', document: 'PL-SAN-02_Cloacas.pdf', current: 'v2', previous: 'v1', changedBy: 'Ing. López', date: '15 Jul 2026', notes: 'Reubicación de cámara de inspección.' },
        { id: 'v4', document: 'PP-PresupuestoBase.xlsx', current: 'v4', previous: 'v3', changedBy: 'Lic. Fernández', date: '10 Jul 2026', notes: 'Ajuste por inflación (CAC Junio).' },
        { id: 'v5', document: 'PL-ARQ-01_PlantaBaja.pdf', current: 'v2', previous: 'v1', changedBy: 'Arq. Marcelo', date: '01 Jul 2026', notes: 'Modificación de apertura de puertas.' },
    ];

    const renderStatusBadge = (status) => {
        const statusMap = {
            'APROBADO': { color: 'success', label: 'Aprobado' },
            'EN_REVISION': { color: 'warning', label: 'En Revisión' },
            'APROBADO_CON_OBSERVACIONES': { color: 'info', label: 'Apr. c/ Observaciones' },
            'ENVIADO': { color: 'default', label: 'Enviado' },
            'RECHAZADO': { color: 'danger', label: 'Rechazado' }
        };
        const st = statusMap[status] || statusMap['ENVIADO'];
        return <Badge variant={st.color}>{st.label}</Badge>;
    };

    return (
        <div style={{ minHeight: '100vh', padding: '0 0 60px 0', fontFamily: tokens.font.sans }}>
            <PageHeader 
                title="Documentación Técnica"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Documentación Técnica' }]}
                actions={
                    <Button variant="primary" icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}>
                        Subir Documento
                    </Button>
                }
            />

            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px' }}>
                <Tabs 
                    activeTab={activeTab} 
                    onChange={setActiveTab}
                    tabs={[
                        { id: 'repositorio', label: '📁 Repositorio de Documentos' },
                        { id: 'submittals', label: '📤 Submittals & Aprobaciones' },
                        { id: 'versiones', label: '📊 Control de Versiones' }
                    ]}
                />

                <AnimatePresence mode="wait">
                    {/* -------------------- TAB 1: REPOSITORIO -------------------- */}
                    {activeTab === 'repositorio' && (
                        <motion.div key="repositorio" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden" style={{ marginTop: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                                <div style={{ position: 'relative', width: isMobile ? '100%' : '320px' }}>
                                    <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: tokens.colors.text.muted }} width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por nombre, autor, extensión..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: tokens.colors.bg.elevated,
                                            border: `1px solid ${tokens.colors.border.default}`,
                                            color: tokens.colors.text.primary,
                                            borderRadius: tokens.radius.md,
                                            padding: '10px 16px 10px 38px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = tokens.colors.accent.primary}
                                        onBlur={(e) => e.target.style.borderColor = tokens.colors.border.default}
                                    />
                                </div>
                            </div>

                            {expandedFolder ? (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                        <Button variant="secondary" onClick={() => setExpandedFolder(null)} style={{ padding: '8px 12px' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                        </Button>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{folders.find(f => f.id === expandedFolder)?.icon} {folders.find(f => f.id === expandedFolder)?.name}</h2>
                                    </div>
                                    
                                    <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, background: 'rgba(0,0,0,0.2)' }}>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Archivo</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Versión</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Subido por</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Fecha</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Tamaño</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(dummyFiles[expandedFolder] || []).map((file, idx) => (
                                                        <tr key={file.id} style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.primary, fontWeight: 500 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={tokens.colors.text.muted}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                    {file.name}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '16px 24px' }}><Badge variant="default">{file.version}</Badge></td>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{file.uploader}</td>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{file.date}</td>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{file.size}</td>
                                                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                                <Button variant="secondary" style={{ padding: '6px 12px' }}>Descargar</Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!dummyFiles[expandedFolder] || dummyFiles[expandedFolder].length === 0) && (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: tokens.colors.text.muted }}>
                                                                No hay archivos en esta carpeta (datos de demostración).
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            ) : (
                                <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: '24px'
                                }}>
                                    {folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((folder) => (
                                        <GlassCard 
                                            key={folder.id} 
                                            hover={true} 
                                            onClick={() => setExpandedFolder(folder.id)}
                                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '16px' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ fontSize: '2.5rem' }}>{folder.icon}</div>
                                                <div>
                                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: tokens.colors.text.primary, fontWeight: 600 }}>{folder.name}</h3>
                                                    <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem' }}>{folder.count} archivos</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '16px', marginTop: 'auto' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.75rem', color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actualizado</span>
                                                    <span style={{ fontSize: '0.85rem', color: tokens.colors.text.secondary }}>{folder.lastUpdated}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                                    <span style={{ fontSize: '0.75rem', color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tamaño</span>
                                                    <span style={{ fontSize: '0.85rem', color: tokens.colors.text.secondary }}>{folder.size}</span>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* -------------------- TAB 2: SUBMITTALS -------------------- */}
                    {activeTab === 'submittals' && (
                        <motion.div key="submittals" variants={staggerContainer} initial="hidden" animate="visible" exit="hidden" style={{ marginTop: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Registro de Submittals</h2>
                                <Button variant="primary">Nuevo Submittal</Button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', gap: '24px' }}>
                                {submittals.map((sub) => (
                                    <GlassCard key={sub.id} hover={true}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '16px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                    <Badge variant="default">{sub.category}</Badge>
                                                    <span style={{ fontSize: '0.85rem', color: tokens.colors.text.muted }}>{sub.date}</span>
                                                </div>
                                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: tokens.colors.text.primary, lineHeight: 1.4 }}>{sub.title}</h3>
                                            </div>
                                            {renderStatusBadge(sub.status)}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: tokens.radius.md }}>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: tokens.colors.text.muted, marginBottom: '4px' }}>Enviado por</span>
                                                <span style={{ fontSize: '0.9rem', color: tokens.colors.text.secondary }}>{sub.submittedBy}</span>
                                            </div>
                                            <div>
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: tokens.colors.text.muted, marginBottom: '4px' }}>Revisor</span>
                                                <span style={{ fontSize: '0.9rem', color: tokens.colors.text.secondary }}>{sub.reviewer}</span>
                                            </div>
                                        </div>

                                        <div style={{ borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '16px' }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: tokens.colors.text.muted, marginBottom: '6px' }}>Observaciones ({sub.responseDate})</span>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: tokens.colors.text.primary, lineHeight: 1.5 }}>{sub.observations}</p>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* -------------------- TAB 3: VERSIONES -------------------- */}
                    {activeTab === 'versiones' && (
                        <motion.div key="versiones" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden" style={{ marginTop: '32px' }}>
                            <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '24px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Historial de Revisiones</h2>
                                    <p style={{ margin: '8px 0 0 0', color: tokens.colors.text.muted, fontSize: '0.9rem' }}>Registro automático de cambios en documentos del proyecto.</p>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, background: 'rgba(0,0,0,0.2)' }}>
                                                <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Documento</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Versión Actual</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Anterior</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Modificado por</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Fecha</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Notas de Revisión</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {versions.map((v, idx) => (
                                                <motion.tr 
                                                    key={v.id}
                                                    custom={idx}
                                                    variants={staggerItem}
                                                    style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}
                                                >
                                                    <td style={{ padding: '16px 24px', color: tokens.colors.text.primary, fontWeight: 500 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={tokens.colors.accent.primary}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            {v.document}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }}><Badge variant="success">{v.current}</Badge></td>
                                                    <td style={{ padding: '16px 24px' }}><Badge variant="default">{v.previous}</Badge></td>
                                                    <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{v.changedBy}</td>
                                                    <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{v.date}</td>
                                                    <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.notes}</td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
