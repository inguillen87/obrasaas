"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, Tabs, Modal, PageHeader } from '@/lib/design-system';

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('overview');
    const [showNewTenant, setShowNewTenant] = useState(false);
    const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'starter', ownerEmail: '', ownerPhone: '' });
    const [creating, setCreating] = useState(false);
    const [authKey, setAuthKey] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('obrasaas_admin_key');
        if (savedKey) {
            setAuthKey(savedKey);
            setIsAuthenticated(true);
            loadData(savedKey);
        } else {
            setLoading(false);
        }
    }, []);

    const loadData = async (key) => {
        try {
            const headers = { 'x-api-key': key || authKey };
            const [statsRes, tenantsRes] = await Promise.all([
                fetch('/api/admin/stats', { headers }),
                fetch('/api/admin/tenants', { headers })
            ]);
            
            if (!statsRes.ok || !tenantsRes.ok) {
                setIsAuthenticated(false);
                localStorage.removeItem('obrasaas_admin_key');
                setLoading(false);
                return;
            }

            const statsData = await statsRes.json();
            const tenantsData = await tenantsRes.json();
            setStats(statsData);
            setTenants(tenantsData.tenants || []);
        } catch (err) {
            console.error('Failed to load admin data:', err);
        }
        setLoading(false);
    };

    const handleLogin = () => {
        if (authKey.length > 3) {
            localStorage.setItem('obrasaas_admin_key', authKey);
            setIsAuthenticated(true);
            setLoading(true);
            loadData(authKey);
        }
    };

    const handleCreateTenant = async () => {
        if (!newTenant.name || !newTenant.slug) return;
        setCreating(true);
        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': authKey },
                body: JSON.stringify(newTenant)
            });
            if (res.ok) {
                setShowNewTenant(false);
                setNewTenant({ name: '', slug: '', plan: 'starter', ownerEmail: '', ownerPhone: '' });
                loadData(authKey);
            }
        } catch (err) { console.error(err); }
        setCreating(false);
    };

    if (!isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tokens.font.sans, padding: '20px' }}>
                <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ maxWidth: '440px', width: '100%' }}>
                    <GlassCard style={{ padding: '40px 32px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }} glow>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#060913', fontWeight: 900, fontSize: '1.4rem' }}>
                            ⚙️
                        </div>
                        <h1 style={{ color: '#f8fafc', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px', fontFamily: tokens.font.heading }}>
                            Super Admin Console
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 24px' }}>
                            Acceso restringido para administradores de la plataforma ObraSaaS
                        </p>

                        <input
                            type="password"
                            placeholder="Ingrese API Key de administración"
                            value={authKey}
                            onChange={e => setAuthKey(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: '#060913',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '12px',
                                color: '#f8fafc',
                                fontSize: '0.92rem',
                                marginBottom: '16px',
                                outline: 'none'
                            }}
                        />
                        <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={handleLogin}>
                            Desbloquear Panel Central →
                        </Button>
                    </GlassCard>
                </motion.div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Vista General', icon: '📊' },
        { id: 'tenants', label: 'Tenants', icon: '🏢', badge: tenants.length },
        { id: 'billing', label: 'Facturación & MRR', icon: '💰' },
        { id: 'audit', label: 'Auditoría & Seguridad', icon: '🔐' }
    ];

    const planBadgeColor = { starter: '#10b981', professional: '#3b82f6', enterprise: '#8b5cf6' };

    return (
        <div style={{ minHeight: '100vh', background: '#060913', fontFamily: tokens.font.sans, color: '#f8fafc' }}>
            
            {/* Header */}
            <PageHeader
                title="Super Admin Platform Console"
                subtitle="Gestión multitenant, monitoreo de infraestructura y métricas de negocio"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'SuperAdmin' }]}
                actions={
                    <>
                        <Button variant="secondary" size="sm" onClick={() => loadData(authKey)}>↻ Recargar</Button>
                        <Button variant="primary" size="sm" icon="+" onClick={() => setShowNewTenant(true)}>Nuevo Tenant</Button>
                        <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem('obrasaas_admin_key'); setIsAuthenticated(false); }}>
                            Cerrar Sesión
                        </Button>
                    </>
                }
            />

            {/* Navigation Tabs */}
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px 0' }}>
                <Tabs tabs={tabs} activeTab={activeView} onChange={setActiveView} color="#f59e0b" />
            </div>

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px 80px' }}>
                
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', margin: '0 auto 16px' }} />
                        Cargando telemetría de plataforma...
                    </div>
                ) : activeView === 'overview' ? (
                    
                    /* ============ OVERVIEW ============ */
                    <div>
                        {/* KPI Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                            <StatCard label="TENANTS ACTIVOS" value={stats?.platform?.totalTenants || 0} sub="Empresas suscritas" icon="🏢" color="#3b82f6" />
                            <StatCard label="OBRAS EN CURSO" value={stats?.platform?.totalProjects || 0} sub="Proyectos gestionados" icon="🏗️" color="#f59e0b" />
                            <StatCard label="OPERARIOS TOTALES" value={stats?.platform?.totalWorkers || 0} sub="Nómina en base" icon="👷" color="#10b981" />
                            <StatCard label="MRR ESTIMADO" value={`$${stats?.platform?.mrr || 0} USD`} sub="Ingreso mensual" icon="💰" color="#22c55e" trend={14} />
                            <StatCard label="ARR PROYECTADO" value={`$${stats?.platform?.arr || 0} USD`} sub="Anualizado" icon="📈" color="#06b6d4" />
                            <StatCard label="BLOQUES SHA-256" value={stats?.platform?.auditBlocks || 0} sub="Ledger inmutable" icon="🔐" color="#8b5cf6" />
                        </div>

                        {/* Summary Split */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            
                            {/* Incidents Breakdown */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                                    🚨 Estado Global de Incidencias
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>{stats?.incidents?.critical || 0}</div>
                                        <div style={{ fontSize: '0.74rem', color: '#fca5a5', fontWeight: 600 }}>Críticas</div>
                                    </div>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b' }}>{stats?.incidents?.warning || 0}</div>
                                        <div style={{ fontSize: '0.74rem', color: '#fcd34d', fontWeight: 600 }}>Alertas</div>
                                    </div>
                                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.3)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6' }}>{stats?.incidents?.info || 0}</div>
                                        <div style={{ fontSize: '0.74rem', color: '#93c5fd', fontWeight: 600 }}>Informativas</div>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Worker KYC Status */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                                    🪪 Estado de Compliance de Operarios
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>{stats?.platform?.activeWorkers || 0}</div>
                                        <div style={{ fontSize: '0.74rem', color: '#86efac', fontWeight: 600 }}>Activos KYC</div>
                                    </div>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b' }}>{stats?.platform?.pendingWorkers || 0}</div>
                                        <div style={{ fontSize: '0.74rem', color: '#fcd34d', fontWeight: 600 }}>Pendientes</div>
                                    </div>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>{stats?.platform?.blockedWorkers || 0}</div>
                                        <div style={{ fontSize: '0.74rem', color: '#fca5a5', fontWeight: 600 }}>Bloqueados</div>
                                    </div>
                                </div>
                            </GlassCard>

                        </div>
                    </div>

                ) : activeView === 'tenants' ? (

                    /* ============ TENANTS LIST ============ */
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                    🏢 Empresas & Sub-Organizaciones Registradas
                                </h2>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Gestión de subdominios, aislamiento y planes</p>
                            </div>
                            <Button variant="primary" size="sm" icon="+" onClick={() => setShowNewTenant(true)}>
                                Crear Nuevo Tenant
                            </Button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tenants.map((t, idx) => (
                                <GlassCard key={idx} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>{t.name}</span>
                                            <Badge color={planBadgeColor[t.plan] || '#f59e0b'} variant="filled" size="xs">
                                                {t.plan?.toUpperCase()}
                                            </Badge>
                                            <span style={{ fontSize: '0.72rem', color: t.status === 'active' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                ● {t.status}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: tokens.font.mono }}>
                                            {t.slug}.obrasaas.app • 👤 {t.ownerEmail || 'Sin email'} • 📅 Creado: {new Date(t.createdAt).toLocaleDateString('es-AR')}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{t.projectCount}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Obras</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{t.workerCount}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Personal</div>
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={() => window.open(`https://${t.slug}.obrasaas.app/dashboard`, '_blank')}>
                                            Ingresar ↗
                                        </Button>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    </div>

                ) : (

                    /* ============ BILLING & REVENUE ============ */
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
                            <GlassCard style={{ padding: '32px', textAlign: 'center' }} glow>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>MRR (Monthly Recurring Revenue)</div>
                                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#10b981', fontFamily: tokens.font.heading }}>
                                    ${stats?.platform?.mrr || 29}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>USD / mes en suscripciones activas</div>
                            </GlassCard>

                            <GlassCard style={{ padding: '32px', textAlign: 'center' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>ARR (Annual Run Rate)</div>
                                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#3b82f6', fontFamily: tokens.font.heading }}>
                                    ${stats?.platform?.arr || 348}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>USD / año proyectado</div>
                            </GlassCard>
                        </div>
                    </div>
                )}

                {/* ============ AUDIT & SECURITY LOG ============ */}
                {activeView === 'audit' && (
                    <div>
                        <GlassCard style={{ padding: '28px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                        🔐 Registro de Auditoría de Seguridad
                                    </h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Eventos de acceso, modificaciones y alertas de seguridad de la plataforma</p>
                                </div>
                                <Badge color="#8b5cf6" variant="filled" size="sm">Últimas 24hs</Badge>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { ts: '21:04:12', ip: '190.210.45.112', user: 'admin@obrasaas.com', action: 'LOGIN_SUCCESS', detail: 'Autenticación API Key exitosa desde panel SuperAdmin', level: 'info' },
                                    { ts: '20:58:33', ip: '181.47.200.85', user: 'marcelo@constructoradelplata.com', action: 'TENANT_SWITCH', detail: 'Cambió de Constructora del Plata a Desarrolladora Urbana S.A.', level: 'info' },
                                    { ts: '20:45:07', ip: '190.210.45.112', user: 'admin@obrasaas.com', action: 'TENANT_CREATE', detail: 'Nuevo tenant creado: Innovar Latam Obras S.R.L. (plan: enterprise)', level: 'warning' },
                                    { ts: '20:31:19', ip: '200.42.128.30', user: 'victoria@estudio-arq.com', action: 'CERT_SIGN', detail: 'Firma digital SHA-256 de Certificado de Avance #CA-2026-0042', level: 'success' },
                                    { ts: '19:55:41', ip: '181.47.200.85', user: 'marcelo@constructoradelplata.com', action: 'EXPORT_DATA', detail: 'Exportación CSV de gastos ejecutados para Tango Gestión ERP', level: 'info' },
                                    { ts: '19:12:08', ip: '45.187.64.20', user: 'unknown', action: 'AUTH_FAILED', detail: 'Intento de acceso con API Key inválida (3 intentos consecutivos)', level: 'danger' },
                                    { ts: '18:40:55', ip: '190.210.45.112', user: 'admin@obrasaas.com', action: 'IMPERSONATE', detail: 'Impersonación activada: admin → marcelo@constructoradelplata.com', level: 'warning' },
                                    { ts: '17:22:13', ip: '200.42.128.30', user: 'victoria@estudio-arq.com', action: 'LIBRO_OBRA_ENTRY', detail: 'Asiento firmado en Libro de Obra Digital (Ley 22.250) #2026-08-15-003', level: 'success' },
                                    { ts: '16:05:44', ip: '190.210.45.112', user: 'sistema', action: 'CRON_DAILY', detail: 'Resumen diario WhatsApp enviado a 3 directores de obra activos', level: 'info' },
                                    { ts: '14:38:29', ip: '181.47.200.85', user: 'juan.gomez@obra.com', action: 'KYC_COMPLETE', detail: 'Validación biométrica completada: DNI 32.456.789 + Selfie facial', level: 'success' }
                                ].map((log, i) => {
                                    const levelColors = { info: '#3b82f6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
                                    const levelLabels = { info: 'INFO', success: 'OK', warning: 'WARN', danger: 'ALERTA' };
                                    return (
                                        <div key={i} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '70px 80px 1fr 200px 120px',
                                            gap: '12px',
                                            alignItems: 'center',
                                            padding: '10px 14px',
                                            background: log.level === 'danger' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(15, 23, 42, 0.5)',
                                            borderRadius: '8px',
                                            border: `1px solid ${log.level === 'danger' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.04)'}`,
                                            fontSize: '0.78rem'
                                        }}>
                                            <span style={{ color: '#64748b', fontFamily: tokens.font.mono, fontSize: '0.72rem' }}>{log.ts}</span>
                                            <Badge color={levelColors[log.level]} variant="filled" size="xs">{levelLabels[log.level]}</Badge>
                                            <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail}</span>
                                            <span style={{ color: '#94a3b8', fontFamily: tokens.font.mono, fontSize: '0.7rem' }}>{log.user}</span>
                                            <span style={{ color: '#475569', fontFamily: tokens.font.mono, fontSize: '0.68rem', textAlign: 'right' }}>{log.ip}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>

                        {/* Security Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            <StatCard label="ACCESOS EXITOSOS" value="47" sub="Últimas 24 horas" icon="✅" color="#10b981" />
                            <StatCard label="INTENTOS FALLIDOS" value="3" sub="Bloqueados por IP" icon="🚫" color="#ef4444" />
                            <StatCard label="FIRMAS DIGITALES" value="12" sub="SHA-256 verificadas" icon="🔐" color="#8b5cf6" />
                            <StatCard label="EXPORTACIONES" value="8" sub="CSV / PDF generados" icon="📤" color="#06b6d4" />
                        </div>
                    </div>
                )}

            </main>

            {/* Create Tenant Modal */}
            <Modal
                isOpen={showNewTenant}
                onClose={() => setShowNewTenant(false)}
                title="Aprovisionar Nuevo Tenant"
                subtitle="Crear una nueva instancia aislada para una constructora"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Razón Social / Empresa *</label>
                        <input
                            placeholder="Constructora ABC S.A."
                            value={newTenant.name}
                            onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Subdominio Slug *</label>
                        <input
                            placeholder="constructora-abc"
                            value={newTenant.slug}
                            onChange={e => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email del Dueño *</label>
                        <input
                            type="email"
                            placeholder="dueno@constructora.com"
                            value={newTenant.ownerEmail}
                            onChange={e => setNewTenant({ ...newTenant, ownerEmail: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Plan Asignado</label>
                        <select
                            value={newTenant.plan}
                            onChange={e => setNewTenant({ ...newTenant, plan: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        >
                            <option value="starter">🟢 Starter ($29/mes)</option>
                            <option value="professional">🔵 Professional ($99/mes)</option>
                            <option value="enterprise">🟣 Enterprise ($199/mes)</option>
                        </select>
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        style={{ width: '100%', marginTop: '6px' }}
                        loading={creating}
                        onClick={handleCreateTenant}
                    >
                        {creating ? 'Creando...' : 'Confirmar y Aprovisionar Tenant'}
                    </Button>
                </div>
            </Modal>

        </div>
    );
}
