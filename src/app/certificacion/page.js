"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, Tabs, PageHeader, Modal, EmptyState, staggerContainer, staggerItem, fadeInUp } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

const HISTORICAL_CERTS = [
  { id: 'CERT-2026-001', periodo: 'Q1 - Junio 2026', fecha: '2026-06-15', avance: 18, montoBase: 650000, cacIndex: 11.8, status: 'Aprobado', hash: '3a7f9b2...', aprobadoPor: 'Arq. Victoria Schiaffino' },
  { id: 'CERT-2026-002', periodo: 'Q2 - Junio 2026', fecha: '2026-06-30', avance: 26, montoBase: 890000, cacIndex: 12.3, status: 'Aprobado', hash: '9c2e4a1...', aprobadoPor: 'Arq. Marcelo Guillén' },
  { id: 'CERT-2026-003', periodo: 'Q1 - Julio 2026', fecha: '2026-07-15', avance: 35, montoBase: 1120000, cacIndex: 13.1, status: 'Aprobado', hash: 'b5d1e8c...', aprobadoPor: 'Arq. Victoria Schiaffino' },
  { id: 'CERT-2026-004', periodo: 'Q2 - Julio 2026', fecha: '2026-07-31', avance: 42, montoBase: 2160000, cacIndex: 14.21, status: 'En Revisión', hash: '8f4a1c9...', aprobadoPor: 'Pendiente' },
];

