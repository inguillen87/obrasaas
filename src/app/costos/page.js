"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CostosPage() {
    const [budget, setBudget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddExpense, setShowAddExpense] = useState(null);
    const [expense, setExpense] = useState({ monto: '', concepto: '', proveedor: '' });

    useEffect(() => {
        loadBudget();
    }, []);

    const loadBudget = async () => {
        try {
            const res = await fetch('/api/v1/budget', { headers: { 'x-api-key': 'internal' } });
            if (res.ok) {
                const data = await res.json();
                setBudget(data);
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const addExpense = async (rubroId) => {
        if (!expense.monto) return;
        try {
            await fetch('/api/v1/budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': 'internal' },
                body: JSON.stringify({ rubroId, monto: parseFloat(expense.monto), concepto: expense.concepto, proveedor: expense.proveedor })
            });
            setShowAddExpense(null);
            setExpense({ monto: '', concepto: '', proveedor: '' });
            loadBudget();
        } catch (err) { console.error(err); }
    };

    const formatARS = (n) => `$${(n || 0).toLocaleString('es-AR')}`;
    const pct = (exec, pres) => pres > 0 ? ((exec / pres) * 100).toFixed(1) : 0;
    const barColor = (p) => p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#22c55e';

    if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>⏳ Cargando presupuesto...</div>;

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            {/* Header */}
            <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '1.5rem' }}>💰</span>
                    <div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Control de Costos</h1>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{budget?.projectName} — Presupuesto por Rubro</span>
                    </div>
                </div>
                <Link href="/dashboard" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>← Dashboard</Link>
            </header>

            <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
                {/* KPI Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    {[
                        { label: 'Presupuesto Total', value: formatARS(budget?.totalPresupuesto), color: '#3b82f6', icon: '📊' },
                        { label: 'Ejecutado', value: formatARS(budget?.totalEjecutado), color: '#f59e0b', icon: '💳' },
                        { label: 'Por Ejecutar', value: formatARS(budget?.totalPorEjecutar), color: '#22c55e', icon: '📈' },
                        { label: 'Avance Financiero', value: `${budget?.desvioGlobal}%`, color: budget?.desvioGlobal > 80 ? '#ef4444' : '#22c55e', icon: '🎯' },
                        { label: 'Avance Físico', value: `${budget?.avanceFisico}%`, color: '#a855f7', icon: '🏗️' },
                        { label: 'Curva S (Δ)', value: `${budget?.curvaS?.diferencia > 0 ? '+' : ''}${budget?.curvaS?.diferencia}%`, color: Math.abs(budget?.curvaS?.diferencia) > 10 ? '#ef4444' : '#22c55e', icon: '📉' }
                    ].map((kpi, i) => (
                        <div key={i} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>{kpi.label}</span>
                                <span>{kpi.icon}</span>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>

                {/* Rubros Table */}
                <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>📋 Desglose por Rubro</h2>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{budget?.rubros?.length} rubros</span>
                    </div>

                    {budget?.rubros?.map((rubro, i) => {
                        const p = parseFloat(pct(rubro.ejecutado, rubro.presupuesto));
                        return (
                            <div key={i} style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#1e293b' : '#172032' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rubro.nombre}</span>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{formatARS(rubro.ejecutado)} / {formatARS(rubro.presupuesto)}</span>
                                        <span style={{ fontWeight: 700, color: barColor(p), fontSize: '0.85rem', minWidth: '50px', textAlign: 'right' }}>{p}%</span>
                                        <button onClick={() => setShowAddExpense(showAddExpense === rubro.id ? null : rubro.id)}
                                            style={{ padding: '4px 10px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>
                                            + Gasto
                                        </button>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', background: barColor(p), borderRadius: '3px', transition: 'width 0.3s' }} />
                                </div>

                                {/* Add expense form */}
                                {showAddExpense === rubro.id && (
                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input placeholder="Monto $" type="number" value={expense.monto} onChange={e => setExpense({...expense, monto: e.target.value})}
                                            style={{ padding: '8px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', width: '120px' }} />
                                        <input placeholder="Concepto" value={expense.concepto} onChange={e => setExpense({...expense, concepto: e.target.value})}
                                            style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem' }} />
                                        <input placeholder="Proveedor" value={expense.proveedor} onChange={e => setExpense({...expense, proveedor: e.target.value})}
                                            style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem' }} />
                                        <button onClick={() => addExpense(rubro.id)} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Agregar</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Curva S Visual */}
                <div style={{ marginTop: '24px', background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>📉 Curva S — Avance Financiero vs Físico</h3>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>💰 Financiero</span>
                                <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>{budget?.curvaS?.avanceFinanciero}%</span>
                            </div>
                            <div style={{ width: '100%', height: '12px', background: '#334155', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(budget?.curvaS?.avanceFinanciero || 0, 100)}%`, height: '100%', background: '#f59e0b', borderRadius: '6px' }} />
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🏗️ Físico</span>
                                <span style={{ fontSize: '0.8rem', color: '#a855f7', fontWeight: 700 }}>{budget?.curvaS?.avanceFisico}%</span>
                            </div>
                            <div style={{ width: '100%', height: '12px', background: '#334155', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(budget?.curvaS?.avanceFisico || 0, 100)}%`, height: '100%', background: '#a855f7', borderRadius: '6px' }} />
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', minWidth: '80px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Diferencia</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: Math.abs(budget?.curvaS?.diferencia) > 10 ? '#ef4444' : '#22c55e' }}>
                                {budget?.curvaS?.diferencia > 0 ? '+' : ''}{budget?.curvaS?.diferencia}%
                            </div>
                        </div>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '12px' }}>
                        {Math.abs(budget?.curvaS?.diferencia) > 10
                            ? '🚨 Desvío significativo. El avance financiero no se corresponde con el físico.'
                            : '✅ Los avances financiero y físico están alineados dentro de márgenes aceptables.'}
                    </p>
                </div>
            </main>
        </div>
    );
}
