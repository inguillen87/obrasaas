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
    
    // New Super-features State
    const [activeTab, setActiveTab] = useState('rubros'); // 'rubros' | 'adicionales' | 'remitos'
    const [changeOrders, setChangeOrders] = useState([]);
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [newOrderForm, setNewOrderForm] = useState({
        title: '',
        description: '',
        rubroCode: 'Instalaciones & Terminaciones',
        laborAmountARS: '',
        materialAmountARS: '',
        scheduleImpactDays: 2,
        cacBaseIndex: 128.2
    });

    useEffect(() => {
        Promise.all([
            fetch('/api/v1/budget', { headers: { 'x-api-key': typeof window !== 'undefined' ? localStorage.getItem('obrasaas_admin_key') || 'internal' : 'internal' } }).then(r => r.json()),
            fetch('/api/v1/adicionales').then(r => r.json()).catch(() => ({ changeOrders: [] }))
        ]).then(([budgetData, adicionalesData]) => {
            setData(budgetData);
            if (adicionalesData.changeOrders) setChangeOrders(adicionalesData.changeOrders);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleCreateChangeOrder = async (e) => {
        e.preventDefault();
        if (!newOrderForm.title) return;
        try {
            const res = await fetch('/api/v1/adicionales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrderForm)
            });
            const d = await res.json();
            if (d.changeOrder) {
                setChangeOrders([d.changeOrder, ...changeOrders]);
                setShowNewOrderModal(false);
                setNewOrderForm({
                    title: '',
                    description: '',
                    rubroCode: 'Instalaciones & Terminaciones',
                    laborAmountARS: '',
                    materialAmountARS: '',
                    scheduleImpactDays: 2,
                    cacBaseIndex: 128.2
                });
            }
        } catch (err) { console.error(err); }
    };

    const handleApproveChangeOrder = async (orderId) => {
        try {
            const res = await fetch('/api/v1/adicionales', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, status: 'APROBADA', clientSignature: 'Ing. Lucas Varela (Comitente)' })
            });
            const d = await res.json();
            if (d.changeOrder) {
                setChangeOrders(changeOrders.map(o => o.id === orderId ? d.changeOrder : o));
            }
        } catch (err) { console.error(err); }
    };

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
                title="Control de Costos & Adicionales de Obra"
                subtitle={`${data?.projectName || 'Obra'} — Presupuesto por Rubro, Redeterminación CAC y Adicionales`}
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Costos' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <a href="/api/v1/export?type=budget" download="presupuesto_obrasaas.csv" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm">📥 Exportar ERP</Button>
                        </a>
                        <Button variant="secondary" size="sm" onClick={() => setShowNewOrderModal(true)} icon="+">
                            Nueva Orden de Cambio
                        </Button>
                        <Button variant="primary" size="sm" icon="+" onClick={() => setShowAddExpense(true)}>
                            Registrar Gasto
                        </Button>
                    </div>
                }
            />

            <main style={{ padding: '20px clamp(14px, 4vw, 32px) 80px', maxWidth: '1440px', margin: '0 auto' }}>
                
                {/* Mode Selector Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveTab('rubros')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            background: activeTab === 'rubros' ? '#f59e0b' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'rubros' ? '#060913' : '#94a3b8',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        📊 Rubros & Curva S
                    </button>
                    <button
                        onClick={() => setActiveTab('adicionales')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            background: activeTab === 'adicionales' ? '#f59e0b' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'adicionales' ? '#060913' : '#94a3b8',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        📑 Adicionales & Change Orders (CAC)
                        <Badge color="#10b981" variant="filled" size="xs">{changeOrders.length}</Badge>
                    </button>
                    <button
                        onClick={() => setActiveTab('remitos')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            background: activeTab === 'remitos' ? '#f59e0b' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'remitos' ? '#060913' : '#94a3b8',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        🧾 Remitos & Acopios Fiscales (AFIP)
                    </button>
                </div>

                {/* KPI Row */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}
                >
                    <StatCard label="PRESUPUESTO TOTAL" value={`$${(totalPres/1000000).toFixed(1)}M`} sub="ARS Base" icon="📊" color={tokens.colors.accent.secondary} />
                    <StatCard label="EJECUTADO" value={`$${(totalEjec/1000000).toFixed(1)}M`} sub={`${pctGlobal}% del total`} icon="💸" color={tokens.colors.accent.warning} trend={pctGlobal > avanceFisico ? -Math.abs(curvaDiff) : Math.abs(curvaDiff)} />
                    <StatCard label="ADICIONALES APROBADOS" value={`+$${((changeOrders.filter(o => o.status === 'APROBADA').reduce((s,o) => s + (o.totalAmountARS||0), 0))/1000000).toFixed(2)}M`} sub="Ampliación aprobada" icon="📑" color={tokens.colors.accent.success} />
                    <StatCard label="CURVA S" value={`${curvaDiff > 0 ? '+' : ''}${curvaDiff.toFixed(1)}%`} sub={curvaDiff > 2 ? 'Sobrecosto detectado' : curvaDiff < -2 ? 'Sub-ejecución' : 'En línea'} icon="📉" color={Math.abs(curvaDiff) > 5 ? tokens.colors.accent.danger : tokens.colors.accent.success} />
                    <StatCard label="AVANCE FÍSICO" value={`${avanceFisico}%`} sub="Progreso de obra" icon="🏗️" color={tokens.colors.accent.info} />
                </motion.div>

                {/* TAB 1: RUBROS & CURVA S */}
                {activeTab === 'rubros' && (
                    <>
                        {/* Curva S Visual & CAC Inflation Simulator */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px', marginBottom: '28px' }}>
                            <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                                <GlassCard style={{ height: '100%' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Análisis Curva S — Financiero vs Físico
                                    </h3>
                                    <ProgressBar value={pctGlobal} label="Avance Financiero" showLabel color={tokens.colors.accent.warning} height={10} />
                                    <div style={{ height: '12px' }} />
                                    <ProgressBar value={avanceFisico} label="Avance Físico" showLabel color={tokens.colors.accent.secondary} height={10} />
                                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                        <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 900, color: Math.abs(curvaDiff) > 5 ? tokens.colors.accent.danger : tokens.colors.accent.success }}>
                                            {curvaDiff > 0 ? '+' : ''}{curvaDiff.toFixed(1)}%
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: tokens.colors.text.muted, marginTop: '2px' }}>
                                            {curvaDiff > 5 ? 'Desvío significativo — revisar rubros' : curvaDiff > 2 ? 'Desvío menor — monitorear' : 'Obra en línea presupuestaria'}
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>

                            <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                                <GlassCard style={{ height: '100%', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Simulador CAC & Estrategia de Acopio
                                        </h3>
                                        <Badge color="#f59e0b" variant="filled" size="sm">CAC +4.2% / Mes</Badge>
                                    </div>
                                    <p style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, margin: '0 0 12px', lineHeight: 1.4 }}>
                                        Proyección de ahorro al acopiar hierro (Acindar) y cemento (Loma Negra) por adelantado frente a la inflación de materiales.
                                    </p>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.7)', borderRadius: '10px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
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
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: tokens.colors.text.secondary }}>Desglose por rubro</h3>
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '12px' }}
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>{statusIcon}</span>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.nombre.split('(')[0].trim()}</div>
                                            </div>
                                            <Badge color={statusColor} variant="filled" size="xs">{pct.toFixed(0)}%</Badge>
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
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </>
                )}

                {/* TAB 2: ADICIONALES & CHANGE ORDERS */}
                {activeTab === 'adicionales' && (
                    <GlassCard style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    📑 Adicionales & Change Orders (Ajustadas por CAC)
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                    Control formal de modificaciones solicitadas por el cliente, impacto en Gantt y redeterminación por inflación
                                </p>
                            </div>
                            <Button variant="primary" size="sm" icon="+" onClick={() => setShowNewOrderModal(true)}>
                                Crear Orden de Cambio
                            </Button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {changeOrders.map(co => (
                                <div
                                    key={co.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.7)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                                        gap: '16px',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <Badge color={co.status === 'APROBADA' ? '#10b981' : '#f59e0b'} variant="filled" size="xs">
                                                ORDEN #{co.orderNumber} • {co.status.replace('_', ' ')}
                                            </Badge>
                                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Rubro: {co.rubroCode}</span>
                                        </div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                                            {co.title}
                                        </h4>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
                                            {co.description}
                                        </p>
                                        {co.clientSignature && (
                                            <div style={{ fontSize: '0.74rem', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
                                                ✓ Firmado digitalmente por: {co.clientSignature}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Mano de Obra:</span>
                                            <strong style={{ color: '#f8fafc' }}>${(co.laborAmountARS || 0).toLocaleString('es-AR')} ARS</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Materiales:</span>
                                            <strong style={{ color: '#f8fafc' }}>${(co.materialAmountARS || 0).toLocaleString('es-AR')} ARS</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>Total Adicional:</span>
                                            <strong style={{ color: '#f59e0b' }}>${(co.totalAmountARS || 0).toLocaleString('es-AR')} ARS (~USD {co.totalAmountUSD || Math.round(co.totalAmountARS / 1300)})</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#38bdf8' }}>
                                            <span>Impacto en Plazo Gantt:</span>
                                            <strong>+{co.scheduleImpactDays || 0} Días de Obra</strong>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                                        {co.status === 'PENDIENTE_CLIENTE' ? (
                                            <>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    icon="✍️"
                                                    onClick={() => handleApproveChangeOrder(co.id)}
                                                >
                                                    Aprobar & Firmar Digitalmente
                                                </Button>
                                                <Button
                                                    variant="whatsapp"
                                                    size="sm"
                                                    icon="💬"
                                                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`📑 *ORDEN DE CAMBIO #${co.orderNumber}: ${co.title}*\n• Monto Total: $${(co.totalAmountARS||0).toLocaleString('es-AR')} ARS\n• Impacto en Plazo: +${co.scheduleImpactDays} días\n• Rubro: ${co.rubroCode}\n\nPor favor ingrese al portal de cliente para firmar la aprobación.`)}`)}
                                                >
                                                    Despachar a Comitente vía WhatsApp
                                                </Button>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.8rem', fontWeight: 700 }}>
                                                🛡️ Orden Aprobada & Computada en Curva S
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                )}

                {/* TAB 3: REMITOS & ACOPIOS FISCALES */}
                {activeTab === 'remitos' && (
                    <GlassCard style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    🧾 Remitos & Control de Acopios Fiscales (AFIP / ARCA Módulo 11)
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                    Validación de comprobantes, CUIT fiscal de corralones y acreditación automática en pañol de obra
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px' }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <Badge color="#10b981" variant="filled" size="xs">AFIP CUIT VÁLIDO (MÓDULO 11)</Badge>
                                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>17/08/2026</span>
                                </div>
                                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>Ferretería & Corralón Palermo Soho</h4>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
                                    <div>CUIT: <strong style={{ color: '#f8fafc' }}>30-71829340-9</strong></div>
                                    <div>Comprobante: <strong style={{ color: '#f8fafc' }}>REM-0004-00019283</strong></div>
                                    <div>Monto Total: <strong style={{ color: '#10b981' }}>$18.500 ARS</strong></div>
                                </div>
                                <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '10px', borderRadius: '8px', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '12px' }}>
                                    <div>• 2 kg Clavos punta París 2 1/2</div>
                                    <div>• 2.5 kg Alambre de fardo recocido #16</div>
                                </div>
                                <Button variant="secondary" size="sm" style={{ width: '100%' }} icon="📦">
                                    Acreditado en Pañol (Stock Actualizado)
                                </Button>
                            </div>

                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <Badge color="#10b981" variant="filled" size="xs">AFIP CUIT VÁLIDO (MÓDULO 11)</Badge>
                                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>16/08/2026</span>
                                </div>
                                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>Cantera & Corralón Central</h4>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
                                    <div>CUIT: <strong style={{ color: '#f8fafc' }}>33-65920194-9</strong></div>
                                    <div>Comprobante: <strong style={{ color: '#f8fafc' }}>FACT-A-0002-00448190</strong></div>
                                    <div>Monto Total: <strong style={{ color: '#10b981' }}>$47.000 ARS</strong></div>
                                </div>
                                <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '10px', borderRadius: '8px', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '12px' }}>
                                    <div>• 1 Flete de emergencia arena fina x 3m³</div>
                                    <div>• 10 Bolsas Cemento Loma Negra CPC-40</div>
                                </div>
                                <Button variant="secondary" size="sm" style={{ width: '100%' }} icon="📦">
                                    Acreditado en Pañol (Stock Actualizado)
                                </Button>
                            </div>
                        </div>
                    </GlassCard>
                )}

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
                                Registrar gasto de obra
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

            {/* Create Change Order Modal */}
            <AnimatePresence>
                {showNewOrderModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNewOrderModal(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#0a0f1d', borderRadius: tokens.radius.xl, padding: '32px', width: '90%', maxWidth: '520px', border: '1px solid rgba(255,255,255,0.15)' }}
                        >
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📑 Nueva Orden de Cambio / Adicional de Obra
                            </h2>
                            <form onSubmit={handleCreateChangeOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Título del Adicional *</label>
                                    <input
                                        required
                                        placeholder="Ej: Cambio de piso por Porcelanato Ilva 60x120"
                                        value={newOrderForm.title}
                                        onChange={e => setNewOrderForm({ ...newOrderForm, title: e.target.value })}
                                        style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Descripción & Justificación Técnica</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Detalle técnico y justificación de la modificación..."
                                        value={newOrderForm.description}
                                        onChange={e => setNewOrderForm({ ...newOrderForm, description: e.target.value })}
                                        style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc', resize: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Mano de Obra (ARS)</label>
                                        <input
                                            type="number"
                                            placeholder="Ej: 350000"
                                            value={newOrderForm.laborAmountARS}
                                            onChange={e => setNewOrderForm({ ...newOrderForm, laborAmountARS: e.target.value })}
                                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Materiales (ARS)</label>
                                        <input
                                            type="number"
                                            placeholder="Ej: 650000"
                                            value={newOrderForm.materialAmountARS}
                                            onChange={e => setNewOrderForm({ ...newOrderForm, materialAmountARS: e.target.value })}
                                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Impacto en Plazo (+Días)</label>
                                        <input
                                            type="number"
                                            value={newOrderForm.scheduleImpactDays}
                                            onChange={e => setNewOrderForm({ ...newOrderForm, scheduleImpactDays: e.target.value })}
                                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Índice Base CAC</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={newOrderForm.cacBaseIndex}
                                            onChange={e => setNewOrderForm({ ...newOrderForm, cacBaseIndex: e.target.value })}
                                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <Button variant="secondary" style={{ flex: 1 }} onClick={() => setShowNewOrderModal(false)}>Cancelar</Button>
                                    <Button variant="primary" style={{ flex: 1 }} type="submit">Generar Orden de Cambio</Button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
