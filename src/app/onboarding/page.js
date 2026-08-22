"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, ProgressBar, PageHeader } from '@/lib/design-system';
import WhatsAppEmbeddedSignup from '@/components/WhatsAppEmbeddedSignup';

function OnboardingContent() {
    const searchParams = useSearchParams();
    const planParam = searchParams.get('plan') || 'professional';

    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        companyName: '',
        ownerName: '',
        email: '',
        phone: '',
        plan: planParam,
        projectName: '',
        city: 'CABA',
        address: '',
        projectType: 'edificio',
        expectedWorkers: 12
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        if (planParam) {
            setForm(prev => ({ ...prev, plan: planParam }));
        }
    }, [planParam]);

    const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const slug = form.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'empresa';
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': 'onboarding' },
                body: JSON.stringify({
                    name: form.companyName,
                    slug,
                    plan: form.plan,
                    ownerEmail: form.email,
                    ownerPhone: form.phone
                })
            });

            if (res.ok) {
                localStorage.setItem('obrasaas_logged_in', 'true');
                setCompleted(true);
            } else {
                const err = await res.json();
                alert(err.error || 'Error al crear la cuenta. Intente nuevamente.');
            }
        } catch (err) {
            console.error('Onboarding error:', err);
            localStorage.setItem('obrasaas_logged_in', 'true');
            setCompleted(true);
        }
        setIsSubmitting(false);
    };

    const projectTemplates = [
        { id: 'edificio', label: 'Torre / Edificio en Altura', icon: '🏢', rubros: 9, quincenas: 24 },
        { id: 'casa', label: 'Vivienda Unifamiliar Premium', icon: '🏠', rubros: 6, quincenas: 16 },
        { id: 'refaccion', label: 'Refacción & Remodelación', icon: '🔧', rubros: 4, quincenas: 8 },
        { id: 'obra_publica', label: 'Obra Pública / Infraestructura', icon: '🏛️', rubros: 12, quincenas: 36 },
        { id: 'industrial', label: 'Nave Industrial / Logística', icon: '🏭', rubros: 8, quincenas: 18 },
        { id: 'barrio', label: 'Desarrollo / Loteo Residencial', icon: '🏘️', rubros: 10, quincenas: 48 }
    ];

    const inputStyle = {
        width: '100%',
        padding: '14px 16px',
        background: '#060913',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        color: '#f8fafc',
        fontSize: '0.92rem',
        outline: 'none',
        transition: 'border-color 0.2s',
        marginBottom: '14px'
    };

    if (completed) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tokens.font.sans, padding: '16px' }}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{ maxWidth: '580px', width: '100%' }}
                >
                    <GlassCard style={{ padding: '36px clamp(16px, 4vw, 36px)', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.4)' }} glow>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                          style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.6rem', color: '#050810', fontWeight: 900 }}>✓</motion.div>
                        <h1 style={{ color: '#f8fafc', fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 900, marginBottom: '12px', fontFamily: tokens.font.heading }}>
                            Tu espacio está listo
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '28px' }}>
                            Tu espacio de trabajo y primera obra han sido inicializados. Ya podés conectar tu número de WhatsApp para empezar a operar.
                        </p>

                        <div style={{ background: 'rgba(6, 9, 19, 0.7)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '28px', textAlign: 'left' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                Tu Entorno de Trabajo Aislado:
                            </div>
                            <div style={{ color: '#f59e0b', fontSize: '1.1rem', fontWeight: 800, fontFamily: tokens.font.mono, wordBreak: 'break-all' }}>
                                {form.companyName.toLowerCase().replace(/\s+/g, '-') || 'empresa'}.obrasaas.app
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '6px' }}>
                                ✓ Plan {form.plan.toUpperCase()} activo con 14 días de prueba
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/dashboard" style={{ flex: '1 1 180px' }}>
                                <Button variant="primary" size="lg" style={{ width: '100%' }}>
                                    Ir al Dashboard
                                </Button>
                            </Link>
                            <Link href="/costos" style={{ flex: '1 1 180px' }}>
                                <Button variant="secondary" size="lg" style={{ width: '100%' }}>
                                    Configurar Costos
                                </Button>
                            </Link>
                        </div>
                    </GlassCard>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#060913', fontFamily: tokens.font.sans, color: '#f8fafc' }}>
            
            {/* Header */}
            <header style={{ padding: '16px clamp(16px, 4vw, 32px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#060913' }}>
                        OS
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f8fafc' }}>ObraSaaS</span>
                </Link>
                <Link href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.82rem', transition: 'color 0.2s' }}>
                    ← Volver a Inicio
                </Link>
            </header>

            <main style={{ maxWidth: '640px', margin: '0 auto', padding: '32px clamp(14px, 4vw, 20px) 80px' }}>
                
                {/* Step Indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
                    {[
                        { num: 1, label: 'Empresa' },
                        { num: 2, label: 'Primera Obra' },
                        { num: 3, label: 'Plan' },
                        { num: 4, label: 'Meta WhatsApp' }
                    ].map((s, idx) => (
                        <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: step >= s.num ? '#f59e0b' : '#1e293b',
                                color: step >= s.num ? '#060913' : '#94a3b8',
                                fontWeight: 800,
                                fontSize: '0.84rem',
                                transition: 'all 0.3s',
                                flexShrink: 0
                            }}>
                                {step > s.num ? '✓' : s.num}
                            </div>
                            <span style={{ color: step >= s.num ? '#f8fafc' : '#64748b', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {s.label}
                            </span>
                            {idx < 3 && (
                                <div style={{ width: 'clamp(12px, 3vw, 28px)', height: '2px', background: step > s.num ? '#f59e0b' : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Container */}
                <GlassCard style={{ padding: '28px clamp(16px, 4vw, 32px)' }}>
                    
                    {/* STEP 1: Company Profile */}
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                            <Badge color="#f59e0b" variant="filled" size="sm">PASO 1 DE 4</Badge>
                            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '10px 0 6px', color: '#f8fafc' }}>
                                Creá el Perfil de tu Empresa
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: '20px' }}>
                                Configurá los datos de la constructora o desarrolladora para emitir certificados oficiales y activar la IA.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Razón Social / Nombre Comercial *</label>
                                    <input
                                        placeholder="Ej: Constructora del Plata S.A."
                                        value={form.companyName}
                                        onChange={e => updateForm('companyName', e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Corporativo del Administrador *</label>
                                    <input
                                        type="email"
                                        placeholder="admin@empresa.com"
                                        value={form.email}
                                        onChange={e => updateForm('email', e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Teléfono Móvil (WhatsApp del Director) *</label>
                                    <input
                                        placeholder="+54 9 11 5555-0199"
                                        value={form.phone}
                                        onChange={e => updateForm('phone', e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                style={{ width: '100%', marginTop: '8px' }}
                                disabled={!form.companyName || !form.email || !form.phone}
                                onClick={() => setStep(2)}
                            >
                                Siguiente: Primera Obra →
                            </Button>
                        </motion.div>
                    )}

                    {/* STEP 2: First Project */}
                    {step === 2 && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                            <Badge color="#38bdf8" variant="filled" size="sm">PASO 2 DE 4</Badge>
                            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '10px 0 6px', color: '#f8fafc' }}>
                                Configurá tu Primera Obra
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: '20px' }}>
                                Crearemos el libro de obra digital y la estructura de rubros automáticamente.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nombre del Proyecto / Obra *</label>
                                    <input
                                        placeholder="Ej: Torre Palermo Green"
                                        value={form.projectName}
                                        onChange={e => updateForm('projectName', e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Ciudad / Ubicación Geográfica *</label>
                                    <input
                                        placeholder="Ej: CABA / Mendoza / Rosario"
                                        value={form.city}
                                        onChange={e => updateForm('city', e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '24px' }}>
                                {projectTemplates.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => updateForm('projectType', t.id)}
                                        style={{
                                            padding: '10px',
                                            borderRadius: '8px',
                                            background: form.projectType === t.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(6, 9, 19, 0.6)',
                                            border: form.projectType === t.id ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                            cursor: 'pointer',
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{t.icon}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: form.projectType === t.id ? '#38bdf8' : '#f8fafc' }}>
                                            {t.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setStep(1)}>
                                    ← Volver
                                </Button>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    style={{ flex: 2 }}
                                    disabled={!form.projectName || !form.city}
                                    onClick={() => setStep(3)}
                                >
                                    Siguiente: Elegir Plan →
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: Plan Selection */}
                    {step === 3 && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                            <Badge color="#10b981" variant="filled" size="sm">PASO 3 DE 4</Badge>
                            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '10px 0 6px', color: '#f8fafc' }}>
                                Selección de Plan SaaS
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: '20px' }}>
                                Seleccioná el plan para tu prueba gratuita de 14 días con acceso a Meta Cloud API.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                                {[
                                    { id: 'starter', name: 'Starter ($29 USD/mes)', desc: '1 obra, 5 usuarios, WhatsApp + KYC + Gantt' },
                                    { id: 'professional', name: 'Professional ($99 USD/mes)', desc: '5 obras, 20 usuarios, Costos + Curva S + API + Portal Inversor' },
                                    { id: 'enterprise', name: 'Enterprise ($199 USD/mes)', desc: 'Obras ilimitadas, Multi-tenant, Soporte 24/7 SLA' }
                                ].map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => updateForm('plan', p.id)}
                                        style={{
                                            padding: '14px 16px',
                                            borderRadius: '10px',
                                            background: form.plan === p.id ? 'rgba(245, 158, 11, 0.12)' : 'rgba(6, 9, 19, 0.6)',
                                            border: form.plan === p.id ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: form.plan === p.id ? '#f59e0b' : '#f8fafc' }}>
                                                {p.name}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{p.desc}</div>
                                        </div>
                                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: form.plan === p.id ? '5px solid #f59e0b' : '2px solid rgba(255,255,255,0.2)' }} />
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setStep(2)}>
                                    ← Volver
                                </Button>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    style={{ flex: 2 }}
                                    onClick={() => setStep(4)}
                                >
                                    Siguiente: Conectar WhatsApp →
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: Meta WhatsApp Official Embedded Signup */}
                    {step === 4 && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                            <Badge color="#22c55e" variant="filled" size="sm">PASO 4 DE 4 (OFICIAL META)</Badge>
                            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '10px 0 6px', color: '#f8fafc' }}>
                                Conectar WhatsApp de la Constructora
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: '20px' }}>
                                Vinculá tu WhatsApp oficial a través del onboarding directo de Meta Tech Provider.
                            </p>

                            <div style={{ marginBottom: '24px' }}>
                                <WhatsAppEmbeddedSignup
                                    tenantSlug={form.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'empresa'}
                                    companyName={form.companyName || 'Constructora'}
                                    onConnected={() => handleSubmit()}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setStep(3)}>
                                    ← Volver
                                </Button>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    style={{ flex: 2 }}
                                    loading={isSubmitting}
                                    onClick={handleSubmit}
                                >
                                    {isSubmitting ? 'Finalizando...' : 'Finalizar y Entrar al Dashboard →'}
                                </Button>
                            </div>
                        </motion.div>
                    )}

                </GlassCard>
            </main>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Cargando configuración...
            </div>
        }>
            <OnboardingContent />
        </Suspense>
    );
}
