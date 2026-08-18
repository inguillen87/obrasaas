"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ExecutiveDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [stateRes, statsRes, budgetRes] = await Promise.all([
                fetch('/api/state').then(r => r.json()),
                fetch('/api/admin/stats', { headers: { 'x-api-key': 'internal' } }).then(r => r.json()).catch(() => ({})),
                fetch('/api/v1/budget', { headers: { 'x-api-key': 'internal' } }).then(r => r.json()).catch(() => ({}))
            ]);
            setData({ state: stateRes, stats: statsRes, budget: budgetRes });
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const formatARS = (n) => `$${(n || 0).toLocaleString('es-AR')}`;

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
            ⏳ Cargando Dashboard Ejecutivo...
        </div>
    );

    const state = data?.state || {};
    const stats = data?.stats || {};
    const budget = data?.budget || {};
    const projects = state.projects || [];
    const avance = parseFloat(state.avancePercentage) || 0;
    const incidents = state.incidents || [];

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            {/* Header */}
            <header style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderBottom: '1px solid #334155', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>📊 Dashboard Ejecutivo</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Vista consolidada para CEO / Gerente General</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Link href="/costos" style={{ padding: '8px 16px', background: '#f59e0b', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700 }}>💰 Costos</Link>
                    <Link href="/dashboard" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>🏗️ Obra</Link>
                    <Link href="/superadmin" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>⚙️ Admin</Link>
                </div>
            </header>

            <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
                {/* Revenue KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { label: 'MRR', value: `$${stats.platform?.mrr || 29}`, sub: 'USD/mes', color: '#22c55e', icon: '💰' },
                        { label: 'Tenants', value: stats.platform?.totalTenants || 1, sub: 'activos', color: '#3b82f6', icon: '🏢' },
                        { label: 'Obras', value: projects.length, sub: 'en curso', color: '#f59e0b', icon: '🏗️' },
                        { label: 'Operarios', value: stats.platform?.totalWorkers || 0, sub: 'registrados', color: '#a855f7', icon: '👷' },
                        { label: 'Presupuesto', value: formatARS(budget.totalPresupuesto), sub: 'total', color: '#06b6d4', icon: '📊' },
                        { label: 'Ejecutado', value: formatARS(budget.totalEjecutado), sub: `${budget.desvioGlobal || 0}%`, color: '#f97316', icon: '💳' },
                        { label: 'SHA-256', value: stats.platform?.auditBlocks || 0, sub: 'bloques', color: '#ef4444', icon: '🔐' },
                        { label: 'Incidencias', value: incidents.length, sub: `${incidents.filter(i => i.type === 'danger').length} críticas`, color: '#dc2626', icon: '🚨' }
                    ].map((kpi, i) => (
                        <div key={i} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>{kpi.label}</span>
                                <span style={{ fontSize: '1rem' }}>{kpi.icon}</span>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                            <div style={{ color: '#475569', fontSize: '0.7rem' }}>{kpi.sub}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    {/* Projects Heatmap */}
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>🗺️ Semáforo de Obras</h3>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {projects.map((p, i) => {
                                const isActive = p.id === state.activeProjectId;
                                const riskLevel = incidents.filter(inc => inc.type === 'danger').length > 0 ? 'red' : incidents.filter(inc => inc.type === 'warning').length > 0 ? 'yellow' : 'green';
                                const riskColor = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' }[riskLevel];
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: isActive ? '#172032' : '#0f172a', borderRadius: '8px', border: isActive ? '1px solid #334155' : '1px solid transparent' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: riskColor, boxShadow: `0 0 8px ${riskColor}` }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{p.city}, {p.province} • {p.expectedWorkersCount || 5} operarios</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, color: riskColor, fontSize: '0.9rem' }}>{isActive ? `${avance}%` : '—'}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>avance</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>⚡ Accesos Rápidos</h3>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {[
                                { label: 'Control de Costos', href: '/costos', icon: '💰' },
                                { label: 'Portal Inversor', href: '/portal', icon: '🏠' },
                                { label: 'Admin Panel', href: '/superadmin', icon: '⚙️' },
                                { label: 'API Docs', href: '/api-docs', icon: '📋' },
                                { label: 'Dashboard Obra', href: '/dashboard', icon: '🏗️' },
                                { label: 'Presupuesto', href: '/presupuesto', icon: '📊' },
                                { label: 'Nuevo Tenant', href: '/onboarding', icon: '🚀' }
                            ].map((a, i) => (
                                <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#0f172a', borderRadius: '8px', textDecoration: 'none', color: '#f8fafc', fontSize: '0.85rem', border: '1px solid #334155' }}>
                                    <span>{a.icon}</span> {a.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Budget by Rubro Summary */}
                {budget.rubros && (
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>💰 Resumen Presupuestario por Rubro</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
                            {budget.rubros.map((r, i) => {
                                const p = r.presupuesto > 0 ? (r.ejecutado / r.presupuesto) * 100 : 0;
                                return (
                                    <div key={i} style={{ padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{r.nombre.split('(')[0].trim()}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#22c55e' }}>{p.toFixed(0)}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', background: p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#22c55e', borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
