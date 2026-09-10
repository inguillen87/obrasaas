"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, ProgressBar } from '@/lib/design-system';

export default function VecinoDigitalPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [copiedHash, setCopiedHash] = useState(false);
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [activeTab, setActiveTab] = useState('resumen'); // 'resumen' | 'curvaS' | 'cac'
    const [changeOrders, setChangeOrders] = useState([]);
    const [selectedUnit, setSelectedUnit] = useState('3B');

    // Investor phone and unit owners registry
    const unitOwners = {
        '3B': { name: 'Dr. Roberto Méndez', phone: '+54 9 11 4455-6677', m2: 54, type: '2 Ambientes con Balcón', share: '3.8%' },
        '5A': { name: 'Ing. Sofía Valenzuela', phone: '+54 9 11 5566-7788', m2: 82, type: '3 Ambientes con Terraza', share: '5.6%' },
        '8C': { name: 'Estudio Jurídico Albarracín', phone: '+54 9 11 6677-8899', m2: 110, type: 'Piso Completo / Penthouse', share: '8.2%' }
    };

    useEffect(() => {
        Promise.all([
            fetch('/api/v1/portal?token=public').then(r => r.json()),
            fetch('/api/v1/adicionales').then(r => r.json()).catch(() => ({ changeOrders: [] }))
        ]).then(([portalData, adicionalesData]) => {
            setData(portalData);
            if (adicionalesData.changeOrders) setChangeOrders(adicionalesData.changeOrders);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleApproveOrder = async (orderId) => {
        try {
            const ownerName = unitOwners[selectedUnit]?.name || 'Inversor';
            const res = await fetch('/api/v1/adicionales', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    status: 'APROBADA',
                    clientSignature: 'Comitente ' + ownerName + ' - Unidad ' + selectedUnit + ' (Firma Digital Verificada)'
                })
            });
            const d = await res.json();
            if (d.changeOrder) {
                setChangeOrders(changeOrders.map(o => o.id === orderId ? d.changeOrder : o));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const copyHash = (hash) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(hash);
            setCopiedHash(true);
            setTimeout(() => setCopiedHash(false), 2000);
        }
    };

    const getShareUrl = () => {
        if (typeof window !== 'undefined') {
            return window.location.origin + '/portal?token=inv_' + selectedUnit.toLowerCase() + '&unit=' + selectedUnit;
        }
        return 'https://obrasaas.com/portal?token=inv_' + selectedUnit.toLowerCase() + '&unit=' + selectedUnit;
    };

    const copyShareUrl = () => {
        const url = getShareUrl();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
            setCopiedShareLink(true);
            setTimeout(() => setCopiedShareLink(false), 2500);
        }
    };

    const handleShareWhatsApp = () => {
        const url = getShareUrl();
        const owner = unitOwners[selectedUnit];
        const projectName = data?.project?.name || 'Torre Palermo Soho';
        const globalProg = data?.progress?.overall || 48;
        const msg = '🏛️ *Portal de Inversor Certificado — ObraSaaS*\n\n' +
            'Estimado/a *' + (owner?.name || 'Inversor') + '*:\n' +
            'Le compartimos el estado de avance quincenal certificado de su unidad *Departamento ' + selectedUnit + '* en *' + projectName + '*:\n\n' +
            '📈 *Avance Global Certificado:* ' + globalProg + '%\n' +
            '📅 *Posesión Estimada:* Diciembre 2026\n' +
            '🔐 *Firma Digital SHA-256:* Verificada con trazabilidad inmutable.\n\n' +
            '👉 *Acceda a su portal interactivo aquí:*\n' + url + '\n\n' +
            '_Desarrolladora & Dirección Técnica: Arq. Marcelo Guillén & Arq. Victoria Schiaffino._';
        const waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
        window.open(waUrl, '_blank');
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏠</div>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 36, height: 36, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', margin: '0 auto 16px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Cargando portal de inversores...</p>
                </div>
            </div>
        );
    }

    const progress = data?.progress?.overall || 48;
    const certHash = '8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5be3b0c44298fc1c149afbf4c8996fb924';

    // Mock certified site photos for investor transparency
    const photos = [
        { id: 1, title: 'Hormigonado de Losa Nivel 3', date: '14 Ago 2026', tag: 'Estructura', icon: '🏗️', url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800&auto=format&fit=crop&q=60' },
        { id: 2, title: 'Avance Mampostería y Revoques', date: '12 Ago 2026', tag: 'Albañilería', icon: '🧱', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=60' },
        { id: 3, title: 'Prueba Hidráulica de Cañerías', date: '10 Ago 2026', tag: 'Instalaciones', icon: '💧', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=60' }
    ];

    // Curva S Monthly Progression Data
    const sCurveData = [
        { mes: 'Ene', plan: 8, real: 9, ac: 8.5 },
        { mes: 'Feb', plan: 16, real: 18, ac: 17.8 },
        { mes: 'Mar', plan: 25, real: 27, ac: 26.9 },
        { mes: 'Abr', plan: 36, real: 38, ac: 39.0 },
        { mes: 'May', plan: 46, real: 48, ac: 49.2 },
        { mes: 'Jun (Q1)', plan: 58, real: 60, ac: 61.5 },
        { mes: 'Jul (Proy)', plan: 72, real: null, ac: null },
        { mes: 'Ago (Proy)', plan: 85, real: null, ac: null },
        { mes: 'Sep (Proy)', plan: 94, real: null, ac: null },
        { mes: 'Oct (Fin)', plan: 100, real: null, ac: null }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Top Navigation Bar */}
            <header style={{
                padding: '16px 28px',
                background: 'rgba(15, 23, 42, 0.8)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#060913' }}>
                        OS
                    </div>
                    <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>Vecino Digital & Inversor</div>
                        <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>● Portal Certificado de Transparencia</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Button
                        variant="whatsapp"
                        size="sm"
                        icon="📲"
                        onClick={() => setShowShareModal(true)}
                    >
                        Compartir Portal vía WhatsApp
                    </Button>
                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                        <Button variant="ghost" size="sm">
                            ← Panel Técnico
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 20px 80px' }}>
                
                {/* Project Header Banner */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <Badge color="#f59e0b" variant="filled" size="md">
                        TRANSPARENCIA INMOBILIARIA CERTIFICADA • LEY 13.064 & LEY 22.250
                    </Badge>
                    <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.7rem)', fontWeight: 900, margin: '14px 0 8px', fontFamily: tokens.font.heading, letterSpacing: '-0.03em' }}>
                        {data?.project?.name || 'Torre Palermo Soho'}
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0 }}>
                        {data?.project?.address || 'Honduras 4850, Palermo'} — {data?.project?.city || 'CABA'}, Argentina
                    </p>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
                        Dirección Técnica: <strong>Arq. Marcelo Guillén & Arq. Victoria Schiaffino</strong> • Quincena Activa: <strong>{data?.progress?.currentQuincena || 'Q1 - Agosto'}</strong>
                    </div>
                </div>

                {/* Interactive Navigation Tabs */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveTab('resumen')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: activeTab === 'resumen' ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                            background: activeTab === 'resumen' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'resumen' ? '#f59e0b' : '#94a3b8',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        🏠 Resumen de Avance Físico
                    </button>
                    <button
                        onClick={() => setActiveTab('curvaS')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: activeTab === 'curvaS' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                            background: activeTab === 'curvaS' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'curvaS' ? '#38bdf8' : '#94a3b8',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        📈 Curva S & Cronograma Financiero (EVM)
                    </button>
                    <button
                        onClick={() => setActiveTab('cac')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: activeTab === 'cac' ? '#10b981' : 'rgba(255,255,255,0.1)',
                            background: activeTab === 'cac' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'cac' ? '#10b981' : '#94a3b8',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        📐 Reajuste por Índice CAC (+14.2%)
                    </button>
                </div>

                {/* Unit Selector & Customization Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '14px', background: 'rgba(15, 23, 42, 0.7)', padding: '16px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                            🔑
                        </div>
                        <div>
                            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#f8fafc' }}>
                                Departamento {selectedUnit} — {unitOwners[selectedUnit]?.type} ({unitOwners[selectedUnit]?.m2} m²)
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 600 }}>
                                ● Titular: {unitOwners[selectedUnit]?.name} • Cuota Parte: {unitOwners[selectedUnit]?.share} • Posesión: Dic 2026
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select
                            value={selectedUnit}
                            onChange={e => setSelectedUnit(e.target.value)}
                            style={{ padding: '8px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                            <option value="3B">Unidad 3° B — 2 Amb (54m²)</option>
                            <option value="5A">Unidad 5° A — 3 Amb (82m²)</option>
                            <option value="8C">Unidad 8° C — Penthouse (110m²)</option>
                        </select>
                        <a href="/api/v1/certificacion/pdf" download="certificado_avance_oficial.pdf" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm" icon="📥">
                                Certificado PDF
                            </Button>
                        </a>
                    </div>
                </div>

                {/* TAB 1: RESUMEN DE AVANCE */}
                {activeTab === 'resumen' && (
                    <>
                        {/* Main Progress Ring & Metrics */}
                        <GlassCard style={{ padding: '36px 28px', marginBottom: '28px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)' }} glow>
                            <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto 24px' }}>
                                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="10" />
                                    <motion.circle
                                        cx="60" cy="60" r="52" fill="none"
                                        stroke={progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#38bdf8'}
                                        strokeWidth="10"
                                        strokeDasharray="327"
                                        initial={{ strokeDashoffset: 327 }}
                                        animate={{ strokeDashoffset: 327 - (progress / 100) * 327 }}
                                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.8rem', fontWeight: 900, color: progress >= 80 ? '#10b981' : '#f59e0b', fontFamily: tokens.font.heading, lineHeight: 1 }}>
                                        {progress}%
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>Avance Global</div>
                                </div>
                            </div>

                            {/* Progress details */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', maxWidth: '680px', margin: '0 auto' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{data?.progress?.tasksCompleted || 5}</div>
                                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Hitos Concluidos</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{data?.activeWork?.length || 2}</div>
                                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>En Ejecución Activa</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{data?.workersOnSite || 6}</div>
                                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Operarios en Predio</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a78bfa' }}>1.05</div>
                                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Índice SPI (Adelantado)</div>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Grid: Active Works & Completed Milestones */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', marginBottom: '28px' }}>
                            {/* Active Work */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🏗️ Trabajos en Curso en Obra
                                </h3>
                                {data?.activeWork?.length > 0 ? data.activeWork.map((w, i) => (
                                    <div key={i} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: i < data.activeWork.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>{w.name}</span>
                                            <span style={{ fontSize: '0.82rem', color: '#f59e0b', fontWeight: 800 }}>{w.progress}%</span>
                                        </div>
                                        <ProgressBar value={w.progress} color="#f59e0b" height={6} />
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Oficial Asignado: {w.assignedTo}</div>
                                    </div>
                                )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Sin trabajos activos actualmente</p>}
                            </GlassCard>

                            {/* Milestones */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    ✅ Hitos Certificados por Dirección
                                </h3>
                                {data?.milestones?.length > 0 ? data.milestones.map((m, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <span style={{ fontSize: '1.1rem' }}>✓</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#86efac' }}>{m.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Certificado el {m.completedDate}</div>
                                        </div>
                                        <Badge color="#10b981" variant="subtle" size="xs">100% OK</Badge>
                                    </div>
                                )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Aún no se completaron hitos</p>}
                            </GlassCard>
                        </div>
                    </>
                )}

                {/* TAB 2: CURVA S & EVM */}
                {activeTab === 'curvaS' && (
                    <GlassCard style={{ padding: '32px', marginBottom: '28px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                                    📈 Curva S de Avance Acumulado (Planificado vs Real)
                                </h3>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0' }}>
                                    Earned Value Management (EVM) aplicado a Torre Palermo Soho
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                                <span style={{ color: '#94a3b8' }}>● Planificado (PV)</span>
                                <span style={{ color: '#38bdf8' }}>● Real Certificado (EV)</span>
                                <span style={{ color: '#f59e0b' }}>● Costo Ejecutado (AC)</span>
                            </div>
                        </div>

                        {/* EVM KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>Índice de Rendimiento (SPI)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>1.05</div>
                                <div style={{ fontSize: '0.72rem', color: '#86efac' }}>↑ Obra adelantada +5% respecto a cronograma</div>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>Índice de Costos (CPI)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>0.98</div>
                                <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Gasto controlado dentro del 2% del presupuesto</div>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>Variación de Plazo (SV)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>+4 Días</div>
                                <div style={{ fontSize: '0.72rem', color: '#86efac' }}>Cumplimiento holgado de fechas contractuales</div>
                            </div>
                        </div>

                        {/* Interactive S-Curve Visual Chart */}
                        <div style={{ background: 'rgba(6, 9, 19, 0.9)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '200px', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {sCurveData.map((d, i) => (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center', height: '160px' }}>
                                            {/* Planificado Bar */}
                                            <div style={{ width: '8px', height: (d.plan * 1.5) + 'px', background: 'rgba(148, 163, 184, 0.4)', borderRadius: '3px 3px 0 0' }} title={'Plan: ' + d.plan + '%'} />
                                            {/* Real Bar */}
                                            {d.real !== null && (
                                                <div style={{ width: '8px', height: (d.real * 1.5) + 'px', background: '#38bdf8', borderRadius: '3px 3px 0 0' }} title={'Real: ' + d.real + '%'} />
                                            )}
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>{d.mes}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.72rem', color: '#64748b' }}>
                                <span>Inicio de Obra (Ene 2026)</span>
                                <span style={{ color: '#38bdf8', fontWeight: 800 }}>Hoy: Q1 Agosto (60% Cumplido)</span>
                                <span>Entrega Llave en Mano (Oct 2026)</span>
                            </div>
                        </div>
                    </GlassCard>
                )}

                {/* TAB 3: REAJUSTE CAC */}
                {activeTab === 'cac' && (
                    <GlassCard style={{ padding: '32px', marginBottom: '28px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📐 Fórmula de Redeterminación Oficial por Índice CAC (CAMARCO)
                            </h3>
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0' }}>
                                Metodología transparente aplicada al contrato de fideicomiso al costo
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Índice CAC Base (Contrato Inicial)</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc', margin: '4px 0' }}>3,240.50 pts</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Diciembre 2025</div>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Índice CAC Certificación Actual</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>3,701.00 pts</div>
                                <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Agosto 2026 (+14.21%)</div>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Coeficiente de Actualización (K)</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8', margin: '4px 0' }}>1.1421</div>
                                <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Reajuste legal acumulado</div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                            💡 <strong>Garantía de Equidad:</strong> Las cuotas de pozo se recalculan mes a mes según la variación del Costo de Construcción de la Cámara Argentina de la Construcción (Criterio General Materiales + Mano de Obra UOCRA). Ningún costo extraordinario puede ser imputado fuera de la fórmula contractual aprobada.
                        </div>
                    </GlassCard>
                )}

                {/* Change Orders & Personalizaciones de Unidad */}
                <GlassCard style={{ padding: '28px', marginBottom: '28px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📑 Mis Personalizaciones & Adicionales de Obra
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>
                                Modificaciones de terminaciones aprobadas y pendientes de firma digital
                            </p>
                        </div>
                        <Badge color="#38bdf8" variant="filled" size="xs">
                            {changeOrders.filter(o => o.status === 'PENDIENTE_CLIENTE').length} Pendientes de Firma
                        </Badge>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {changeOrders.map(co => (
                            <div
                                key={co.id}
                                style={{
                                    background: 'rgba(6, 9, 19, 0.7)',
                                    padding: '16px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '14px'
                                }}
                            >
                                <div style={{ flex: '1 1 300px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <Badge color={co.status === 'APROBADA' ? '#10b981' : '#f59e0b'} variant="filled" size="xs">
                                            {co.status === 'APROBADA' ? '✓ APROBADA' : '⏳ PENDIENTE DE SU FIRMA'}
                                        </Badge>
                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Rubro: {co.rubroCode}</span>
                                    </div>
                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                                        {co.title}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                        {co.description}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right', minWidth: '160px' }}>
                                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f59e0b' }}>
                                        ${(co.totalAmountARS || 0).toLocaleString('es-AR')} ARS
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        ~USD {co.totalAmountUSD || Math.round(co.totalAmountARS / 1300)}
                                    </div>
                                </div>

                                <div>
                                    {co.status === 'PENDIENTE_CLIENTE' ? (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon="✍️"
                                            onClick={() => handleApproveOrder(co.id)}
                                        >
                                            Firmar & Aprobar
                                        </Button>
                                    ) : (
                                        <div style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '6px', color: '#10b981', fontSize: '0.76rem', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                            🛡️ Firma Verificada
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                {/* Photo Gallery (Site Log) */}
                <GlassCard style={{ padding: '28px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                📸 Registro Fotográfico Certificado de Obra
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Fotos en alta resolución con coordenadas GPS y fecha inmutable</p>
                        </div>
                        <Badge color="#38bdf8" variant="filled">3 Nuevas Esta Semana</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
                        {photos.map(photo => (
                            <motion.div
                                key={photo.id}
                                whileHover={{ y: -4 }}
                                onClick={() => setSelectedPhoto(photo)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ height: '160px', background: 'url(' + photo.url + ') center/cover no-repeat', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                                        <Badge color="#060913" variant="solid" size="xs">
                                            {photo.tag}
                                        </Badge>
                                    </div>
                                </div>
                                <div style={{ padding: '14px' }}>
                                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                                        {photo.icon} {photo.title}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📅 {photo.date} • Verificado GPS</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </GlassCard>

                {/* Cryptographic SHA-256 Stamp */}
                <GlassCard style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(139, 92, 246, 0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontSize: '1rem', fontWeight: 900, fontFamily: tokens.font.mono }}>H</div>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>
                                Certificado Criptográfico de Avance Digital
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: tokens.font.mono, marginTop: '2px' }}>
                                Hash SHA-256: {certHash.slice(0, 32)}...
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => copyHash(certHash)}>
                        {copiedHash ? '✓ ¡Hash Copiado!' : 'Copiar Hash Verificador'}
                    </Button>
                </GlassCard>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: '48px', color: '#475569', fontSize: '0.76rem' }}>
                    <p>Tecnología provista por <strong style={{ color: '#f59e0b' }}>ObraSaaS Enterprise</strong></p>
                    <p>Última sincronización satelital y certificación: {new Date().toLocaleString('es-AR')}</p>
                </div>
            </main>

            {/* Photo Lightbox Modal */}
            <AnimatePresence>
                {selectedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedPhoto(null)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.85)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#0f172a',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                maxWidth: '720px',
                                width: '100%',
                                border: '1px solid rgba(255,255,255,0.15)'
                            }}
                        >
                            <div style={{ height: '360px', background: 'url(' + selectedPhoto.url + ') center/cover no-repeat' }} />
                            <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                        {selectedPhoto.title}
                                    </h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                        Fecha: {selectedPhoto.date} • Ubicación: Predio de Obra Torre Palermo
                                    </p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => setSelectedPhoto(null)}>
                                    Cerrar
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Share via WhatsApp Modal */}
            <AnimatePresence>
                {showShareModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowShareModal(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1100,
                            padding: '20px'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#0f172a',
                                borderRadius: '18px',
                                padding: '28px',
                                maxWidth: '520px',
                                width: '100%',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#fff' }}>
                                    💬
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                                        Compartir con Comitente vía WhatsApp
                                    </h3>
                                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                                        Enlace seguro personalizado con token de acceso directo
                                    </p>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(6, 9, 19, 0.7)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Destinatario:</div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>{unitOwners[selectedUnit]?.name}</div>
                                <div style={{ fontSize: '0.76rem', color: '#10b981' }}>Departamento {selectedUnit} • {unitOwners[selectedUnit]?.phone}</div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8', wordBreak: 'break-all', marginBottom: '20px', fontFamily: tokens.font.mono }}>
                                {getShareUrl()}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <Button variant="secondary" size="sm" onClick={copyShareUrl}>
                                    {copiedShareLink ? '✓ Copiado' : 'Copiar Enlace'}
                                </Button>
                                <Button variant="whatsapp" size="sm" icon="📲" onClick={handleShareWhatsApp}>
                                    Abrir en WhatsApp
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setShowShareModal(false)}>
                                    Cerrar
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
