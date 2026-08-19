"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { GlassCard, StatCard, ProgressBar, Badge, Button, PageHeader, tokens, staggerContainer, staggerItem, fadeInUp } from '@/lib/design-system';

export default function CostosPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedRubro, setSelectedRubro] = useState(null);
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [newExpense, setNewExpense] = useState({ rubroId: '', concepto: '', monto: '' });

    useEffect(() => {
        fetch('/api/v1/budget', { headers: { 'x-api-key': typeof window !== 'undefined' ? localStorage.getItem('obrasaas_admin_key') || 'internal' : 'internal' } })
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleAddExpense = async () => {
        if (!newExpense.rubroId || !newExpense.monto) return;
        try {
            await fetch('/api/v1/budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('obrasaas_admin_key') || 'internal' },
                body: JSON.stringify({ rubroId: newExpense.rubroId, concepto: newExpense.concepto || 'Gasto', monto: parseFloat(newExpense.monto) })
            });
            // Reload
            const r = await fetch('/api/v1/budget', { headers: { 'x-api-key': localStorage.getItem('obrasaas_admin_key') || 'internal' } });
            setData(await r.json());
            setShowAddExpense(false);
            setNewExpense({ rubroId: '', concepto: '', monto: '' });
        } catch (e) { console.error(e); }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: tokens.colors.bg.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: `3px solid ${tokens.colors.border.subtle}`, borderTopColor: tokens.colors.accent.primary, borderRadius: '50%' }} />
            </div>
        );
    }

    const rubros = data?.rubros || [];
    const totalPres = data?.totalPresupuesto || 0;
    const totalEjec = data?.totalEjecutado || 0;
    const pctGlobal = data?.desvioGlobal || 0;
    const avanceFisico = data?.avanceFisico || 0;
    const curvaDiff = pctGlobal - avanceFisico;

    return (
        <div style={{ minHeight: '100vh', background: tokens.colors.bg.primary, fontFamily: tokens.font.sans, color: tokens.colors.text.primary }}>
            {/* Google Fonts */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');`}</style>

            <PageHeader
                icon="💰"
                title="Control de Costos"
                subtitle={`${data?.projectName || 'Obra'} — Presupuesto por Rubro con Curva S`}
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Costos' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <a href="/api/v1/export?type=budget" download="presupuesto_obrasaas.csv" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm">📥 Exportar ERP</Button>
                        </a>
                        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>↻ Actualizar</Button>
                        <Button variant="primary" size="sm" icon="+" onClick={() => setShowAddExpense(true)}>Registrar Gasto</Button>
                    </div>
                }
            />

            <main style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
                {/* KPI Row */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}
                >
                    <StatCard label="PRESUPUESTO TOTAL" value={`$${(totalPres/1000000).toFixed(1)}M`} sub="ARS" icon="📊" color={tokens.colors.accent.secondary} />
                    <StatCard label="EJECUTADO" value={`$${(totalEjec/1000000).toFixed(1)}M`} sub={`${pctGlobal}% del total`} icon="💸" color={tokens.colors.accent.warning} trend={pctGlobal > avanceFisico ? -Math.abs(curvaDiff) : Math.abs(curvaDiff)} />
                    <StatCard label="RESTANTE" value={`$${((totalPres-totalEjec)/1000000).toFixed(1)}M`} sub="Por ejecutar" icon="🏦" color={tokens.colors.accent.success} />
                    <StatCard label="CURVA S" value={`${curvaDiff > 0 ? '+' : ''}${curvaDiff.toFixed(1)}%`} sub={curvaDiff > 2 ? 'Sobrecosto detectado' : curvaDiff < -2 ? 'Sub-ejecución' : 'En línea'} icon="📉" color={Math.abs(curvaDiff) > 5 ? tokens.colors.accent.danger : tokens.colors.accent.success} />
                    <StatCard label="AVANCE FÍSICO" value={`${avanceFisico}%`} sub="Progreso de obra" icon="🏗️" color={tokens.colors.accent.info} />
                </motion.div>

                {/* Curva S Visual & CAC Inflation Simulator */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
                    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                        <GlassCard style={{ height: '100%' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📉 Análisis Curva S — Financiero vs Físico
                            </h3>
                            <ProgressBar value={pctGlobal} label="Avance Financiero" showLabel color={tokens.colors.accent.warning} height={10} />
                            <div style={{ height: '12px' }} />
                            <ProgressBar value={avanceFisico} label="Avance Físico" showLabel color={tokens.colors.accent.secondary} height={10} />
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: Math.abs(curvaDiff) > 5 ? tokens.colors.accent.danger : tokens.colors.accent.success }}>
                                    {curvaDiff > 0 ? '+' : ''}{curvaDiff.toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '0.75rem', color: tokens.colors.text.muted, marginTop: '2px' }}>
                                    {curvaDiff > 5 ? '🚨 Desvío significativo — revisar rubros' : curvaDiff > 2 ? '⚠️ Desvío menor — monitorear' : '✅ Obra en línea presupuestaria'}
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>

                    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                        <GlassCard style={{ height: '100%', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🏛️ Simulador CAC & Estrategia de Acopio
                                </h3>
                                <Badge color="#f59e0b" variant="filled" size="sm">CAC +4.2% / Mes</Badge>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, margin: '0 0 12px', lineHeight: 1.4 }}>
                                Proyección de ahorro al acopiar hierro (Acindar) y cemento (Loma Negra) por adelantado frente a la inflación de materiales.
                            </p>
                            <div style={{ background: 'rgba(6, 9, 19, 0.7)', borderRadius: '10px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                                <div>
                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Costo Proyectado a 6 Meses:</span>
                                    <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>+27.8% s/ Insumos</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Ahorro con Acopio Inmediato:</span>
                                    <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>$4.850.000 ARS</strong>
                                </div>
                            </div>
                            <div style={{ marginTop: '12px', textAlign: 'right' }}>
                                <Link href="/marketplace" style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>
                                    Explorar Corralones & Acopios en Marketplace →
                                </Link>
                            </div>
                        </GlassCard>
                    </motion.div>
                </div>

                {/* Rubros Grid */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: tokens.colors.text.secondary }}>📋 Desglose por Rubro</h3>
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}
                >
                    {rubros.map((r, i) => {
                        const pct = r.presupuesto > 0 ? (r.ejecutado / r.presupuesto * 100) : 0;
                        const statusColor = pct >= 100 ? tokens.colors.accent.danger : pct >= 80 ? tokens.colors.accent.warning : tokens.colors.accent.success;
                        const statusIcon = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
                        const isSelected = selectedRubro === r.id;

                        return (
                            <motion.div
                                key={r.id}
                                variants={staggerItem}
                                layout
                                onClick={() => setSelectedRubro(isSelected ? null : r.id)}
                                whileHover={{ y: -2 }}
                                style={{
                                    background: isSelected ? tokens.colors.bg.elevated : tokens.colors.bg.card,
                                    border: `1px solid ${isSelected ? statusColor + '44' : tokens.colors.border.subtle}`,
                                    borderRadius: tokens.radius.lg,
                                    padding: '20px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Top accent */}
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${statusColor}, transparent)` }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '2px' }}>{statusIcon} {r.nombre.split('(')[0].trim()}</div>
                                        <div style={{ fontSize: '0.7rem', color: tokens.colors.text.muted }}>{r.nombre.match(/\(([^)]+)\)/)?.[1] || ''}</div>
                                    </div>
                                    <Badge color={statusColor} variant="filled" size="sm">
                                        {pct.toFixed(0)}%
                                    </Badge>
                                </div>

                                <ProgressBar value={pct} color={statusColor} height={6} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.8rem' }}>
                                    <div>
                                        <div style={{ color: tokens.colors.text.muted, fontSize: '0.65rem' }}>Ejecutado</div>
                                        <div style={{ fontWeight: 700, color: tokens.colors.text.primary }}>${r.ejecutado.toLocaleString('es-AR')}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: tokens.colors.text.muted, fontSize: '0.65rem' }}>Presupuesto</div>
                                        <div style={{ fontWeight: 600, color: tokens.colors.text.secondary }}>${r.presupuesto.toLocaleString('es-AR')}</div>
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                <AnimatePresence>
                                    {isSelected && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            style={{ overflow: 'hidden', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border.subtle}`, paddingTop: '12px' }}
                                        >
                                            <div style={{ fontSize: '0.75rem', color: tokens.colors.text.muted, marginBottom: '8px' }}>Últimos movimientos:</div>
                                            {(r.movimientos || []).slice(-3).map((m, j) => (
                                                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '4px 0', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
                                                    <span style={{ color: tokens.colors.text.secondary }}>{m.concepto}</span>
                                                    <span style={{ color: tokens.colors.accent.warning, fontWeight: 600 }}>${m.monto?.toLocaleString('es-AR')}</span>
                                                </div>
                                            ))}
                                            {(!r.movimientos || r.movimientos.length === 0) && (
                                                <div style={{ fontSize: '0.75rem', color: tokens.colors.text.muted, fontStyle: 'italic' }}>Sin movimientos registrados</div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </main>

            {/* Add Expense Modal */}
            <AnimatePresence>
                {showAddExpense && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddExpense(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{ background: tokens.colors.bg.card, borderRadius: tokens.radius.xl, padding: '32px', width: '90%', maxWidth: '480px', border: `1px solid ${tokens.colors.border.default}` }}
                        >
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                💸 Registrar Gasto
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <select
                                    value={newExpense.rubroId}
                                    onChange={e => setNewExpense(p => ({ ...p, rubroId: e.target.value }))}
                                    style={{ padding: '12px', background: tokens.colors.bg.primary, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, fontSize: '0.9rem' }}
                                >
                                    <option value="">Seleccionar rubro...</option>
                                    {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre.split('(')[0].trim()}</option>)}
                                </select>
                                <input
                                    type="text"
                                    placeholder="Concepto (ej: Cemento Portland x50)"
                                    value={newExpense.concepto}
                                    onChange={e => setNewExpense(p => ({ ...p, concepto: e.target.value }))}
                                    style={{ padding: '12px', background: tokens.colors.bg.primary, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, fontSize: '0.9rem' }}
                                />
                                <input
                                    type="number"
                                    placeholder="Monto en ARS"
                                    value={newExpense.monto}
                                    onChange={e => setNewExpense(p => ({ ...p, monto: e.target.value }))}
                                    style={{ padding: '12px', background: tokens.colors.bg.primary, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.md, color: tokens.colors.text.primary, fontSize: '0.9rem' }}
                                />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <Button variant="secondary" style={{ flex: 1 }} onClick={() => setShowAddExpense(false)}>Cancelar</Button>
                                    <Button variant="primary" style={{ flex: 1 }} onClick={handleAddExpense}>Registrar</Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
