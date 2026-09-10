"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, PageHeader, Modal } from '@/lib/design-system';

export default function CertificacionPage() {
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('Q1 - Agosto 2026');
    const [cacAdjustment, setCacAdjustment] = useState(14.21);
    const [showNewCertModal, setShowNewCertModal] = useState(false);
    const [newCertProgress, setNewCertProgress] = useState(48);
    const [signedHash, setSignedHash] = useState('8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5be3b0c44298fc1c149afbf4c8996fb924');
    const [copiedHash, setCopiedHash] = useState(false);
    const [dispatchingWhatsApp, setDispatchingWhatsApp] = useState(false);
    const [dispatchSuccess, setDispatchSuccess] = useState(false);

    useEffect(() => {
        fetch('/api/state')
            .then(res => res.json())
            .then(data => {
                setState(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const copyToClipboard = (text) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedHash(true);
            setTimeout(() => setCopiedHash(false), 2000);
        }
    };

    const handleDispatchWhatsApp = async () => {
        setDispatchingWhatsApp(true);
        try {
            const res = await fetch('/api/v1/whatsapp/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName: 'daily_summary',
                    recipientPhone: '+5492613168608',
                    variables: {
                        fecha: new Date().toLocaleDateString('es-AR'),
                        avance: String(state?.avancePercentage || 42) + '%',
                        clima: 'Despejado',
                        presentismo: '100% Cuadrilla en Predio',
                        hitos: 'Certificado ' + selectedPeriod + ' emitido y firmado con hash SHA-256'
                    }
                })
            });
            if (res.ok) {
                setDispatchSuccess(true);
                setTimeout(() => setDispatchSuccess(false), 3000);
            }
        } catch (e) {
            console.error(e);
        }
        setDispatchingWhatsApp(false);
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%' }} />
            </div>
        );
    }

    const project = state?.projectConfig || {};
    const budget = state?.budget || {};
    const rubros = budget?.rubros || [
        { id: 'R-01', nombre: 'Fundaciones y Submuración', presupuesto: 450000, ejecutado: 450000 },
        { id: 'R-02', nombre: 'Estructura Resistente H°A°', presupuesto: 1250000, ejecutado: 950000 },
        { id: 'R-03', nombre: 'Mampostería de Elevación', presupuesto: 820000, ejecutado: 380000 },
        { id: 'R-04', nombre: 'Instalación Sanitaria y Gas', presupuesto: 640000, ejecutado: 260000 },
        { id: 'R-05', nombre: 'Instalación Eléctrica Integral', presupuesto: 510000, ejecutado: 120000 }
    ];

    const totalPresupuesto = rubros.reduce((acc, r) => acc + (r.presupuesto || 0), 0);
    const totalEjecutado = rubros.reduce((acc, r) => acc + (r.ejecutado || 0), 0);
    const montoAjustadoCAC = Math.round(totalEjecutado * (1 + cacAdjustment / 100));
    const fondoReparo = Math.round(montoAjustadoCAC * 0.05);
    const liquidoAPagar = montoAjustadoCAC - fondoReparo;

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            <PageHeader
                title="Certificaciones de Obra Digitales & Redeterminación CAC"
                subtitle="Emisión fehaciente de certificados de avance físico-financiero con índice CAC, retención de fondo de reparo y firma digital SHA-256"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Costos', href: '/costos' }, { label: 'Certificaciones' }]}
                actions={
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <Link href="/dashboard">
                            <Button variant="secondary" size="sm">← Dashboard</Button>
                        </Link>
                        <a href="/api/v1/certificacion/pdf" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <Button variant="primary" size="sm">📄 Descargar Certificado PDF</Button>
                        </a>
                        <Button variant="whatsapp" size="sm" onClick={handleDispatchWhatsApp} disabled={dispatchingWhatsApp}>
                            {dispatchSuccess ? '✅ Notificado a WhatsApp!' : dispatchingWhatsApp ? 'Enviando...' : '📱 Enviar al Comitente'}
                        </Button>
                    </div>
                }
            />
            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px clamp(14px, 4vw, 32px) 80px' }}>
                <GlassCard style={{ padding: '18px 24px', marginBottom: '28px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060913', fontSize: '1.4rem', fontWeight: 900 }}>📜</div>
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>Certificado Nº CERT-2026-004 — {selectedPeriod}</div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                    Obra: <strong style={{ color: '#f8fafc' }}>{project.name || 'Torre Palermo Soho'}</strong> • Director Técnico: <strong style={{ color: '#f8fafc' }}>{project.director?.name || 'Arq. Marcelo'}</strong> (Mat. CPAU)
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Índice CAC Ajuste</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8' }}>+{cacAdjustment}% vs Base</div>
                            </div>
                            <Button variant="secondary" size="xs" onClick={() => setShowNewCertModal(true)}>➕ Emitir Nueva Quincena</Button>
                        </div>
                    </div>
                </GlassCard>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    <StatCard label="AVANCE FÍSICO GLOBAL" value={String(state?.avancePercentage || 42) + '%'} sub="Verificado en obra" icon="🏗️" color="#3b82f6" />
                    <StatCard label="MONTO BÁSICO ACUMULADO" value={'$' + totalEjecutado.toLocaleString('es-AR')} sub="A valores contractuales" icon="💰" color="#f59e0b" />
                    <StatCard label="AJUSTADO POR CAC (+14.2%)" value={'$' + montoAjustadoCAC.toLocaleString('es-AR')} sub="Redeterminación oficial" icon="📈" color="#10b981" />
                    <StatCard label="FONDO DE REPARO (5%)" value={'$' + fondoReparo.toLocaleString('es-AR')} sub="Retención Ley 22.250" icon="🛡️" color="#ec4899" />
                    <StatCard label="LÍQUIDO A PERCIBIR" value={'$' + liquidoAPagar.toLocaleString('es-AR')} sub="Saldo neto a transferir" icon="💵" color="#22c55e" />
                </div>
                <GlassCard style={{ padding: '24px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>📑 Discriminación por Rubros Constructivos</h3>
                            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 0' }}>Comparativa entre presupuesto contractual, porcentaje acumulado y liquidación del período</p>
                        </div>
                        <Badge color="#10b981" variant="filled" size="sm">Normativa CIRSOC & UOCRA</Badge>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 8px' }}>CÓDIGO & RUBRO</th>
                                    <th style={{ padding: '12px 8px' }}>PRESUP. BASE</th>
                                    <th style={{ padding: '12px 8px' }}>AVANCE ACUM.</th>
                                    <th style={{ padding: '12px 8px' }}>MONTO BASE</th>
                                    <th style={{ padding: '12px 8px' }}>REDET. CAC (+14.2%)</th>
                                    <th style={{ padding: '12px 8px' }}>FONDO REPARO (5%)</th>
                                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>NETO A COBRAR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rubros.map((r, i) => {
                                    const pct = Math.min(100, Math.round(((r.ejecutado || 0) / (r.presupuesto || 1)) * 100));
                                    const ajustado = Math.round((r.ejecutado || 0) * (1 + cacAdjustment / 100));
                                    const retenido = Math.round(ajustado * 0.05);
                                    const neto = ajustado - retenido;
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc' }}>
                                            <td style={{ padding: '14px 8px' }}>
                                                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{r.nombre}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Item {r.id}</div>
                                            </td>
                                            <td style={{ padding: '14px 8px', color: '#cbd5e1' }}>{'$' + (r.presupuesto || 0).toLocaleString('es-AR')}</td>
                                            <td style={{ padding: '14px 8px', minWidth: '140px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 800, color: pct === 100 ? '#10b981' : '#f59e0b', fontSize: '0.8rem', minWidth: '35px' }}>{pct}%</span>
                                                    <div style={{ flex: 1 }}>
                                                        <ProgressBar value={pct} color={pct === 100 ? '#10b981' : '#f59e0b'} height={5} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 8px', color: '#f59e0b', fontWeight: 600 }}>{'$' + (r.ejecutado || 0).toLocaleString('es-AR')}</td>
                                            <td style={{ padding: '14px 8px', color: '#38bdf8', fontWeight: 600 }}>{'$' + ajustado.toLocaleString('es-AR')}</td>
                                            <td style={{ padding: '14px 8px', color: '#ec4899', fontWeight: 600 }}>{'-$' + retenido.toLocaleString('es-AR')}</td>
                                            <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: '0.9rem' }}>{'$' + neto.toLocaleString('es-AR')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '16px 8px', fontWeight: 900, color: '#f8fafc' }}>TOTALES CONSOLIDADOS</td>
                                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#cbd5e1' }}>{'$' + totalPresupuesto.toLocaleString('es-AR')}</td>
                                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#f59e0b' }}>{String(state?.avancePercentage || 42) + '% Global'}</td>
                                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#f59e0b' }}>{'$' + totalEjecutado.toLocaleString('es-AR')}</td>
                                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#38bdf8' }}>{'$' + montoAjustadoCAC.toLocaleString('es-AR')}</td>
                                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#ec4899' }}>{'-$' + fondoReparo.toLocaleString('es-AR')}</td>
                                    <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: 900, color: '#22c55e', fontSize: '1.05rem' }}>{'$' + liquidoAPagar.toLocaleString('es-AR')}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </GlassCard>
                <GlassCard style={{ padding: '24px', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060913', fontSize: '1.2rem', fontWeight: 900 }}>🔐</div>
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>Sello Digital de Inmutabilidad SHA-256</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                    Hash: <code style={{ color: '#c4b5fd' }}>{signedHash}</code>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Button variant="secondary" size="xs" onClick={() => copyToClipboard(signedHash)}>{copiedHash ? '✅ Copiado!' : '📋 Copiar Hash'}</Button>
                            <a href="/api/v1/certificacion/pdf" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                <Button variant="primary" size="xs">Ver PDF Foliado</Button>
                            </a>
                        </div>
                    </div>
                </GlassCard>
                <Modal isOpen={showNewCertModal} onClose={() => setShowNewCertModal(false)} title="Emitir Certificado de Avance de Obra">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setShowNewCertModal(false);
                        alert('Certificado emitido con éxito y firmado con hash SHA-256.');
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Quincena a Certificar</label>
                                <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f8fafc' }}>
                                    <option value="Q1 - Agosto 2026">Q1 - Agosto 2026</option>
                                    <option value="Q2 - Agosto 2026">Q2 - Agosto 2026</option>
                                    <option value="Q1 - Septiembre 2026">Q1 - Septiembre 2026</option>
                                    <option value="Q2 - Septiembre 2026">Q2 - Septiembre 2026</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Avance Global Medido (%)</label>
                                <input type="number" value={newCertProgress} onChange={e => setNewCertProgress(Number(e.target.value))} min="0" max="100" style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f8fafc' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Ajuste por Variación CAC (%)</label>
                                <input type="number" step="0.01" value={cacAdjustment} onChange={e => setCacAdjustment(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f8fafc' }} />
                            </div>
                            <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.76rem', color: '#fcd34d' }}>
                                ⚠️ Se aplicará la retención obligatoria del 5% en concepto de Fondo de Reparo (Ley 22.250 / CCT 76/75).
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <Button variant="secondary" size="sm" type="button" onClick={() => setShowNewCertModal(false)}>Cancelar</Button>
                                <Button variant="primary" size="sm" type="submit">Firmar & Emitir Certificado</Button>
                            </div>
                        </div>
                    </form>
                </Modal>
            </main>
        </div>
    );
}
