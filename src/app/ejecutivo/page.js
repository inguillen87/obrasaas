"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, PageHeader, Modal, staggerContainer, staggerItem } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function ExecutiveDashboard() {
    const { isMobile } = useBreakpoint();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterRisk, setFilterRisk] = useState('all');
    const [summaryModal, setSummaryModal] = useState({ open: false, loading: false, result: null });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [stateRes, statsRes, budgetRes, predictiveRes] = await Promise.all([
                fetch('/api/state').then(r => r.json()),
                fetch('/api/admin/stats', { headers: { 'x-api-key': 'internal' } }).then(r => r.json()).catch(() => ({})),
                fetch('/api/v1/budget', { headers: { 'x-api-key': 'internal' } }).then(r => r.json()).catch(() => ({})),
                fetch('/api/v1/predictive').then(r => r.json()).catch(() => ({}))
            ]);
            setData({ state: stateRes, stats: statsRes, budget: budgetRes, predictive: predictiveRes });
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleTriggerDailySummary = async () => {
        setSummaryModal({ open: true, loading: true, result: null });
        setCopied(false);
        try {
            const res = await fetch('/api/cron/daily-summary', { method: 'POST' });
            const json = await res.json();
            setSummaryModal({ open: true, loading: false, result: json });
        } catch (err) {
            setSummaryModal({ open: true, loading: false, result: { error: err.message } });
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const formatARS = (n) => `$${(n || 0).toLocaleString('es-AR')}`;

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 44, height: 44, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%' }} />
            </div>
        );
    }

    const state = data?.state || {};
    const stats = data?.stats || {};
    const budget = data?.budget || {};
    const predictive = data?.predictive || {};
    const projects = state.projects || [];
    const avance = parseFloat(state.avancePercentage) || 0;
    const incidents = state.incidents || [];
    const criticalIncidents = incidents.filter(i => i.type === 'danger').length;

    const filteredProjects = projects.filter(p => {
        if (filterRisk === 'critical') return criticalIncidents > 0;
        return true;
    });

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Centro de Mando Ejecutivo (CEO / C-Level)"
                subtitle="Vista consolidada de cartera de obras, IA predictiva y flujo financiero"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ejecutivo' }]}
                actions={
                    <>
                        <Button variant="secondary" size="sm" onClick={loadData}>↻ Actualizar</Button>
                        <Button variant="secondary" size="sm" icon="📱" onClick={handleTriggerDailySummary}>Resumen WhatsApp</Button>
                        <a href="/api/v1/certificacion/pdf" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm" icon="📄">Certificado PDF</Button>
                        </a>
                        <Link href="/costos">
                            <Button variant="primary" size="sm">Control de Costos</Button>
                        </Link>
                    </>
                }
            />

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px clamp(14px, 4vw, 32px) 80px' }}>
                
                {/* Grid 1: KPI Executive Summary Cards */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '32px' }}
                >
                    <StatCard label="MRR PLATAFORMA" value={`$${stats.platform?.mrr || 29} USD`} sub="Ingreso recurrente" icon="📈" color="#10b981" trend={12} />
                    <StatCard label="CARTERA DE OBRAS" value={projects.length} sub="Proyectos activos" icon="🏗️" color="#f59e0b" />
                    <StatCard label="PERSONAL EN NÓMINA" value={stats.platform?.totalWorkers || 0} sub="Operarios registrados" icon="👷" color="#3b82f6" />
                    <StatCard label="PRESUPUESTO TOTAL" value={`$${((budget.totalPresupuesto || 0) / 1000000).toFixed(1)}M`} sub="ARS Consolidado" icon="🏦" color="#06b6d4" />
                    <StatCard label="EJECUTADO GLOBAL" value={`${budget.desvioGlobal || 0}%`} sub={formatARS(budget.totalEjecutado)} icon="💳" color="#f97316" />
                    <StatCard label="TRAZABILIDAD SHA-256" value={stats.platform?.auditBlocks || 0} sub="Bloques certificados" icon="🔐" color="#8b5cf6" />
                    <StatCard label="INCIDENCIAS CRÍTICAS" value={criticalIncidents} sub={`${incidents.length} totales`} icon="🚨" color={criticalIncidents > 0 ? '#ef4444' : '#10b981'} />
                </motion.div>

                {/* Grid 2: Projects Health Radar & Strategic Quick Launch */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)', gap: '24px', marginBottom: '32px' }}>
                    
                    {/* Projects Health Table / Radar */}
                    <div style={{ gridColumn: isMobile ? '1 / -1' : 'span 8' }}>
                        <GlassCard style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                        Semáforo de Salud por Emplazamiento
                                    </h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Estado de avance, riesgo y cumplimiento de plazos</p>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        onClick={() => setFilterRisk('all')}
                                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: filterRisk === 'all' ? '#1e293b' : 'transparent', color: filterRisk === 'all' ? '#f8fafc' : '#64748b', fontSize: '0.74rem', cursor: 'pointer' }}
                                    >
                                        Todas ({projects.length})
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {filteredProjects.map((p, idx) => {
                                    const isActive = p.id === state.activeProjectId;
                                    const riskColor = criticalIncidents > 0 && isActive ? '#ef4444' : '#22c55e';
                                    const riskLabel = criticalIncidents > 0 && isActive ? 'Atención Requerida' : 'Operación Normal';

                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                background: isActive ? 'rgba(30, 41, 59, 0.7)' : 'rgba(15, 23, 42, 0.5)',
                                                border: `1px solid ${isActive ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                                                borderRadius: '12px',
                                                padding: '16px 20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '14px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: riskColor, boxShadow: `0 0 10px ${riskColor}`, flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                                                        {p.name} {isActive && <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>[PRINCIPAL]</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                                                        📍 {p.city}, {p.province || 'Argentina'} • 👷 {p.expectedWorkersCount || 5} operarios asignados
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Avance Físico</div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b', fontFamily: tokens.font.mono }}>
                                                        {isActive ? `${avance}%` : '42%'}
                                                    </div>
                                                </div>
                                                <Badge color={riskColor} variant="filled" size="sm">
                                                    {riskLabel}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    </div>

                    {/* Strategic Shortcuts & Financial Health */}
                    <div style={{ gridColumn: isMobile ? '1 / -1' : 'span 4' }}>
                        <GlassCard style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                                    Accesos estratégicos
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { label: 'Control de Costos por Rubro', href: '/costos', icon: '💰', desc: 'Curva S y gastos en tiempo real' },
                                        { label: 'Portal Inversor (Vecino Digital)', href: '/portal', icon: '🏠', desc: 'Enlace público para inversores' },
                                        { label: 'Centro de Compliance UOCRA/ART', href: '/compliance', icon: '⚖️', desc: 'Alertas de vencimiento y jornales' },
                                        { label: 'Marketplace de Proveedores', href: '/marketplace', icon: '🏪', desc: 'Directorio verificado y cotizaciones' },
                                        { label: 'Panel Super Admin', href: '/superadmin', icon: '⚙️', desc: 'Tenants, métricas de plataforma' }
                                    ].map((a, i) => (
                                        <Link key={i} href={a.href} style={{ textDecoration: 'none' }}>
                                            <div style={{
                                                padding: '12px 14px',
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                borderRadius: '10px',
                                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'; }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{a.label}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{a.desc}</div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 800 }}>
                                        🤖 Insight Predictivo IA (CIRSOC 201):
                                    </div>
                                    <Badge color={predictive.status === 'OPTIMO' ? '#10b981' : predictive.status === 'EN_RIESGO' ? '#ef4444' : '#f59e0b'} variant="filled" size="xs">
                                        Score: {predictive.overallHealthScore || 88}/100
                                    </Badge>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4, marginBottom: '8px' }}>
                                    {predictive.weatherRisk?.optimalWindow || 'Próxima ventana de 72hs sin lluvia: Jueves a Sábado para hormigonado de losa.'}
                                </div>
                                {predictive.identifiedRisks && predictive.identifiedRisks.length > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        ⚠️ {predictive.identifiedRisks[0].title}: {predictive.identifiedRisks[0].recommendation}
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>
                </div>

                {/* Budget by Rubro Visual Grid */}
                {budget.rubros && (
                    <GlassCard style={{ padding: '28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                    Ejecución presupuestaria por rubro Constructivo
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Monitoreo en vivo contra presupuesto inicial de obra</p>
                            </div>
                            <Link href="/costos">
                                <Button variant="secondary" size="sm">Ver Detalle Analítico →</Button>
                            </Link>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                            {budget.rubros.map((r, i) => {
                                const p = r.presupuesto > 0 ? (r.ejecutado / r.presupuesto) * 100 : 0;
                                const statusColor = p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#10b981';
                                return (
                                    <div key={i} style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>{r.nombre.split('(')[0].trim()}</span>
                                            <Badge color={statusColor} variant="filled" size="xs">
                                                {p.toFixed(0)}%
                                            </Badge>
                                        </div>
                                        <ProgressBar value={p} color={statusColor} height={5} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                                            <span>Ejec: ${r.ejecutado?.toLocaleString('es-AR')}</span>
                                            <span>Pres: ${r.presupuesto?.toLocaleString('es-AR')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                )}

                {/* Cash Flow Projection (6 Months) */}
                <GlassCard style={{ padding: '28px', marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                💹 Proyección de Flujo de Fondos Multi-Obra (6 Meses)
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Escenario con tasa de inflación CAC mensual del 4.2% aplicado sobre costos pendientes</p>
                        </div>
                        <Badge color="#06b6d4" variant="filled" size="sm">Actualizado Hoy</Badge>
                    </div>

                    {(() => {
                        const totalPres = budget.totalPresupuesto || 85000000;
                        const totalEjec = budget.totalEjecutado || 32500000;
                        const pendiente = totalPres - totalEjec;
                        const tasaMensual = 0.042;
                        const meses = ['Sep 2026', 'Oct 2026', 'Nov 2026', 'Dic 2026', 'Ene 2027', 'Feb 2027'];
                        
                        return (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                                            <th style={{ textAlign: 'left', padding: '8px 14px' }}>Mes</th>
                                            <th style={{ textAlign: 'right', padding: '8px 14px' }}>Egreso Proyectado</th>
                                            <th style={{ textAlign: 'right', padding: '8px 14px' }}>Ajuste CAC</th>
                                            <th style={{ textAlign: 'right', padding: '8px 14px' }}>Ingreso (Certificación)</th>
                                            <th style={{ textAlign: 'right', padding: '8px 14px' }}>Saldo Acumulado</th>
                                            <th style={{ textAlign: 'center', padding: '8px 14px' }}>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {meses.map((mes, i) => {
                                            const egresoBase = (pendiente / 6);
                                            const ajusteCAC = egresoBase * tasaMensual * (i + 1);
                                            const egresoAjustado = egresoBase + ajusteCAC;
                                            const ingreso = egresoBase * 1.12; // 12% markup
                                            const saldo = (ingreso - egresoAjustado) * (i + 1);
                                            const isPositive = saldo >= 0;
                                            
                                            return (
                                                <tr key={i} style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
                                                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc', borderRadius: '8px 0 0 8px' }}>{mes}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#f87171', fontFamily: tokens.font.mono }}>{formatARS(Math.round(egresoAjustado))}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#fbbf24', fontFamily: tokens.font.mono }}>+{formatARS(Math.round(ajusteCAC))}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#34d399', fontFamily: tokens.font.mono }}>{formatARS(Math.round(ingreso))}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: isPositive ? '#10b981' : '#ef4444', fontFamily: tokens.font.mono }}>{isPositive ? '+' : ''}{formatARS(Math.round(saldo))}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>
                                                        <Badge color={isPositive ? '#10b981' : '#ef4444'} variant="filled" size="xs">
                                                            {isPositive ? 'Superávit' : 'Déficit'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </GlassCard>

            </main>

            {/* WhatsApp Daily Summary Dispatch Modal */}
            <Modal
                isOpen={summaryModal.open}
                onClose={() => setSummaryModal({ open: false, loading: false, result: null })}
                title="📱 Despacho Diario de Resumen Ejecutivo WhatsApp"
                maxWidth="640px"
            >
                {summaryModal.loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 36, height: 36, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', margin: '0 auto 16px' }} />
                        Generando consolidado de obra y ejecutando motor cron...
                    </div>
                ) : summaryModal.result?.formattedWhatsAppDispatch ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <Badge color="#10b981" variant="filled" size="sm">✓ DESPACHO PREPARADO</Badge>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Obra: {summaryModal.result.project}
                            </span>
                        </div>

                        <div style={{
                            background: '#0b141a',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: '12px',
                            padding: '16px',
                            fontFamily: tokens.font.mono,
                            fontSize: '0.8rem',
                            color: '#e9edef',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                            maxHeight: '360px',
                            overflowY: 'auto',
                            marginBottom: '20px'
                        }}>
                            {summaryModal.result.formattedWhatsAppDispatch}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => copyToClipboard(summaryModal.result.formattedWhatsAppDispatch)}
                            >
                                {copied ? '✓ Copiado al portapapeles' : '📋 Copiar Mensaje'}
                            </Button>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(summaryModal.result.formattedWhatsAppDispatch)}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ textDecoration: 'none' }}
                            >
                                <Button variant="primary" size="md" icon="💬">
                                    Abrir en WhatsApp Web
                                </Button>
                            </a>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
                        Error al generar despacho: {summaryModal.result?.error || 'No se pudo conectar con el servidor'}
                    </div>
                )}
            </Modal>

            {/* Print Stylesheet for PDF Export */}
            <style jsx global>{`
                @media print {
                    body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    header, nav, .no-print { display: none !important; }
                    main { padding: 0 !important; max-width: 100% !important; }
                }
            `}</style>
        </div>
    );
}
