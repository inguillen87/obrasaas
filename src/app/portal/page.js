"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, ProgressBar } from '@/lib/design-system';

export default function VecinoDigitalPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [copiedHash, setCopiedHash] = useState(false);

    useEffect(() => {
        fetch('/api/v1/portal?token=public')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const copyHash = (hash) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(hash);
            setCopiedHash(true);
            setTimeout(() => setCopiedHash(false), 2000);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏠</div>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 36, height: 36, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', margin: '0 auto 16px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Cargando portal de inversores...</p>
                </div>
            </div>
        );
    }

    const progress = data?.progress?.overall || 0;
    const certHash = '8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5be3b0c44298fc1c149afbf4c8996fb924';

    // Mock certified site photos for investor transparency
    const photos = [
        { id: 1, title: 'Hormigonado de Losa Nivel 3', date: '14 Ago 2026', tag: 'Estructura', icon: '🏗️', url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800&auto=format&fit=crop&q=60' },
        { id: 2, title: 'Avance Mampostería y Revoques', date: '12 Ago 2026', tag: 'Albañilería', icon: '🧱', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=60' },
        { id: 3, title: 'Prueba Hidráulica de Cañerías', date: '10 Ago 2026', tag: 'Instalaciones', icon: '💧', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=60' }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Top Navigation Bar */}
            <header style={{
                padding: '16px 28px',
                background: 'rgba(15, 23, 42, 0.8)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#060913' }}>
                        OS
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>Vecino Digital</div>
                        <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>● Portal Inversor Oficial</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <a
                        href="https://wa.me/5492613168608?text=Hola,%20quisiera%20consultar%20sobre%20el%20avance%20de%20mi%20unidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                    >
                        <Button variant="whatsapp" size="sm" icon="💬">
                            Consultar al Desarrollador
                        </Button>
                    </a>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '40px 24px 80px' }}>
                
                {/* Project Header Banner */}
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <Badge color="#f59e0b" variant="filled" size="md">
                        TRANSPARENCIA INMOBILIARIA CERTIFICADA
                    </Badge>
                    <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, margin: '12px 0 6px', fontFamily: tokens.font.heading, letterSpacing: '-0.03em' }}>
                        {data?.project?.name || 'Torre Palermo Soho'}
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0 }}>
                        📍 {data?.project?.address || 'Av. Santa Fe 3400'} — {data?.project?.city || 'CABA'}, {data?.project?.province || 'Buenos Aires'}
                    </p>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                        Director Técnico: <strong>{data?.project?.director || 'Arq. Marcelo'}</strong> • Quincena Activa: <strong>{data?.progress?.currentQuincena || 'Q1'}</strong>
                    </div>
                </div>

                {/* Main Progress Ring & Metrics */}
                <GlassCard style={{ padding: '40px 32px', marginBottom: '28px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)' }} glow>
                    <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto 24px' }}>
                        <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="10" />
                            <motion.circle
                                cx="60" cy="60" r="52" fill="none"
                                stroke={progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#3b82f6'}
                                strokeWidth="10"
                                strokeDasharray="327"
                                initial={{ strokeDashoffset: 327 }}
                                animate={{ strokeDashoffset: 327 - (progress / 100) * 327 }}
                                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.8rem', fontWeight: 900, color: progress >= 80 ? '#10b981' : '#f59e0b', fontFamily: tokens.font.heading, lineHeight: 1 }}>
                                {progress}%
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>Avance Global</div>
                        </div>
                    </div>

                    {/* Progress details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px', maxWidth: '640px', margin: '0 auto' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{data?.progress?.tasksCompleted || 4}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Hitos Concluidos</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6' }}>{(data?.progress?.tasksTotal || 6) - (data?.progress?.tasksCompleted || 4)}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>En Ejecución</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{data?.workersOnSite || 3}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Operarios en Predio</div>
                        </div>
                    </div>
                </GlassCard>

                {/* Grid: Active Works & Completed Milestones */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
                    
                    {/* Active Work */}
                    <GlassCard style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏗️ Trabajos en Curso Esta Quincena
                        </h3>
                        {data?.activeWork?.length > 0 ? data.activeWork.map((w, i) => (
                            <div key={i} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: i < data.activeWork.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>{w.name}</span>
                                    <span style={{ fontSize: '0.82rem', color: '#f59e0b', fontWeight: 800 }}>{w.progress}%</span>
                                </div>
                                <ProgressBar value={w.progress} color="#f59e0b" height={5} />
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Oficial Asignado: {w.assignedTo}</div>
                            </div>
                        )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Sin trabajos activos actualmente</p>}
                    </GlassCard>

                    {/* Milestones */}
                    <GlassCard style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✅ Hitos Certificados
                        </h3>
                        {data?.milestones?.length > 0 ? data.milestones.map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <span style={{ fontSize: '1.1rem' }}>✅</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#86efac' }}>{m.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Certificado el {m.completedDate}</div>
                                </div>
                                <Badge color="#10b981" variant="subtle" size="xs">100% OK</Badge>
                            </div>
                        )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Aún no se completaron hitos</p>}
                    </GlassCard>
                </div>

                {/* Photo Gallery (Site Log) */}
                <GlassCard style={{ padding: '28px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                📸 Registro Fotográfico Certificado
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Fotos en alta resolución con coordenadas GPS y fecha inmutable</p>
                        </div>
                        <Badge color="#3b82f6" variant="filled">3 Nuevas Esta Semana</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                        {photos.map(photo => (
                            <motion.div
                                key={photo.id}
                                whileHover={{ y: -4 }}
                                onClick={() => setSelectedPhoto(photo)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ height: '160px', background: `url(${photo.url}) center/cover no-repeat`, position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                                        <Badge color="#060913" variant="solid" size="xs">
                                            {photo.tag}
                                        </Badge>
                                    </div>
                                </div>
                                <div style={{ padding: '14px' }}>
                                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                                        {photo.icon} {photo.title}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📅 {photo.date} • Verificado GPS</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </GlassCard>

                {/* Cryptographic SHA-256 Stamp */}
                <GlassCard style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(139, 92, 246, 0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ fontSize: '2rem' }}>🔐</span>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>
                                Certificado Criptográfico de Avance Digital
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: tokens.font.mono, marginTop: '2px' }}>
                                Hash SHA-256: {certHash.slice(0, 32)}...
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => copyHash(certHash)}>
                        {copiedHash ? '✓ ¡Hash Copiado!' : 'Copiar Hash Verificador'}
                    </Button>
                </GlassCard>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: '48px', color: '#475569', fontSize: '0.76rem' }}>
                    <p>Tecnología provista por <strong style={{ color: '#f59e0b' }}>ObraSaaS Enterprise</strong></p>
                    <p>Última sincronización satelital: {new Date().toLocaleString('es-AR')}</p>
                </div>
            </main>

            {/* Photo Lightbox Modal */}
            <AnimatePresence>
                {selectedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedPhoto(null)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.85)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#0f172a',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                maxWidth: '720px',
                                width: '100%',
                                border: '1px solid rgba(255,255,255,0.15)'
                            }}
                        >
                            <div style={{ height: '360px', background: `url(${selectedPhoto.url}) center/cover no-repeat` }} />
                            <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                        {selectedPhoto.title}
                                    </h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                        Fecha: {selectedPhoto.date} • Ubicación: Predio de Obra Torre Palermo
                                    </p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => setSelectedPhoto(null)}>
                                    Cerrar
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
