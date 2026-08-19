"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, Tabs, PageHeader, Modal, EmptyState } from '@/lib/design-system';

export default function CompliancePage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('art');
    const [selectedWorkerCred, setSelectedWorkerCred] = useState(null);
    const [onDemandActivated, setOnDemandActivated] = useState(false);
    const [brokerSentSuccess, setBrokerSentSuccess] = useState(false);

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

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%' }} />
            </div>
        );
    }

    const uocra = data?.uocra || {};
    const polizas = data?.polizas || {};
    const artSummary = polizas.art?.summary || {};

    const demoCompetencies = [
        {
            name: 'Juan Pérez',
            cuil: '20-35892114-9',
            category: 'Oficial Albañil',
            certifications: [
                { title: 'Trabajo Seguro en Altura (+2m)', issuer: 'SRT Res. 319/99', date: '15/03/2026', validUntil: '15/03/2027', status: 'VALID' },
                { title: 'Uso de EPP & Elementos de Amarre', issuer: 'CPAU / IRAM', date: '10/01/2026', validUntil: '10/01/2027', status: 'VALID' },
                { title: 'Primeros Auxilios en Obra', issuer: 'Cruz Roja Argentina', date: '04/05/2025', validUntil: '04/05/2026', status: 'EXPIRING' }
            ],
            score: 95,
            qrCode: 'OBRASAAS-KYC-35892114'
        },
        {
            name: 'Carlos Rodríguez',
            cuil: '20-38410923-4',
            category: 'Medio Oficial Armador',
            certifications: [
                { title: 'Riesgo Eléctrico y 5 Reglas de Oro', issuer: 'SRT Res. 905/15', date: '12/02/2026', validUntil: '12/02/2027', status: 'VALID' },
                { title: 'Armado de Encofrados & Andamios', issuer: 'Fundación UOCRA', date: '18/11/2024', validUntil: '18/11/2025', status: 'EXPIRED' }
            ],
            score: 78,
            qrCode: 'OBRASAAS-KYC-38410923'
        },
        {
            name: 'Miguel Ángel Benítez',
            cuil: '20-32981765-2',
            category: 'Especialista en Hormigón',
            certifications: [
                { title: 'Operador de Autoelevador & Pluma', issuer: 'IRAM 3920', date: '20/04/2026', validUntil: '20/04/2027', status: 'VALID' },
                { title: 'Trabajo Seguro en Altura (+2m)', issuer: 'SRT Res. 319/99', date: '05/02/2026', validUntil: '05/02/2027', status: 'VALID' },
                { title: 'Manejo de Sustancias Químicas (Aditivos)', issuer: 'CPAU', date: '14/06/2025', validUntil: '14/06/2026', status: 'VALID' }
            ],
            score: 100,
            qrCode: 'OBRASAAS-KYC-32981765'
        }
    ];

    const tabs = [
        { id: 'art', label: 'Pólizas de ART', icon: '🛡️', badge: artSummary.vigentes || 3 },
        { id: 'ondemand', label: '⚡ ART On-Demand por Día', icon: '⚡' },
        { id: 'competencias', label: 'Capacitaciones & QR', icon: '🎓' },
        { id: 'uocra', label: 'CCT 76/75 UOCRA', icon: '👷' },
        { id: 'polizas', label: 'Pólizas de Obra & RC', icon: '📋' }
    ];

    const presentWorkersToday = [
        { name: 'Juan Pérez', cuil: '20-35892114-9', role: 'Oficial Albañil', hour: '07:45 AM', artType: 'ART Fija (La Segunda)', costDay: 0 },
        { name: 'Carlos Rodríguez', cuil: '20-38410923-4', role: 'Medio Oficial', hour: '07:52 AM', artType: 'ART Fija (La Segunda)', costDay: 0 },
        { name: 'Miguel Ángel Benítez', cuil: '20-32981765-2', role: 'Especialista Hormigón', hour: '08:02 AM', artType: 'ART Fija (La Segunda)', costDay: 0 },
        { name: 'Darío Fernández (Subcontrato)', cuil: '20-41098231-1', role: 'Colocador Porcelanato', hour: '08:15 AM', artType: 'AP On-Demand (Activa)', costDay: 3850 },
        { name: 'Lucas Molina (Subcontrato)', cuil: '20-39821450-8', role: 'Ayudante Yesero', hour: '08:20 AM', artType: 'AP On-Demand (Activa)', costDay: 3200 }
    ];

    const handleSendBrokerWhatsApp = () => {
        const text = `📋 *DECLARACIÓN JURADA DE NÓMINA EN PREDIO (SRT Res. 319/99)*\n🏗️ *Obra:* Torre Soho Palermo\n📅 *Fecha:* ${new Date().toLocaleDateString('es-AR')}\n👥 *Total Operarios en Predio:* ${presentWorkersToday.length}\n• Operarios Planta Fija: 3\n• Subcontratos con AP On-Demand activado: 2\n\n_Emitido automáticamente vía ObraSaaS Compliance Engine_`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
        setBrokerSentSuccess(true);
        setTimeout(() => setBrokerSentSuccess(false), 4000);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Centro de Cumplimiento Normativo & Seguridad"
                subtitle="Gestión integral de ART, Accidentes Personales On-Demand, CCT UOCRA 76/75 y Certificaciones SRT Res. 905/15"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Compliance' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm">← Dashboard</Button>
                        </Link>
                        <Link href="/inspecciones" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm" icon="📋">Inspecciones</Button>
                        </Link>
                        <Link href="/ejecutivo" style={{ textDecoration: 'none' }}>
                            <Button variant="primary" size="sm" icon="📊">Reporte CEO</Button>
                        </Link>
                    </div>
                }
            />

            <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '20px clamp(14px, 4vw, 28px) 80px' }}>
                
                {/* KPI Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '32px' }}>
                    <StatCard
                        label="COMPLIANCE RATE"
                        value={`${artSummary.complianceRate || 95}%`}
                        sub="Conformidad normativa legal"
                        icon="🛡️"
                        color={(artSummary.complianceRate || 95) >= 80 ? '#10b981' : '#ef4444'}
                    />
                    <StatCard label="ART VIGENTES" value={artSummary.vigentes || 3} sub="Personal propio habilitado" icon="✅" color="#10b981" />
                    <StatCard label="AP ON-DEMAND HOY" value="2" sub="Subcontratos asegurados hoy" icon="⚡" color="#f59e0b" />
                    <StatCard label="CAPACITACIONES SRT" value="92%" sub="Competencias al día" icon="🎓" color="#38bdf8" />
                    <StatCard label="COSTO MENSUAL UOCRA" value={formatARS(uocra.totals?.costoTotalMensual || 1687800)} sub="Jornales + Cargas" icon="💰" color="#3b82f6" />
                </div>

                {/* Tab Switcher */}
                <div style={{ marginBottom: '24px' }}>
                    <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} color="#f59e0b" />
                </div>

                {/* TAB 1: ART POLICIES */}
                {activeTab === 'art' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(polizas.art?.policies || []).map((p, i) => {
                            const isVigente = p.status === 'VIGENTE';
                            return (
                                <GlassCard key={i} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '10px',
                                            background: isVigente ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: isVigente ? '#10b981' : '#ef4444',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.2rem', fontWeight: 900
                                        }}>
                                            {isVigente ? '🛡️' : '🚨'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#f8fafc' }}>
                                                {p.worker}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: tokens.font.mono, marginTop: '2px' }}>
                                                {p.company} • Póliza #{p.policyNumber}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: isVigente ? '#10b981' : '#ef4444' }}>
                                                {p.alert || (isVigente ? 'Vigente' : 'Vencida')}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                                Vence: {p.expirationDate || 'N/A'}
                                            </div>
                                        </div>
                                        <Badge color={isVigente ? '#10b981' : '#ef4444'} variant="filled" size="sm">
                                            {isVigente ? 'HABILITADO' : 'BLOQUEADO'}
                                        </Badge>
                                    </div>
                                </GlassCard>
                            );
                        })}
                        {(!polizas.art?.policies || polizas.art.policies.length === 0) && (
                            <EmptyState icon="🛡️" title="No hay pólizas ART registradas" description="Los operarios registrados a través de WhatsApp o KYC aparecerán listados aquí." />
                        )}
                    </motion.div>
                )}

                {/* TAB 2: ART & AP ON-DEMAND (COEFTRACK KILLER FEATURE) */}
                {activeTab === 'ondemand' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <GlassCard style={{ padding: '28px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '1.4rem' }}>⚡</span>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                            Activación On-Demand de Seguro por Jornada Trabajada
                                        </h3>
                                        <Badge color="#f59e0b" variant="filled" size="xs">EXCLUSIVO LATAM</Badge>
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
                                        Eliminá el sobrecosto de pólizas fijas mensuales para gremios temporales. El sistema sincroniza automáticamente el fichaje geolocalizado matutino de los subcontratistas y activa la cobertura de Accidentes Personales (AP) con cláusula de no repetición sólo por los días que ingresan al obrador.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <Button
                                        variant="whatsapp"
                                        size="md"
                                        icon="💬"
                                        onClick={handleSendBrokerWhatsApp}
                                    >
                                        Enviar Nómina a Broker ART
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="md"
                                        icon="⚡"
                                        onClick={() => setOnDemandActivated(!onDemandActivated)}
                                    >
                                        {onDemandActivated ? '✓ Cobertura del Día Sincronizada' : 'Activar Cobertura Jornada Hoy'}
                                    </Button>
                                </div>
                            </div>

                            {brokerSentSuccess && (
                                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>✅</span> Declaración jurada de nómina de obra enviada exitosamente al Broker por WhatsApp.
                                </div>
                            )}

                            {/* Live Attendance vs Coverage Matrix */}
                            <div style={{ background: 'rgba(6, 9, 19, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc', fontWeight: 700 }}>
                                        👷 Nómina Presente en Obrador Hoy ({presentWorkersToday.length} operarios en predio)
                                    </h4>
                                    <Badge color="#10b981" variant="filled" size="xs">100% CUBIERTOS</Badge>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {presentWorkersToday.map((w, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>●</span>
                                                <div>
                                                    <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{w.name}</strong>
                                                    <span style={{ color: '#64748b', fontSize: '0.74rem', marginLeft: '8px' }}>CUIL {w.cuil} • Ingreso: {w.hour}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Badge color={w.costDay > 0 ? '#f59e0b' : '#3b82f6'} variant="subtle" size="xs">
                                                    {w.artType}
                                                </Badge>
                                                <span style={{ fontSize: '0.8rem', color: w.costDay > 0 ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>
                                                    {w.costDay > 0 ? formatARS(w.costDay) : 'Póliza Mensual'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Savings Calculator */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '20px' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>AHORRO PROMEDIO MENSUAL</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', marginTop: '4px' }}>-34.8% ARS</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>vs primas fijas por gremio inactivo</div>
                                </div>
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '16px', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>CERTIFICADO DE NO REPETICIÓN</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>Automático Digital</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>A favor de la constructora y comitente</div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}

                {/* TAB 3: CAPACITACIONES & COMPETENCIAS (COEFTRACK KILLER FEATURE) */}
                {activeTab === 'competencias' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    🎓 Matriz de Competencias y Capacitaciones (SRT Res. 905/15)
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                    Validación digital de cursos habilitantes de seguridad e higiene antes de autorizar tareas críticas en predio
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
                            {demoCompetencies.map((w, idx) => (
                                <GlassCard key={idx} style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                            <div>
                                                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 2px' }}>{w.name}</h4>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{w.category} • CUIL {w.cuil}</span>
                                            </div>
                                            <Badge color={w.score >= 90 ? '#10b981' : '#f59e0b'} variant="filled" size="sm">
                                                {w.score}% Compliance
                                            </Badge>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                                            {w.certifications.map((c, cIdx) => (
                                                <div key={cIdx} style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>{c.title}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.issuer} • Vence: {c.validUntil}</div>
                                                    </div>
                                                    <Badge color={c.status === 'VALID' ? '#10b981' : c.status === 'EXPIRING' ? '#f59e0b' : '#ef4444'} variant="subtle" size="xs">
                                                        {c.status === 'VALID' ? 'VIGENTE' : c.status === 'EXPIRING' ? 'POR VENCER' : 'VENCIDO'}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon="🪪"
                                        onClick={() => setSelectedWorkerCred(w)}
                                    >
                                        Ver Credencial Digital QR de Obra
                                    </Button>
                                </GlassCard>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* TAB 4: UOCRA SALARIES & CCT 76/75 */}
                {activeTab === 'uocra' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px', marginBottom: '24px' }}>
                            {(uocra.workers || []).map((w, i) => (
                                <GlassCard key={i} style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>{w.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>CUIL: 20-{w.dni || '35892114'}-9</div>
                                        </div>
                                        <Badge color="#f59e0b" variant="filled" size="xs">
                                            {w.categoriaUOCRA || 'Oficial Albañil'}
                                        </Badge>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '0.8rem', background: 'rgba(6, 9, 19, 0.6)', padding: '12px', borderRadius: '10px' }}>
                                        <div><span style={{ color: '#64748b' }}>Jornal Diario:</span> <strong style={{ color: '#f8fafc', display: 'block' }}>{formatARS(w.jornalDiario || 18500)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>Presentismo (20%):</span> <strong style={{ color: '#f8fafc', display: 'block' }}>{formatARS(w.presentismo || 3700)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>Total Quincenal:</span> <strong style={{ color: '#10b981', display: 'block' }}>{formatARS(w.quincenal || 222000)}</strong></div>
                                        <div><span style={{ color: '#64748b' }}>ART:</span> <strong style={{ color: w.artStatus === 'SIN PÓLIZA' ? '#ef4444' : '#10b981', display: 'block' }}>{w.artStatus || 'VIGENTE'}</strong></div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>

                        {/* Cost Aggregation */}
                        {uocra.totals && (
                            <GlassCard style={{ padding: '28px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                                    Consolidado de costos laborales (CCT 76/75)
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>JORNAL TOTAL DIARIO</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>{formatARS(uocra.totals.jornalDiario)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>TOTAL QUINCENAL</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>{formatARS(uocra.totals.quincenal)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>CARGAS SOCIALES (45%)</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>{formatARS(uocra.totals.cargasSociales)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '14px', borderRadius: '10px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>COSTO TOTAL MENSUAL</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{formatARS(uocra.totals.costoTotalMensual)}</div>
                                    </div>
                                </div>
                            </GlassCard>
                        )}
                    </motion.div>
                )}

                {/* TAB 5: PROJECT POLICIES & INSURANCE */}
                {activeTab === 'polizas' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {(polizas.projectPolicies || [
                            { type: 'Todo Riesgo Construcción & Montaje', company: 'Allianz Argentina', coverage: '$150.000.000 ARS', status: 'VIGENTE', expirationDate: '2026-12-31' },
                            { type: 'Responsabilidad Civil a Linderos (RC)', company: 'Zurich Seguros', coverage: '$80.000.000 ARS', status: 'VIGENTE', expirationDate: '2026-12-31' },
                            { type: 'Seguro de Caución / Fondo de Reparo', company: 'Chubb Seguros', coverage: '$45.000.000 ARS', status: 'VIGENTE', expirationDate: '2027-03-31' }
                        ]).map((p, i) => (
                            <GlassCard key={i} style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc', marginBottom: '4px' }}>
                                        {p.type}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                        Aseguradora: <strong style={{ color: '#f8fafc' }}>{p.company}</strong> • Cobertura: <strong style={{ color: '#f59e0b' }}>{p.coverage}</strong>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Badge color="#10b981" variant="filled" size="sm">
                                        ● {p.status}
                                    </Badge>
                                    <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '4px' }}>
                                        Vigencia hasta: {p.expirationDate}
                                    </div>
                                </div>
                            </GlassCard>
                        ))}

                        {/* Legal references box */}
                        <div style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px', color: '#f8fafc' }}>
                                📚 Marco Regulatorio Vigente en Argentina
                            </h4>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div>• <strong>Ley 24.557:</strong> Riesgos del Trabajo y afiliación obligatoria de todo el personal en predio.</div>
                                <div>• <strong>Resolución SRT 319/99 & Res. 905/15:</strong> Reglamento de Higiene y Seguridad para la Industria de la Construcción y Capacitación Obligatoria.</div>
                                <div>• <strong>Ley 22.250:</strong> Régimen Laboral de la Industria de la Construcción y Libreta / IERIC.</div>
                            </div>
                        </div>
                    </motion.div>
                )}

            </main>

            {/* Modal: Digital Credential QR */}
            {selectedWorkerCred && (
                <Modal
                    isOpen={Boolean(selectedWorkerCred)}
                    onClose={() => setSelectedWorkerCred(null)}
                    title={`Credencial Digital de Obra — ${selectedWorkerCred.name}`}
                >
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
                            {/* QR Canvas / Vector Mock */}
                            <svg width="160" height="160" viewBox="0 0 100 100">
                                <rect width="100" height="100" fill="#fff" />
                                <rect x="10" y="10" width="25" height="25" fill="#000" />
                                <rect x="15" y="15" width="15" height="15" fill="#fff" />
                                <rect x="18" y="18" width="9" height="9" fill="#000" />
                                <rect x="65" y="10" width="25" height="25" fill="#000" />
                                <rect x="70" y="15" width="15" height="15" fill="#fff" />
                                <rect x="73" y="18" width="9" height="9" fill="#000" />
                                <rect x="10" y="65" width="25" height="25" fill="#000" />
                                <rect x="15" y="70" width="15" height="15" fill="#fff" />
                                <rect x="18" y="73" width="9" height="9" fill="#000" />
                                <rect x="45" y="15" width="10" height="10" fill="#000" />
                                <rect x="45" y="45" width="15" height="15" fill="#000" />
                                <rect x="70" y="45" width="10" height="10" fill="#000" />
                                <rect x="45" y="70" width="10" height="15" fill="#000" />
                                <rect x="65" y="70" width="20" height="10" fill="#000" />
                            </svg>
                        </div>
                        <div style={{ fontFamily: tokens.font.mono, fontSize: '0.8rem', color: '#38bdf8', marginBottom: '12px' }}>
                            {selectedWorkerCred.qrCode}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 700 }}>
                            {selectedWorkerCred.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '16px' }}>
                            {selectedWorkerCred.category} • CUIL {selectedWorkerCred.cuil}
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px', borderRadius: '8px', textAlign: 'left', marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
                                ✓ HABILITADO PARA TRABAJO EN PREDIO
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                ART Vigente • Apto Médico Aprobado • Res. 319/99 al día
                            </div>
                        </div>

                        <Button variant="primary" size="sm" onClick={() => setSelectedWorkerCred(null)}>
                            Cerrar Credencial
                        </Button>
                    </div>
                </Modal>
            )}

        </div>
    );
}
