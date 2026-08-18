"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

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
                loadData();
            }
        } catch (err) { console.error(err); }
        setCreating(false);
    };

    // Auth gate
    if (!isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ background: '#1e293b', borderRadius: '16px', padding: '48px', maxWidth: '420px', width: '100%', border: '1px solid #334155' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <span style={{ fontSize: '2.5rem' }}>🏗️</span>
                        <h1 style={{ color: '#f8fafc', fontSize: '1.5rem', margin: '12px 0 4px' }}>ObraSaaS Super Admin</h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Panel de administración de la plataforma</p>
                    </div>
                    <input
                        type="password"
                        placeholder="API Key de administración"
                        value={authKey}
                        onChange={e => setAuthKey(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        style={{ width: '100%', padding: '14px 16px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f8fafc', fontSize: '0.95rem', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button onClick={handleLogin} style={{ width: '100%', padding: '14px', background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
                        Ingresar al Panel
                    </button>
                </div>
            </div>
        );
    }

    const planBadge = (plan) => {
        const colors = { starter: '#22c55e', professional: '#3b82f6', enterprise: '#a855f7' };
        return <span style={{ background: colors[plan] || '#64748b', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{plan}</span>;
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            {/* Header */}
            <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🏗️</span>
                    <div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>ObraSaaS</h1>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Super Admin Console</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Link href="/dashboard" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>
                        ← Dashboard
                    </Link>
                    <button onClick={() => { localStorage.removeItem('obrasaas_admin_key'); setIsAuthenticated(false); }} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Cerrar Sesión
                    </button>
                </div>
            </header>

            {/* Navigation */}
            <nav style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0 32px', display: 'flex', gap: '4px' }}>
                {[
                    { id: 'overview', label: '📊 Vista General', icon: '' },
                    { id: 'tenants', label: '🏢 Tenants', icon: '' },
                    { id: 'workers', label: '👷 Operarios', icon: '' },
                    { id: 'billing', label: '💰 Facturación', icon: '' },
                    { id: 'audit', label: '🔐 Auditoría', icon: '' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveView(tab.id)} style={{
                        padding: '12px 20px', background: activeView === tab.id ? '#f59e0b' : 'transparent',
                        color: activeView === tab.id ? '#0f172a' : '#94a3b8', border: 'none',
                        borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.85rem', fontWeight: activeView === tab.id ? 700 : 500
                    }}>
                        {tab.label}
                    </button>
                ))}
            </nav>

            <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
                        Cargando datos de la plataforma...
                    </div>
                ) : activeView === 'overview' ? (
                    /* ============ OVERVIEW ============ */
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '24px' }}>📊 Vista General de la Plataforma</h2>
                        
                        {/* KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            {[
                                { label: 'Tenants Activos', value: stats?.platform?.totalTenants || 0, icon: '🏢', color: '#3b82f6' },
                                { label: 'Obras en Curso', value: stats?.platform?.totalProjects || 0, icon: '🏗️', color: '#f59e0b' },
                                { label: 'Operarios Totales', value: stats?.platform?.totalWorkers || 0, icon: '👷', color: '#22c55e' },
                                { label: 'KYC Verificados', value: stats?.platform?.kycVerifications || 0, icon: '🪪', color: '#a855f7' },
                                { label: 'MRR (USD)', value: `$${stats?.platform?.mrr || 0}`, icon: '💰', color: '#10b981' },
                                { label: 'ARR (USD)', value: `$${stats?.platform?.arr || 0}`, icon: '📈', color: '#06b6d4' },
                                { label: 'Bloques SHA-256', value: stats?.platform?.auditBlocks || 0, icon: '🔐', color: '#ef4444' },
                                { label: 'Registros Pendientes', value: stats?.platform?.pendingRegistrations || 0, icon: '📝', color: '#f97316' }
                            ].map((kpi, i) => (
                                <div key={i} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>{kpi.label}</span>
                                        <span style={{ fontSize: '1.2rem' }}>{kpi.icon}</span>
                                    </div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Incidents Summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>🚨 Incidencias Activas</h3>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#450a0a', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{stats?.incidents?.critical || 0}</div>
                                        <div style={{ color: '#fca5a5', fontSize: '0.75rem' }}>Críticas</div>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#451a03', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{stats?.incidents?.warning || 0}</div>
                                        <div style={{ color: '#fcd34d', fontSize: '0.75rem' }}>Alertas</div>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#0c4a6e', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{stats?.incidents?.info || 0}</div>
                                        <div style={{ color: '#7dd3fc', fontSize: '0.75rem' }}>Info</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>👷 Estado de Operarios</h3>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#052e16', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e' }}>{stats?.platform?.activeWorkers || 0}</div>
                                        <div style={{ color: '#86efac', fontSize: '0.75rem' }}>Activos</div>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#451a03', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{stats?.platform?.pendingWorkers || 0}</div>
                                        <div style={{ color: '#fcd34d', fontSize: '0.75rem' }}>Pendientes</div>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'center', padding: '16px', background: '#450a0a', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{stats?.platform?.blockedWorkers || 0}</div>
                                        <div style={{ color: '#fca5a5', fontSize: '0.75rem' }}>Bloqueados</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeView === 'tenants' ? (
                    /* ============ TENANTS ============ */
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>🏢 Gestión de Tenants</h2>
                            <button onClick={() => setShowNewTenant(true)} style={{ padding: '10px 20px', background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                                + Nuevo Tenant
                            </button>
                        </div>

                        {/* New Tenant Modal */}
                        {showNewTenant && (
                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '2px solid #f59e0b', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Crear Nuevo Tenant</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <input placeholder="Nombre empresa" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem' }} />
                                    <input placeholder="slug (ej: constructora-abc)" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem' }} />
                                    <input placeholder="Email del dueño" value={newTenant.ownerEmail} onChange={e => setNewTenant({...newTenant, ownerEmail: e.target.value})} style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem' }} />
                                    <input placeholder="Teléfono (WhatsApp)" value={newTenant.ownerPhone} onChange={e => setNewTenant({...newTenant, ownerPhone: e.target.value})} style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem' }} />
                                    <select value={newTenant.plan} onChange={e => setNewTenant({...newTenant, plan: e.target.value})} style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem' }}>
                                        <option value="starter">🟢 Starter ($29/mes)</option>
                                        <option value="professional">🔵 Professional ($99/mes)</option>
                                        <option value="enterprise">🟣 Enterprise ($199/mes)</option>
                                    </select>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={handleCreateTenant} disabled={creating} style={{ flex: 1, padding: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                                            {creating ? 'Creando...' : '✅ Crear Tenant'}
                                        </button>
                                        <button onClick={() => setShowNewTenant(false)} style={{ padding: '10px 16px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tenants List */}
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {tenants.map((t, i) => (
                                <div key={i} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t.name}</span>
                                            {planBadge(t.plan)}
                                            <span style={{ color: t.status === 'active' ? '#22c55e' : '#ef4444', fontSize: '0.75rem' }}>● {t.status}</span>
                                        </div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                            {t.slug}.obrasaas.app • {t.ownerEmail || 'Sin email'} • Creado: {new Date(t.createdAt).toLocaleDateString('es-AR')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontWeight: 700, color: '#3b82f6' }}>{t.projectCount}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Obras</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontWeight: 700, color: '#22c55e' }}>{t.workerCount}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Operarios</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : activeView === 'billing' ? (
                    /* ============ BILLING ============ */
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '24px' }}>💰 Facturación & Revenue</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>MRR (Monthly Recurring Revenue)</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#22c55e' }}>${stats?.platform?.mrr || 0}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>USD / mes</div>
                            </div>
                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>ARR (Annual Recurring Revenue)</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#3b82f6' }}>${stats?.platform?.arr || 0}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>USD / año</div>
                            </div>
                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155', textAlign: 'center' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>Target 500 Clientes</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b' }}>${(500 * 99).toLocaleString()}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>USD / mes potencial</div>
                            </div>
                        </div>

                        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>📊 Planes de Precio</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #334155' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '0.8rem' }}>Plan</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Precio</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Obras</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Usuarios</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Suscriptores</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: 'Starter', price: '$29', obras: '1', users: '5', subs: tenants.filter(t => t.plan === 'starter').length },
                                        { name: 'Professional', price: '$99', obras: '5', users: '20', subs: tenants.filter(t => t.plan === 'professional').length },
                                        { name: 'Enterprise', price: '$199', obras: '∞', users: '∞', subs: tenants.filter(t => t.plan === 'enterprise').length }
                                    ].map((p, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                                            <td style={{ padding: '12px', fontWeight: 600 }}>{planBadge(p.name.toLowerCase())} {p.name}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', color: '#22c55e', fontWeight: 700 }}>{p.price}/mes</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{p.obras}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{p.users}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>{p.subs}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeView === 'audit' ? (
                    /* ============ AUDIT ============ */
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '24px' }}>🔐 Auditoría & Trazabilidad SHA-256</h2>
                        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Cadena de Bloques de Auditoría</h3>
                                <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>✅ {stats?.platform?.auditBlocks || 0} bloques certificados</span>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                Cada acción en la plataforma (KYC, asistencia, incidencias, gastos) genera un bloque de auditoría inmutable con hash SHA-256. 
                                Esta cadena es exportable para presentar en licitaciones públicas y auditorías de la SRT.
                            </p>
                        </div>
                    </div>
                ) : (
                    /* ============ WORKERS ============ */
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '24px' }}>👷 Operarios de la Plataforma</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: '#052e16', borderRadius: '12px', padding: '20px', border: '1px solid #166534', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e' }}>{stats?.platform?.activeWorkers || 0}</div>
                                <div style={{ color: '#86efac', fontSize: '0.85rem' }}>Activos (KYC OK)</div>
                            </div>
                            <div style={{ background: '#451a03', borderRadius: '12px', padding: '20px', border: '1px solid #92400e', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{stats?.platform?.pendingWorkers || 0}</div>
                                <div style={{ color: '#fcd34d', fontSize: '0.85rem' }}>Pre-Verificados</div>
                            </div>
                            <div style={{ background: '#450a0a', borderRadius: '12px', padding: '20px', border: '1px solid #991b1b', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{stats?.platform?.blockedWorkers || 0}</div>
                                <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Bloqueados (ART)</div>
                            </div>
                        </div>
                        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                Los operarios se registran vía WhatsApp (auto-servicio) o desde el KYC biométrico con foto de DNI + selfie. 
                                Los operarios con ART vencida son bloqueados automáticamente del acceso por geocerca satelital.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