export default function CertificacionPage() {
    const isMobile = useBreakpoint('sm');
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('Q1 - Agosto 2026');
    const [cacAdjustment, setCacAdjustment] = useState(14.21);
    const [showNewCertModal, setShowNewCertModal] = useState(false);
    const [newCertProgress, setNewCertProgress] = useState(48);
    const [signedHash, setSignedHash] = useState('8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5be3b0c44298fc1c149afbf4c8996fb924');
    const [copiedHash, setCopiedHash] = useState(false);
    const [dispatchingWhatsApp, setDispatchingWhatsApp] = useState(false);
    const [dispatchSuccess, setDispatchSuccess] = useState(false);
    
    const [activeTab, setActiveTab] = useState('actual');
    const [simulatedCac, setSimulatedCac] = useState(14.21);
    const [sseConnected, setSseConnected] = useState(false);

    useEffect(() => {
        fetch('/api/state')
            .then(res => res.json())
            .then(data => {
                setState(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));

        // SSE Connection
        const eventSource = new EventSource('/api/realtime');
        eventSource.onopen = () => setSseConnected(true);
        eventSource.onmessage = (event) => {
            try {
                const updatedData = JSON.parse(event.data);
                if (updatedData.type === 'STATE_UPDATE') {
                    setState(prev => ({ ...prev, ...updatedData.payload }));
                }
            } catch (e) {
                console.error(e);
            }
        };
        eventSource.onerror = () => setSseConnected(false);

        return () => eventSource.close();
    }, []);

    const copyToClipboard = (text) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedHash(true);
            setTimeout(() => setCopiedHash(false), 2000);
        }
    };

    const handleDispatchWhatsApp = async () => {
        setDispatchingWhatsApp(true);
        try {
            const res = await fetch('/api/v1/whatsapp/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName: 'daily_summary',
                    recipientPhone: '+5492613168608',
                    variables: {
                        fecha: new Date().toLocaleDateString('es-AR'),
                        avance: String(state?.avancePercentage || 42) + '%',
                        clima: 'Despejado',
                        presentismo: '100% Cuadrilla en Predio',
                        hitos: 'Certificado ' + selectedPeriod + ' emitido y firmado con hash SHA-256'
                    }
                })
            });
            if (res.ok) {
                setDispatchSuccess(true);
                setTimeout(() => setDispatchSuccess(false), 3000);
            }
        } catch (e) {
            console.error(e);
        }
        setDispatchingWhatsApp(false);
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: tokens.colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: tokens.colors.accent, borderRadius: '50%' }} />
            </div>
        );
    }

    const project = state?.projectConfig || {};
    const budget = state?.budget || {};
    let rubros = budget?.rubros || [
        { id: 'R-01', nombre: 'Fundaciones y Submuración', presupuesto: 450000, ejecutado: 450000, tendency: 'up' },
        { id: 'R-02', nombre: 'Estructura Resistente H°A°', presupuesto: 1250000, ejecutado: 950000, tendency: 'up' },
        { id: 'R-03', nombre: 'Mampostería de Elevación', presupuesto: 820000, ejecutado: 380000, tendency: 'down' },
        { id: 'R-04', nombre: 'Instalación Sanitaria y Gas', presupuesto: 640000, ejecutado: 260000, tendency: 'up' },
        { id: 'R-05', nombre: 'Instalación Eléctrica Integral', presupuesto: 510000, ejecutado: 120000, tendency: 'down' }
    ];

    // Append new rubros if they don't exist
    if (!rubros.find(r => r.id === 'R-06')) {
        rubros = [...rubros, 
            { id: 'R-06', nombre: 'Carpintería y Aberturas', presupuesto: 380000, ejecutado: 45000, tendency: 'up' },
            { id: 'R-07', nombre: 'Revestimientos y Pisos', presupuesto: 520000, ejecutado: 0, tendency: 'none' },
            { id: 'R-08', nombre: 'Pintura y Terminaciones Finales', presupuesto: 290000, ejecutado: 0, tendency: 'none' }
        ];
    }

    const totalPresupuesto = rubros.reduce((acc, r) => acc + (r.presupuesto || 0), 0);
    const totalEjecutado = rubros.reduce((acc, r) => acc + (r.ejecutado || 0), 0);
    const montoAjustadoCAC = Math.round(totalEjecutado * (1 + cacAdjustment / 100));
    const fondoReparo = Math.round(montoAjustadoCAC * 0.05);
    const liquidoAPagar = montoAjustadoCAC - fondoReparo;

    // Simulation computations
    const simuladorMontoAjustado = Math.round(totalEjecutado * (1 + simulatedCac / 100));
    const simuladorDiferencial = simuladorMontoAjustado - totalEjecutado;

    return (
        <div style={{ minHeight: '100vh', background: tokens.colors.background, color: '#f8fafc', fontFamily: tokens.font.sans }}>
            <PageHeader
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        Certificaciones de Obra Digitales
                        {sseConnected && <Badge color={tokens.colors.success} variant="filled" size="sm">En Vivo</Badge>}
                    </div>
                }
                subtitle="Emisión fehaciente de certificados de avance físico-financiero con índice CAC, retención de fondo de reparo y firma digital SHA-256"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Costos', href: '/costos' }, { label: 'Certificaciones' }]}
                actions={
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <Link href="/dashboard">
                            <Button variant="secondary" size="sm">← Dashboard</Button>
                        </Link>
                        <a href="/api/v1/certificacion/pdf" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <Button variant="primary" size="sm">📄 Descargar PDF</Button>
                        </a>
                        <Button variant="whatsapp" size="sm" onClick={handleDispatchWhatsApp} disabled={dispatchingWhatsApp}>
                            {dispatchSuccess ? '✅ Notificado!' : dispatchingWhatsApp ? 'Enviando...' : '📱 Enviar al Comitente'}
                        </Button>
                    </div>
                }
            />
            
            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px clamp(14px, 4vw, 32px) 80px' }}>
                <Tabs 
                    tabs={[
                        { id: 'actual', label: 'Certificado Actual' },
                        { id: 'historial', label: 'Historial de Certificaciones' },
                        { id: 'simulador', label: 'Simulador CAC' },
                        { id: 'resumen', label: 'Resumen Ejecutivo' }
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    style={{ marginBottom: '24px' }}
                />

                <AnimatePresence mode="wait">
                    {activeTab === 'actual' && (
                        <motion.div key="actual" variants={staggerContainer} initial="initial" animate="animate" exit="exit">
                            <motion.div variants={fadeInUp}>
                                <GlassCard style={{ padding: '18px 24px', marginBottom: '28px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: tokens.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.colors.background, fontSize: '1.4rem', fontWeight: 900 }}>📜</div>
                                            <div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>Certificado Nº CERT-2026-004 — {selectedPeriod}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                                    Obra: <strong style={{ color: '#f8fafc' }}>{project.name || 'Torre Palermo Soho'}</strong> • Director Técnico: <strong style={{ color: '#f8fafc' }}>{project.director?.name || 'Arq. Marcelo'}</strong> (Mat. CPAU)
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Índice CAC Ajuste</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8' }}>+{cacAdjustment}% vs Base</div>
                                            </div>
                                            <Button variant="secondary" size="xs" onClick={() => setShowNewCertModal(true)}>➕ Emitir Nueva Quincena</Button>
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>

                            <motion.div variants={fadeInUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                <StatCard label="AVANCE FÍSICO GLOBAL" value={String(state?.avancePercentage || 42) + '%'} sub="Verificado en obra" icon="🏗️" color={tokens.colors.secondary} />
                                <StatCard label="MONTO BÁSICO ACUMULADO" value={'$' + totalEjecutado.toLocaleString('es-AR')} sub="A valores contractuales" icon="💰" color={tokens.colors.accent} />
                                <StatCard label="AJUSTADO POR CAC (+14.2%)" value={'$' + montoAjustadoCAC.toLocaleString('es-AR')} sub="Redeterminación oficial" icon="📈" color={tokens.colors.success} />
                                <StatCard label="FONDO DE REPARO (5%)" value={'$' + fondoReparo.toLocaleString('es-AR')} sub="Retención Ley 22.250" icon="🛡️" color={tokens.colors.danger} />
                                <StatCard label="LÍQUIDO A PERCIBIR" value={'$' + liquidoAPagar.toLocaleString('es-AR')} sub="Saldo neto a transferir" icon="💵" color="#22c55e" />
                            </motion.div>

                            <motion.div variants={fadeInUp}>
                                <GlassCard style={{ padding: '24px', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>📑 Discriminación por Rubros Constructivos</h3>
                                            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 0' }}>Comparativa entre presupuesto contractual, porcentaje acumulado y liquidación del período</p>
                                        </div>
                                        <Badge color={tokens.colors.success} variant="filled" size="sm">Normativa CIRSOC & UOCRA</Badge>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '300px' }}>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                                                            <th style={{ padding: '12px 8px' }}>CÓDIGO & RUBRO</th>
                                                            <th style={{ padding: '12px 8px' }}>PRESUP. BASE</th>
                                                            <th style={{ padding: '12px 8px' }}>AVANCE ACUM.</th>
                                                            <th style={{ padding: '12px 8px' }}>MONTO BASE</th>
                                                            <th style={{ padding: '12px 8px' }}>REDET. CAC</th>
                                                            <th style={{ padding: '12px 8px' }}>FONDO REPARO</th>
                                                            <th style={{ padding: '12px 8px', textAlign: 'right' }}>NETO A COBRAR</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rubros.map((r, i) => {
                                                            const pct = Math.min(100, Math.round(((r.ejecutado || 0) / (r.presupuesto || 1)) * 100));
                                                            const ajustado = Math.round((r.ejecutado || 0) * (1 + cacAdjustment / 100));
                                                            const retenido = Math.round(ajustado * 0.05);
                                                            const neto = ajustado - retenido;
                                                            return (
                                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc' }}>
                                                                    <td style={{ padding: '14px 8px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.nombre}</span>
                                                                            {r.tendency === 'up' && <span style={{ color: tokens.colors.success, fontSize: '12px' }}>↑</span>}
                                                                            {r.tendency === 'down' && <span style={{ color: tokens.colors.danger, fontSize: '12px' }}>↓</span>}
                                                                        </div>
                                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Item {r.id}</div>
                                                                    </td>
                                                                    <td style={{ padding: '14px 8px', color: '#cbd5e1' }}>{'$' + (r.presupuesto || 0).toLocaleString('es-AR')}</td>
                                                                    <td style={{ padding: '14px 8px', minWidth: '140px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ fontWeight: 800, color: pct === 100 ? tokens.colors.success : tokens.colors.accent, fontSize: '0.8rem', minWidth: '35px' }}>{pct}%</span>
                                                                            <div style={{ flex: 1 }}>
                                                                                <ProgressBar value={pct} color={pct === 100 ? tokens.colors.success : tokens.colors.accent} height={5} />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '14px 8px', color: tokens.colors.accent, fontWeight: 600 }}>{'$' + (r.ejecutado || 0).toLocaleString('es-AR')}</td>
                                                                    <td style={{ padding: '14px 8px', color: '#38bdf8', fontWeight: 600 }}>{'$' + ajustado.toLocaleString('es-AR')}</td>
                                                                    <td style={{ padding: '14px 8px', color: tokens.colors.danger, fontWeight: 600 }}>{'-$' + retenido.toLocaleString('es-AR')}</td>
                                                                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: '0.9rem' }}>{'$' + neto.toLocaleString('es-AR')}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.15) 100%)', borderTop: `1px solid ${tokens.colors.accent}` }}>
                                                            <td style={{ padding: '16px 8px', fontWeight: 900, color: '#f8fafc' }}>TOTALES</td>
                                                            <td style={{ padding: '16px 8px', fontWeight: 800, color: '#cbd5e1' }}>{'$' + totalPresupuesto.toLocaleString('es-AR')}</td>
                                                            <td style={{ padding: '16px 8px', fontWeight: 800, color: tokens.colors.accent }}>{String(state?.avancePercentage || 42) + '% Global'}</td>
                                                            <td style={{ padding: '16px 8px', fontWeight: 800, color: tokens.colors.accent }}>{'$' + totalEjecutado.toLocaleString('es-AR')}</td>
                                                            <td style={{ padding: '16px 8px', fontWeight: 800, color: '#38bdf8' }}>{'$' + montoAjustadoCAC.toLocaleString('es-AR')}</td>
                                                            <td style={{ padding: '16px 8px', fontWeight: 800, color: tokens.colors.danger }}>{'-$' + fondoReparo.toLocaleString('es-AR')}</td>
                                                            <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: 900, color: '#22c55e', fontSize: '1.05rem' }}>{'$' + liquidoAPagar.toLocaleString('es-AR')}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                        {!isMobile && (
                                            <div style={{ width: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                                                <h4 style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', textAlign: 'center' }}>Distribución Presupuesto</h4>
                                                <svg width="140" height="140" viewBox="0 0 42 42">
                                                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke={tokens.colors.accent} strokeWidth="6" strokeDasharray="40 60" strokeDashoffset="25"></circle>
                                                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke={tokens.colors.secondary} strokeWidth="6" strokeDasharray="30 70" strokeDashoffset="85"></circle>
                                                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke={tokens.colors.success} strokeWidth="6" strokeDasharray="20 80" strokeDashoffset="55"></circle>
                                                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke={tokens.colors.danger} strokeWidth="6" strokeDasharray="10 90" strokeDashoffset="35"></circle>
                                                </svg>
                                                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.7rem', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: tokens.colors.accent, borderRadius: '50%' }}/> Estructura (40%)</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: tokens.colors.secondary, borderRadius: '50%' }}/> Mampostería (30%)</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: tokens.colors.success, borderRadius: '50%' }}/> Instalaciones (20%)</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: tokens.colors.danger, borderRadius: '50%' }}/> Terminaciones (10%)</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </GlassCard>
                            </motion.div>

                            <motion.div variants={fadeInUp}>
                                <GlassCard style={{ padding: '24px', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060913', fontSize: '1.2rem', fontWeight: 900 }}>🔐</div>
                                            <div>
                                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>Sello Digital de Inmutabilidad SHA-256</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                                    Hash: <code style={{ color: '#c4b5fd' }}>{signedHash}</code>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Button variant="secondary" size="xs" onClick={() => copyToClipboard(signedHash)}>{copiedHash ? '✅ Copiado!' : '📋 Copiar Hash'}</Button>
                                            <a href="/api/v1/certificacion/pdf" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                                <Button variant="primary" size="xs">Ver PDF Foliado</Button>
                                            </a>
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}

                    {activeTab === 'historial' && (
                        <motion.div key="historial" variants={staggerContainer} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {HISTORICAL_CERTS.map((cert) => (
                                <motion.div key={cert.id} variants={fadeInUp}>
                                    <GlassCard style={{ padding: '20px', borderLeft: `4px solid ${cert.status === 'Aprobado' ? tokens.colors.success : tokens.colors.accent}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>{cert.id}</h4>
                                                    <Badge color={cert.status === 'Aprobado' ? tokens.colors.success : tokens.colors.accent} variant="outline" size="sm">{cert.status}</Badge>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Período: <span style={{ color: '#e2e8f0' }}>{cert.periodo}</span> | Fecha: {cert.fecha}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Aprobado por: <span style={{ color: '#e2e8f0' }}>{cert.aprobadoPor}</span></div>
                                                
                                                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '90px' }}>Avance Acum:</span>
                                                    <div style={{ width: '200px' }}><ProgressBar value={cert.avance} color={tokens.colors.secondary} height={6} /></div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{cert.avance}%</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Monto Base: <span style={{ color: '#e2e8f0' }}>${cert.montoBase.toLocaleString('es-AR')}</span></div>
                                                    <div style={{ fontSize: '0.9rem', color: tokens.colors.success, fontWeight: 'bold', marginTop: '4px' }}>
                                                        Monto Ajustado (CAC {cert.cacIndex}%): ${(cert.montoBase * (1 + cert.cacIndex / 100)).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontFamily: tokens.font.mono, color: '#64748b' }}>{cert.hash}</span>
                                                    <Button variant="secondary" size="xs" onClick={() => copyToClipboard(cert.hash)}>Copiar Hash</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'simulador' && (
                        <motion.div key="simulador" variants={staggerContainer} initial="initial" animate="animate" exit="exit">
                            <motion.div variants={fadeInUp}>
                                <GlassCard style={{ padding: '24px', marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        🧮 Simulador de Redeterminación CAC
                                    </h3>
                                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '24px' }}>
                                        Ajuste dinámico para evaluar el impacto del Índice de la Cámara Argentina de la Construcción sobre el monto básico acumulado.
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>Índice CAC Simulado</label>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: tokens.colors.accent }}>{simulatedCac}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="30" step="0.1" 
                                                value={simulatedCac} 
                                                onChange={e => setSimulatedCac(Number(e.target.value))}
                                                style={{ width: '100%', accentColor: tokens.colors.accent, cursor: 'pointer' }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                                                <span>0%</span>
                                                <span>15%</span>
                                                <span>30%</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>Monto Básico Acumulado</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e2e8f0' }}>${totalEjecutado.toLocaleString('es-AR')}</div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: `1px solid ${tokens.colors.success}40` }}>
                                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>Monto Ajustado Simulado</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: tokens.colors.success }}>${simuladorMontoAjustado.toLocaleString('es-AR')}</div>
                                            </div>
                                            <div style={{ background: `linear-gradient(135deg, ${tokens.colors.accent}10 0%, transparent 100%)`, padding: '16px', borderRadius: '12px', border: `1px solid ${tokens.colors.accent}60` }}>
                                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>Diferencial (Impacto Redeterminación)</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: tokens.colors.accent }}>+${simuladorDiferencial.toLocaleString('es-AR')}</div>
                                            </div>
                                        </div>

                                        <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '32px', justifyContent: 'center', marginTop: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '80px', height: '100px', background: '#e2e8f0', borderRadius: '8px 8px 0 0', position: 'relative' }}>
                                                    <div style={{ position: 'absolute', top: '-24px', width: '100%', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>Base</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '80px', height: `${100 * (1 + simulatedCac / 100)}px`, background: tokens.colors.success, borderRadius: '8px 8px 0 0', position: 'relative', transition: 'height 0.3s ease' }}>
                                                    <div style={{ position: 'absolute', top: '-24px', width: '100%', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: tokens.colors.success }}>Ajustado</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>
                                            *Nota legal: Este simulador es orientativo. La redeterminación definitiva se rige conforme Decreto 691/16 y normativa vigente según pliegos de licitación.
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}

                    {activeTab === 'resumen' && (
                        <motion.div key="resumen" variants={staggerContainer} initial="initial" animate="animate" exit="exit">
                            <motion.div variants={fadeInUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                <StatCard label="MONTO TOTAL CERTIFICADO" value="$11.4M" sub="Acumulado Histórico" icon="📊" color={tokens.colors.secondary} />
                                <StatCard label="PROMEDIO POR QUINCENA" value="$1.42M" sub="Últimos 6 períodos" icon="📉" color={tokens.colors.accent} />
                                <StatCard label="TASA DE CRECIMIENTO" value="+8.4%" sub="Variación inter-quincenal" icon="🚀" color={tokens.colors.success} />
                                <StatCard label="PROYECCIÓN FIN DE OBRA" value="Nov 2026" sub="Estimación s/ curva avance" icon="📅" color="#8b5cf6" />
                            </motion.div>

                            <motion.div variants={fadeInUp} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                                <GlassCard style={{ padding: '24px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '24px' }}>📈 Curva de Avance Acumulado vs Proyectado</h3>
                                    
                                    <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 20px 30px', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        {/* Trend Line (SVG overlay) */}
                                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
                                            <polyline points="10%,90% 25%,80% 40%,65% 55%,50% 70%,40% 85%,20%" fill="none" stroke={tokens.colors.accent} strokeWidth="3" strokeDasharray="5,5" />
                                        </svg>
                                        
                                        {/* Bars */}
                                        {[10, 20, 35, 50, 60, 80].map((h, i) => (
                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                                                <div style={{ width: '40px', height: `${h * 2.5}px`, background: i === 5 ? tokens.colors.accent : 'rgba(59, 130, 246, 0.6)', borderRadius: '6px 6px 0 0', position: 'relative' }}>
                                                    <span style={{ position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', fontWeight: 'bold', color: i === 5 ? tokens.colors.accent : '#e2e8f0' }}>{h}%</span>
                                                </div>
                                                <span style={{ position: 'absolute', bottom: '5px', fontSize: '0.75rem', color: '#94a3b8' }}>Q{i%2===0?1:2}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div style={{ marginTop: '24px' }}>
                                        <h4 style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '12px' }}>Proyección a 6 Meses</h4>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                            <thead>
                                                <tr style={{ color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <th style={{ padding: '8px' }}>Mes</th>
                                                    <th style={{ padding: '8px' }}>Avance Proyectado</th>
                                                    <th style={{ padding: '8px' }}>Monto Estimado</th>
                                                    <th style={{ padding: '8px', textAlign: 'right' }}>Riesgo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                                                    <td style={{ padding: '8px' }}>Agosto 2026</td>
                                                    <td style={{ padding: '8px' }}>55%</td>
                                                    <td style={{ padding: '8px' }}>$2.1M</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}><Badge color={tokens.colors.success} variant="outline" size="xs">Bajo</Badge></td>
                                                </tr>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                                                    <td style={{ padding: '8px' }}>Septiembre 2026</td>
                                                    <td style={{ padding: '8px' }}>68%</td>
                                                    <td style={{ padding: '8px' }}>$2.8M</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}><Badge color={tokens.colors.success} variant="outline" size="xs">Bajo</Badge></td>
                                                </tr>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                                                    <td style={{ padding: '8px' }}>Octubre 2026</td>
                                                    <td style={{ padding: '8px' }}>85%</td>
                                                    <td style={{ padding: '8px' }}>$3.5M</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}><Badge color={tokens.colors.accent} variant="outline" size="xs">Medio</Badge></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Modal isOpen={showNewCertModal} onClose={() => setShowNewCertModal(false)} title="Emitir Certificado de Avance de Obra">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setShowNewCertModal(false);
                        alert('Certificado emitido con éxito y firmado con hash SHA-256.');
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Quincena a Certificar</label>
                                <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f8fafc' }}>
                                    <option value="Q1 - Agosto 2026">Q1 - Agosto 2026</option>
                                    <option value="Q2 - Agosto 2026">Q2 - Agosto 2026</option>
                                    <option value="Q1 - Septiembre 2026">Q1 - Septiembre 2026</option>
                                    <option value="Q2 - Septiembre 2026">Q2 - Septiembre 2026</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Avance Global Medido (%)</label>
                                <input type="number" value={newCertProgress} onChange={e => setNewCertProgress(Number(e.target.value))} min="0" max="100" style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f8fafc' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Ajuste por Variación CAC (%)</label>
                                <input type="number" step="0.01" value={cacAdjustment} onChange={e => setCacAdjustment(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f8fafc' }} />
                            </div>
                            <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.76rem', color: '#fcd34d' }}>
                                ⚠️ Se aplicará la retención obligatoria del 5% en concepto de Fondo de Reparo (Ley 22.250 / CCT 76/75).
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewCertModal(false)}>Cancelar</Button>
                                <Button variant="primary" size="sm" type="submit">Firmar & Emitir Certificado</Button>
                            </div>
                        </div>
                    </form>
                </Modal>
            </main>
        </div>
    );
}
