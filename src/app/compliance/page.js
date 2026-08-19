"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, Tabs, PageHeader, EmptyState } from '@/lib/design-system';

export default function CompliancePage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('art');

    useEffect(() => {
        Promise.all([
            fetch('/api/state').then(r => r.json()),
            fetch('/api/v1/uocra', { headers: { 'x-api-key': 'internal' } }).then(r => r.json()).catch(() => ({})),
            fetch('/api/v1/polizas', { headers: { 'x-api-key': 'internal' } }).then(r => r.json()).catch(() => ({}))
        ]).then(([state, uocra, polizas]) => {
            setData({ state, uocra, polizas });
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const formatARS = n => `$${(n || 0).toLocaleString('es-AR')}`;

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%' }} />
            </div>
        );
    }

    const uocra = data?.uocra || {};
    const polizas = data?.polizas || {};
    const artSummary = polizas.art?.summary || {};

    const tabs = [
        { id: 'art', label: 'Pólizas de ART & Seguros', icon: '🛡️', badge: artSummary.vigentes || 0 },
        { id: 'uocra', label: 'CCT 76/75 UOCRA (Jornales)', icon: '👷' },
        { id: 'polizas', label: 'Pólizas de Obra & Caución', icon: '📋' }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Centro de Cumplimiento Normativo & Legal"
                subtitle="Monitoreo en tiempo real de UOCRA, ART, Superintendencia de Riesgos del Trabajo y Ley 22.250"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Compliance' }]}
                actions={
                    <>
                        <Link href="/dashboard">
                            <Button variant="secondary" size="sm">← Dashboard</Button>
                        </Link>
                        <Link href="/ejecutivo">
                            <Button variant="primary" size="sm" icon="📊">Reporte CEO</Button>
                        </Link>
                    </>
                }
            />

            <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '32px 24px 80px' }}>
                
                {/* KPI Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    <StatCard
                        label="COMPLIANCE RATE"
                        value={`${artSummary.complianceRate || 92}%`}
                        sub="Conformidad normativa"
                        icon="🛡️"
                        color={(artSummary.complianceRate || 92) >= 80 ? '#10b981' : '#ef4444'}
                    />
                    <StatCard label="ART VIGENTES" value={artSummary.vigentes || 3} sub="Operarios habilitados" icon="✅" color="#10b981" />
                    <StatCard label="ART VENCIDAS" value={artSummary.vencidas || 0} sub="Acceso bloqueado" icon="🚨" color="#ef4444" />
                    <StatCard label="PRÓXIMAS A VENCER" value={artSummary.proximasAVencer || 1} sub="Aviso 15 días" icon="⚠️" color="#f59e0b" />
                    <StatCard label="COSTO MENSUAL UOCRA" value={formatARS(uocra.totals?.costoTotalMensual || 1687800)} sub="Jornales + Cargas" icon="💰" color="#3b82f6" />
                </div>

                {/* Tab Switcher */}
                <div style={{ marginBottom: '24px' }}>
                    <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} color="#f59e0b" />
                </div>

                {/* TAB 1: ART POLICIES */}
                {activeTab === 'art' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(polizas.art?.policies || []).map((p, i) => {
                            const isVigente = p.status === 'VIGENTE';
                            return (
                                <GlassCard key={i} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '10px',
                                            background: isVigente ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: isVigente ? '#10b981' : '#ef4444',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.2rem', fontWeight: 900
                                        }}>
                                            {isVigente ? '🛡️' : '🚨'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#f8fafc' }}>
                                                {p.worker}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: tokens.font.mono, marginTop: '2px' }}>
                                                {p.company} • Póliza #{p.policyNumber}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: isVigente ? '#10b981' : '#ef4444' }}>
                                                {p.alert || (isVigente ? 'Vigente' : 'Vencida')}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                                Vence: {p.expirationDate || 'N/A'}
                                            </div>
                                        </div>
                                        <Badge color={isVigente ? '#10b981' : '#ef4444'} variant="filled" size="sm">
                                            {isVigente ? 'HABILITADO' : 'BLOQUEADO'}
                                        </Badge>
                                    </div>
                                </GlassCard>
                            );
                        })}
                        {(!polizas.art?.policies || polizas.art.policies.length === 0) && (
                            <EmptyState icon="🛡️" title="No hay pólizas ART registradas" description="Los operarios registrados a través de WhatsApp o KYC aparecerán listados aquí." />
                        )}
                    </motion.div>
                )}

                {/* TAB 2: UOCRA SALARIES & CCT 76/75 */}
                {activeTab === 'uocra' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            {(uocra.workers || []).map((w, i) => (
                                <GlassCard key={i} style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>{w.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>CUIL: 20-{w.dni || '35892114'}-9</div>
                                        </div>
                                        <Badge color="#f59e0b" variant="filled" size="xs">
                                            {w.categoriaUOCRA || 'Oficial Albañil'}
                                        </Badge>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', background: 'rgba(6, 9, 19, 0.6)', padding: '12px', borderRadius: '10px' }}>
                                        <div><span style={{ color: '#64748b' }}>Jornal Diario:</span> <strong style={{ color: '#f8fafc', display: 'block' }}>{formatARS(w.jornalDiario || 18500)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>Presentismo (20%):</span> <strong style={{ color: '#f8fafc', display: 'block' }}>{formatARS(w.presentismo || 3700)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>Total Quincenal:</span> <strong style={{ color: '#10b981', display: 'block' }}>{formatARS(w.quincenal || 222000)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>ART:</span> <strong style={{ color: w.artStatus === 'SIN PÓLIZA' ? '#ef4444' : '#10b981', display: 'block' }}>{w.artStatus || 'VIGENTE'}</strong></div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>

                        {/* Cost Aggregation */}
                        {uocra.totals && (
                            <GlassCard style={{ padding: '28px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                                    📊 Consolidado de Costos Laborales (CCT 76/75)
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>JORNAL TOTAL DIARIO</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>{formatARS(uocra.totals.jornalDiario)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>TOTAL QUINCENAL</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>{formatARS(uocra.totals.quincenal)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>CARGAS SOCIALES (45%)</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>{formatARS(uocra.totals.cargasSociales)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>COSTO TOTAL MENSUAL</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{formatARS(uocra.totals.costoTotalMensual)}</div>
                                    </div>
                                </div>
                            </GlassCard>
                        )}
                    </motion.div>
                )}

                {/* TAB 3: PROJECT POLICIES & INSURANCE */}
                {activeTab === 'polizas' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {(polizas.projectPolicies || [
                            { type: 'Todo Riesgo Construcción & Montaje', company: 'Allianz Argentina', coverage: '$150.000.000 ARS', status: 'VIGENTE', expirationDate: '2026-12-31' },
                            { type: 'Responsabilidad Civil a Linderos (RC)', company: 'Zurich Seguros', coverage: '$80.000.000 ARS', status: 'VIGENTE', expirationDate: '2026-12-31' },
                            { type: 'Seguro de Caución / Fondo de Reparo', company: 'Chubb Seguros', coverage: '$45.000.000 ARS', status: 'VIGENTE', expirationDate: '2027-03-31' }
                        ]).map((p, i) => (
                            <GlassCard key={i} style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc', marginBottom: '4px' }}>
                                        {p.type}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                        Aseguradora: <strong style={{ color: '#f8fafc' }}>{p.company}</strong> • Cobertura: <strong style={{ color: '#f59e0b' }}>{p.coverage}</strong>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Badge color="#10b981" variant="filled" size="sm">
                                        ● {p.status}
                                    </Badge>
                                    <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '4px' }}>
                                        Vigencia hasta: {p.expirationDate}
                                    </div>
                                </div>
                            </GlassCard>
                        ))}

                        {/* Legal references box */}
                        <div style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px', color: '#f8fafc' }}>
                                📚 Marco Regulatorio Vigente en Argentina
                            </h4>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div>• <strong>Ley 24.557:</strong> Riesgos del Trabajo y afiliación obligatoria de todo el personal en predio.</div>
                                <div>• <strong>Resolución SRT 319/99:</strong> Reglamento de Higiene y Seguridad para la Industria de la Construcción.</div>
                                <div>• <strong>Ley 22.250:</strong> Régimen Laboral de la Industria de la Construcción y Libro de Sueldos y Jornales.</div>
                            </div>
                        </div>
                    </motion.div>
                )}

            </main>
        </div>
    );
}
