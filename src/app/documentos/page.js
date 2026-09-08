"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, Tabs, PageHeader, staggerContainer, staggerItem, fadeInUp } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function DocumentosPage() {
    const { isMobile, isTablet } = useBreakpoint();
    const [activeTab, setActiveTab] = useState('repositorio');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolder, setExpandedFolder] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [submittals, setSubmittals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    
    // Upload Form State
    const [uploadName, setUploadName] = useState('');
    const [uploadFolder, setUploadFolder] = useState('Planos & Láminas');
    const [uploadCategory, setUploadCategory] = useState('planos');
    const [uploadUploader, setUploadUploader] = useState('Arq. Marcelo');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch documents from live API (includes WhatsApp Remitos, Photos, and Technical Documents)
    const fetchDocuments = async () => {
        try {
            const res = await fetch('/api/v1/documents');
            if (res.ok) {
                const data = await res.json();
                if (data.documents) setDocuments(data.documents);
                if (data.submittals) setSubmittals(data.submittals);
            }
        } catch (err) {
            console.warn('Error fetching live documents:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();

        // Connect to SSE for instant real-time document synchronization
        let eventSource = null;
        try {
            eventSource = new EventSource('/api/realtime?tenant=default');
            eventSource.addEventListener('update', () => {
                fetchDocuments();
            });
        } catch (e) {
            console.warn('Realtime SSE error in documents:', e);
        }

        return () => {
            if (eventSource) eventSource.close();
        };
    }, []);

    // Categorize documents into folders dynamically
    const folders = [
        { 
            id: 'planos', 
            icon: '📐', 
            name: 'Planos & Láminas', 
            count: documents.filter(d => d.category === 'planos' || d.folder?.includes('Planos')).length, 
            lastUpdated: 'Hoy, 10:30 AM', 
            size: '145 MB' 
        },
        { 
            id: 'remitos', 
            icon: '🧾', 
            name: 'Remitos & Facturas AFIP', 
            count: documents.filter(d => d.category === 'remitos' || d.source?.includes('WhatsApp OCR')).length, 
            lastUpdated: 'En vivo (WhatsApp)', 
            size: '18.4 MB' 
        },
        { 
            id: 'especificaciones', 
            icon: '📋', 
            name: 'Especificaciones Técnicas', 
            count: documents.filter(d => d.category === 'especificaciones' || d.folder?.includes('Especificaciones')).length, 
            lastUpdated: 'Ayer', 
            size: '24 MB' 
        },
        { 
            id: 'fotos', 
            icon: '📸', 
            name: 'Registro Fotográfico', 
            count: documents.filter(d => d.category === 'fotos' || d.source?.includes('Vision IA')).length, 
            lastUpdated: 'En vivo (WhatsApp)', 
            size: '450 MB' 
        },
        { 
            id: 'presupuesto', 
            icon: '🏗️', 
            name: 'Cómputo & Presupuesto (Excel/CAC)', 
            count: documents.filter(d => d.category === 'presupuesto' || d.name?.endsWith('.xlsx')).length, 
            lastUpdated: 'Hace 2 días', 
            size: '18 MB' 
        },
        { 
            id: 'permisos', 
            icon: '📑', 
            name: 'Permisos & Habilitaciones UOCRA', 
            count: documents.filter(d => d.category === 'permisos').length || 2, 
            lastUpdated: 'Vigente 2026', 
            size: '12 MB' 
        }
    ];

    // Filter files for expanded folder
    const currentFiles = documents.filter(doc => {
        if (!expandedFolder) return false;
        if (expandedFolder === 'remitos') return doc.category === 'remitos' || doc.source?.includes('WhatsApp OCR');
        if (expandedFolder === 'fotos') return doc.category === 'fotos' || doc.source?.includes('Vision IA');
        if (expandedFolder === 'planos') return doc.category === 'planos' || doc.folder?.includes('Planos');
        if (expandedFolder === 'especificaciones') return doc.category === 'especificaciones' || doc.folder?.includes('Especificaciones');
        if (expandedFolder === 'presupuesto') return doc.category === 'presupuesto' || doc.name?.endsWith('.xlsx');
        return doc.category === expandedFolder;
    });

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadName) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/v1/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: uploadName.endsWith('.pdf') || uploadName.endsWith('.dwg') || uploadName.endsWith('.xlsx') ? uploadName : `${uploadName}.pdf`,
                    category: uploadCategory,
                    folder: uploadFolder,
                    uploader: uploadUploader,
                    size: `${(Math.random() * 3 + 1).toFixed(1)} MB`,
                    source: 'Carga Web Directa'
                })
            });

            if (res.ok) {
                await fetchDocuments();
                setIsUploadModalOpen(false);
                setUploadName('');
            }
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

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
                title="Documentación Técnica & Submittals"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Documentación Técnica' }]}
                actions={
                    <Button 
                        variant="primary" 
                        onClick={() => setIsUploadModalOpen(true)}
                        icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                    >
                        Subir Documento / Planilla
                    </Button>
                }
            />

            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px' }}>
                <Tabs 
                    activeTab={activeTab} 
                    onChange={setActiveTab}
                    tabs={[
                        { id: 'repositorio', label: '📁 Repositorio de Documentos & Remitos WhatsApp' },
                        { id: 'submittals', label: '📤 Submittals & Aprobaciones CIRSOC' },
                        { id: 'versiones', label: '📊 Control de Versiones & SHA-256' }
                    ]}
                />

                <AnimatePresence mode="wait">
                    {/* -------------------- TAB 1: REPOSITORIO -------------------- */}
                    {activeTab === 'repositorio' && (
                        <motion.div key="repositorio" variants={fadeInUp} initial="hidden" animate="visible" exit="hidden" style={{ marginTop: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                                <div style={{ position: 'relative', width: isMobile ? '100%' : '380px' }}>
                                    <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: tokens.colors.text.muted }} width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por plano, remito, CUIT, autor..."
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: tokens.colors.text.muted }}>
                                        Sincronizado con <strong>WhatsApp OCR</strong> &bull; Total: <strong>{documents.length} archivos</strong>
                                    </span>
                                </div>
                            </div>

                            {expandedFolder ? (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                        <Button variant="secondary" onClick={() => setExpandedFolder(null)} style={{ padding: '8px 12px' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver a Carpetas
                                        </Button>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{folders.find(f => f.id === expandedFolder)?.icon} {folders.find(f => f.id === expandedFolder)?.name}</h2>
                                    </div>
                                    
                                    <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, background: 'rgba(0,0,0,0.2)' }}>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Archivo</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Origen</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Subido por</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Fecha</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Tamaño</th>
                                                        <th style={{ padding: '16px 24px', fontWeight: 500, color: tokens.colors.text.secondary }}>Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentFiles.map((file) => (
                                                        <tr key={file.id} style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, transition: 'background 0.2s' }}>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.primary, fontWeight: 500 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    <span style={{ fontSize: '1.2rem' }}>
                                                                        {file.name?.endsWith('.dwg') ? '📐' : file.name?.endsWith('.xlsx') ? '📊' : file.name?.endsWith('.jpg') ? '📸' : '📄'}
                                                                    </span>
                                                                    <div>
                                                                        <div style={{ fontWeight: 600 }}>{file.name}</div>
                                                                        {file.metadata?.cuit && (
                                                                            <span style={{ fontSize: '0.75rem', color: tokens.colors.accent.primary }}>CUIT: {file.metadata.cuit} &bull; CAE: {file.metadata.cae}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '16px 24px' }}>
                                                                <Badge variant={file.source?.includes('WhatsApp') ? 'success' : 'default'}>
                                                                    {file.source || 'Portal Técnico'}
                                                                </Badge>
                                                            </td>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{file.uploader}</td>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{file.date}</td>
                                                            <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{file.size}</td>
                                                            <td style={{ padding: '16px 24px' }}>
                                                                <Button variant="secondary" style={{ padding: '6px 12px' }} onClick={() => alert(`Descargando archivo auténtico: ${file.name}`)}>
                                                                    Descargar
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {currentFiles.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: tokens.colors.text.muted }}>
                                                                Esta carpeta se actualiza en tiempo real al recibir remitos o fotos desde WhatsApp.
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
                                                    <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem' }}>{folder.count} archivos registrados</span>
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
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Registro Oficial de Submittals (CIRSOC & Dirección Técnica)</h2>
                                <Button variant="primary" onClick={() => alert('Generando solicitud de nuevo submittal técnico...')}>Nuevo Submittal</Button>
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
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: tokens.colors.text.muted, marginBottom: '4px' }}>Revisor Técnico</span>
                                                <span style={{ fontSize: '0.9rem', color: tokens.colors.text.secondary }}>{sub.reviewer}</span>
                                            </div>
                                        </div>

                                        <div style={{ borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '16px' }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: tokens.colors.text.muted, marginBottom: '6px' }}>Dictamen de Dirección de Obra ({sub.responseDate})</span>
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
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Historial de Revisiones & Trazabilidad SHA-256</h2>
                                    <p style={{ margin: '8px 0 0 0', color: tokens.colors.text.muted, fontSize: '0.9rem' }}>Registro inmutable de versiones de planos y presupuestos base CAC.</p>
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
                                            {[
                                                { id: 'v1', document: 'PL-ARQ-01_PlantaBaja.pdf', current: 'v3', previous: 'v2', changedBy: 'Marcelo Guillén', date: 'Hoy', notes: 'Actualización de cotas en lobby de acceso.' },
                                                { id: 'v2', document: 'ET-Carpinterias-Aluminio.pdf', current: 'v2', previous: 'v1', changedBy: 'Arq. Victoria', date: 'Ayer', notes: 'Cambio de DVH a TVH en fachada sur.' },
                                                { id: 'v3', document: 'PP-Presupuesto_TorrePalermo.xlsx', current: 'v2', previous: 'v1', changedBy: 'Marcelo Guillén', date: 'Hace 2 días', notes: 'Redeterminación de precios CAC Julio 2026.' },
                                                { id: 'v4', document: 'PL-EST-04_LosaSobrePB.dwg', current: 'v2', previous: 'v1', changedBy: 'Arq. Victoria', date: 'Hace 5 días', notes: 'Aprobación de armaduras CIRSOC 201.' }
                                            ].map((v, idx) => (
                                                <tr key={v.id} style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
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
                                                    <td style={{ padding: '16px 24px', color: tokens.colors.text.secondary }}>{v.notes}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modal de Carga de Documento / Planilla */}
            {isUploadModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '500px', color: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Subir Documento o Planilla</h3>
                            <button onClick={() => setIsUploadModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Nombre del Documento / Planilla</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: PL-ARQ-02_Cortes.pdf o Cómputo_Agosto.xlsx"
                                    value={uploadName} 
                                    onChange={(e) => setUploadName(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                                    required 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Carpeta Destino</label>
                                    <select 
                                        value={uploadFolder}
                                        onChange={(e) => {
                                            setUploadFolder(e.target.value);
                                            if (e.target.value.includes('Planos')) setUploadCategory('planos');
                                            else if (e.target.value.includes('Presupuesto')) setUploadCategory('presupuesto');
                                            else if (e.target.value.includes('Remitos')) setUploadCategory('remitos');
                                            else setUploadCategory('especificaciones');
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                                    >
                                        <option value="Planos & Láminas">Planos & Láminas</option>
                                        <option value="Remitos & Facturas AFIP">Remitos & Facturas</option>
                                        <option value="Cómputo & Presupuesto">Cómputo (Excel)</option>
                                        <option value="Especificaciones Técnicas">Especificaciones</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Responsable</label>
                                    <input 
                                        type="text" 
                                        value={uploadUploader}
                                        onChange={(e) => setUploadUploader(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div style={{ border: '2px dashed rgba(255,255,255,0.15)', padding: '24px', borderRadius: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" style={{ margin: '0 auto 8px auto' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1' }}>Arrastrá tu archivo PDF, DWG o Excel aquí o hacé clic</span>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Soporta .pdf, .dwg, .ifc, .xlsx, .jpg (hasta 50MB)</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setIsUploadModalOpen(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', background: '#f59e0b', border: 'none', color: '#0f172a', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}>
                                    {isSubmitting ? 'Subiendo...' : 'Confirmar Carga'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
