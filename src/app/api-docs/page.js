export const metadata = {
    title: 'ObraSaaS API Documentation — REST API v1',
    description: 'Documentación completa de la API REST de ObraSaaS para integraciones enterprise.'
};

export default function ApiDocsPage() {
    const endpoints = [
        {
            method: 'GET', path: '/api/v1/workers', desc: 'Lista de operarios registrados',
            response: '{ workers: [{ id, name, trade, phone, dni, status, assignedTasks }], total }'
        },
        {
            method: 'GET', path: '/api/v1/projects', desc: 'Proyectos/obras configurados',
            response: '{ projects: [{ id, name, city, coordinates, geofenceRadius }], activeProject }'
        },
        {
            method: 'GET', path: '/api/v1/tasks', desc: 'Tareas del Gantt con progreso',
            response: '{ tasks: [{ id, name, progress, startDate, endDate, status }], overallProgress }'
        },
        {
            method: 'GET', path: '/api/v1/incidents', desc: 'Incidencias con severidad',
            response: '{ incidents: [{ id, title, type, severity, reporter }], critical, unresolved }'
        },
        {
            method: 'GET', path: '/api/state', desc: 'Estado completo de la aplicación',
            response: '{ ...fullAppState }'
        },
        {
            method: 'GET', path: '/api/admin/stats', desc: 'Estadísticas de la plataforma (super-admin)',
            response: '{ platform: { totalTenants, mrr, arr, ... }, incidents, growth }'
        },
        {
            method: 'GET', path: '/api/admin/tenants', desc: 'Lista de tenants (super-admin)',
            response: '{ tenants: [{ id, name, slug, plan, status }] }'
        },
        {
            method: 'POST', path: '/api/admin/tenants', desc: 'Crear nuevo tenant',
            response: '{ tenant: { id, name, slug, plan } }'
        },
        {
            method: 'GET', path: '/api/admin/libro-obra', desc: 'Entries del Libro de Obra Digital',
            response: '{ entries: [{ date, weather, workersPresent, tasksPerformed, hash }] }'
        },
        {
            method: 'POST', path: '/api/admin/libro-obra', desc: 'Crear entry en el Libro de Obra',
            response: '{ entry: { id, date, hash, signedBy } }'
        }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc', padding: '40px 20px' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <span style={{ fontSize: '3rem' }}>🏗️</span>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '12px 0', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ObraSaaS API v1</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1rem' }}>REST API para integración con sistemas contables, ERPs y aplicaciones de terceros</p>
                </div>

                {/* Auth Section */}
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #334155' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>🔐 Autenticación</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '12px' }}>Todas las requests requieren un header <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', color: '#f59e0b' }}>x-api-key</code> con tu API key.</p>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        <span style={{ color: '#94a3b8' }}>curl</span> -H <span style={{ color: '#22c55e' }}>&quot;x-api-key: tu_api_key&quot;</span> https://obrasaas.vercel.app<span style={{ color: '#f59e0b' }}>/api/v1/workers</span>
                    </div>
                </div>

                {/* Base URL */}
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '32px', border: '1px solid #334155' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>🌐 Base URL</h2>
                    <code style={{ background: '#0f172a', padding: '8px 16px', borderRadius: '8px', color: '#22c55e', fontSize: '1rem' }}>https://obrasaas.vercel.app</code>
                </div>

                {/* Endpoints */}
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '16px' }}>📋 Endpoints</h2>
                
                {endpoints.map((ep, i) => (
                    <div key={i} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '12px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{
                                background: ep.method === 'GET' ? '#166534' : ep.method === 'POST' ? '#1e40af' : '#92400e',
                                color: '#fff', padding: '4px 10px', borderRadius: '6px', fontFamily: 'monospace',
                                fontSize: '0.75rem', fontWeight: 700
                            }}>{ep.method}</span>
                            <code style={{ color: '#f59e0b', fontSize: '0.9rem' }}>{ep.path}</code>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>{ep.desc}</p>
                        <div style={{ background: '#0f172a', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', overflow: 'auto' }}>
                            Response: {ep.response}
                        </div>
                    </div>
                ))}

                {/* Rate Limits */}
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginTop: '32px', border: '1px solid #334155' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>⚡ Rate Limits</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #334155' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#94a3b8', fontSize: '0.8rem' }}>Plan</th>
                                <th style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Requests/min</th>
                                <th style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Requests/día</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td style={{ padding: '8px' }}>🟢 Starter</td><td style={{ padding: '8px', textAlign: 'center' }}>60</td><td style={{ padding: '8px', textAlign: 'center' }}>10,000</td></tr>
                            <tr><td style={{ padding: '8px' }}>🔵 Professional</td><td style={{ padding: '8px', textAlign: 'center' }}>120</td><td style={{ padding: '8px', textAlign: 'center' }}>50,000</td></tr>
                            <tr><td style={{ padding: '8px' }}>🟣 Enterprise</td><td style={{ padding: '8px', textAlign: 'center' }}>300</td><td style={{ padding: '8px', textAlign: 'center' }}>Ilimitado</td></tr>
                        </tbody>
                    </table>
                </div>

                <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '0.8rem' }}>
                    ObraSaaS API v1 — © {new Date().getFullYear()} — Soporte: api@obrasaas.app
                </div>
            </div>
        </div>
    );
}
