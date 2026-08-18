"use client";
import { useState, useEffect } from 'react';

export default function VecinoDigitalPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/v1/portal?token=public')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏠</div>
                <p>Cargando portal del inversor...</p>
            </div>
        </div>
    );

    const progress = data?.progress?.overall || 0;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            {/* Hero Header */}
            <header style={{ padding: '40px 32px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Portal del Inversor</div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '4px' }}>{data?.project?.name}</h1>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    📍 {data?.project?.address} — {data?.project?.city}, {data?.project?.province}
                </p>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>
                    Director de Obra: {data?.project?.director} • {data?.progress?.currentQuincena}
                </p>
            </header>

            <main style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px 40px' }}>
                {/* Main Progress Ring */}
                <div style={{ background: '#1e293b', borderRadius: '16px', padding: '32px', border: '1px solid #334155', marginBottom: '24px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto 20px' }}>
                        <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <circle cx="60" cy="60" r="52" fill="none" stroke="#334155" strokeWidth="10" />
                            <circle cx="60" cy="60" r="52" fill="none" stroke={progress >= 80 ? '#22c55e' : progress >= 50 ? '#f59e0b' : '#3b82f6'} strokeWidth="10"
                                strokeDasharray={`${(progress / 100) * 327} 327`} strokeLinecap="round" />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: progress >= 80 ? '#22c55e' : '#f59e0b' }}>{progress}%</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Avance Global</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
                        <div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#22c55e' }}>{data?.progress?.tasksCompleted}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Completadas</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#3b82f6' }}>{data?.progress?.tasksTotal - data?.progress?.tasksCompleted}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>En Proceso</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f59e0b' }}>{data?.workersOnSite}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Operarios</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Active Work */}
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>🏗️ Trabajos en Curso</h3>
                        {data?.activeWork?.length > 0 ? data.activeWork.map((w, i) => (
                            <div key={i} style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{w.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>{w.progress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${w.progress}%`, height: '100%', background: '#f59e0b', borderRadius: '2px' }} />
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Asignado: {w.assignedTo}</div>
                            </div>
                        )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Sin trabajos activos actualmente</p>}
                    </div>

                    {/* Milestones */}
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>✅ Hitos Completados</h3>
                        {data?.milestones?.length > 0 ? data.milestones.map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', padding: '8px', background: '#052e16', borderRadius: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>✅</span>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#86efac' }}>{m.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{m.completedDate}</div>
                                </div>
                            </div>
                        )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Aún no se completaron hitos</p>}
                    </div>
                </div>

                {/* Recent Updates */}
                {data?.recentIncidents?.length > 0 && (
                    <div style={{ marginTop: '16px', background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>📢 Novedades Recientes</h3>
                        {data.recentIncidents.map((inc, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', padding: '10px', background: inc.type === 'Crítico' ? '#450a0a' : '#172032', borderRadius: '8px' }}>
                                <span style={{ fontSize: '1rem' }}>{inc.type === 'Crítico' ? '🚨' : inc.type === 'Alerta' ? '⚠️' : 'ℹ️'}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{inc.title}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{inc.timestamp}</div>
                                </div>
                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: inc.type === 'Crítico' ? '#ef4444' : '#475569', color: '#fff', borderRadius: '10px' }}>{inc.type}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '0.75rem' }}>
                    <p>Powered by <strong style={{ color: '#f59e0b' }}>ObraSaaS</strong> — Plataforma de Control de Obras</p>
                    <p>Última actualización: {new Date(data?.lastUpdate || Date.now()).toLocaleString('es-AR')}</p>
                </div>
            </main>
        </div>
    );
}
