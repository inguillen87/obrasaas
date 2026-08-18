"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

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

    if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Cargando compliance...</div>;

    const uocra = data?.uocra || {};
    const polizas = data?.polizas || {};
    const artSummary = polizas.art?.summary || {};

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            <header style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>⚖️ Centro de Compliance</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>UOCRA • ART • SRT • Ley 22.250</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Link href="/dashboard" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>← Dashboard</Link>
                    <Link href="/ejecutivo" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>📊 CEO</Link>
                </div>
            </header>

            <main style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { label: 'Compliance Rate', value: `${artSummary.complianceRate || 0}%`, color: (artSummary.complianceRate || 0) >= 80 ? '#22c55e' : '#ef4444', icon: '🛡️' },
                        { label: 'ART Vigentes', value: artSummary.vigentes || 0, color: '#22c55e', icon: '✅' },
                        { label: 'ART Vencidas', value: artSummary.vencidas || 0, color: '#ef4444', icon: '🚨' },
                        { label: 'Próximas a Vencer', value: artSummary.proximasAVencer || 0, color: '#f59e0b', icon: '⚠️' },
                        { label: 'Costo Mensual UOCRA', value: formatARS(uocra.totals?.costoTotalMensual), color: '#3b82f6', icon: '💰' }
                    ].map((kpi, i) => (
                        <div key={i} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>{kpi.label}</span>
                                <span>{kpi.icon}</span>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    {[
                        { id: 'art', label: '🛡️ ART & Seguros' },
                        { id: 'uocra', label: '👷 UOCRA Jornales' },
                        { id: 'polizas', label: '📋 Pólizas de Obra' }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            style={{ padding: '10px 20px', background: activeTab === tab.id ? '#f59e0b' : '#1e293b', color: activeTab === tab.id ? '#0f172a' : '#94a3b8', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 700 : 400, fontSize: '0.85rem' }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ART Tab */}
                {activeTab === 'art' && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {(polizas.art?.policies || []).map((p, i) => (
                            <div key={i} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.worker}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{p.company} • {p.policyNumber}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: p.status === 'VIGENTE' ? '#22c55e' : '#ef4444' }}>{p.alert}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Vence: {p.expirationDate || 'N/A'}</div>
                                </div>
                            </div>
                        ))}
                        {(!polizas.art?.policies || polizas.art.policies.length === 0) && (
                            <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>No hay pólizas ART registradas</div>
                        )}
                    </div>
                )}

                {/* UOCRA Tab */}
                {activeTab === 'uocra' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                            {(uocra.workers || []).map((w, i) => (
                                <div key={i} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 700 }}>{w.name}</div>
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#172032', borderRadius: '10px', color: '#f59e0b' }}>{w.categoriaUOCRA}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.8rem' }}>
                                        <div><span style={{ color: '#64748b' }}>Jornal:</span> {formatARS(w.jornalDiario)}</div>
                                        <div><span style={{ color: '#64748b' }}>Presentismo:</span> {formatARS(w.presentismo)}</div>
                                        <div><span style={{ color: '#64748b' }}>Quincenal:</span> <strong style={{ color: '#22c55e' }}>{formatARS(w.quincenal)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>ART:</span> <span style={{ color: w.artStatus === 'SIN PÓLIZA' ? '#ef4444' : '#22c55e' }}>{w.artStatus}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {uocra.totals && (
                            <div style={{ background: '#172032', borderRadius: '10px', padding: '20px', border: '1px solid #334155' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>📊 Resumen de Costos Laborales</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
                                    <div><span style={{ color: '#64748b' }}>Jornal diario total:</span><br /><strong>{formatARS(uocra.totals.jornalDiario)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Quincenal:</span><br /><strong>{formatARS(uocra.totals.quincenal)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Mensual:</span><br /><strong style={{ color: '#f59e0b' }}>{formatARS(uocra.totals.mensual)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Cargas sociales (45%):</span><br /><strong>{formatARS(uocra.totals.cargasSociales)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Costo total mensual:</span><br /><strong style={{ color: '#ef4444' }}>{formatARS(uocra.totals.costoTotalMensual)}</strong></div>
                                    <div><span style={{ color: '#64748b' }}>Anual:</span><br /><strong>{formatARS(uocra.totals.anual)}</strong></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Pólizas Tab */}
                {activeTab === 'polizas' && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {(polizas.projectPolicies || []).map((p, i) => (
                            <div key={i} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.type}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{p.company}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.85rem' }}>{p.status}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Cobertura: {p.coverage}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Vence: {p.expirationDate}</div>
                                </div>
                            </div>
                        ))}
                        <div style={{ marginTop: '12px', padding: '16px', background: '#172032', borderRadius: '10px', border: '1px solid #334155' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>📚 Marco Legal</h4>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                <div>• {polizas.legal?.ley || 'Ley 24.557 — Riesgos del Trabajo'}</div>
                                <div>• {polizas.legal?.srt || 'SRT Res. 319/99'}</div>
                                <div>• {polizas.legal?.cobertura || 'Cobertura obligatoria'}</div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
