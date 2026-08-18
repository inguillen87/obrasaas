"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        companyName: '', ownerName: '', email: '', phone: '', plan: 'professional',
        projectName: '', city: '', address: '', projectType: 'edificio',
        expectedWorkers: 10, startDate: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const slug = form.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
                setCompleted(true);
            } else {
                const err = await res.json();
                alert(err.error || 'Error al crear la cuenta');
            }
        } catch (err) {
            console.error('Onboarding error:', err);
            alert('Error de conexión. Intentá de nuevo.');
        }
        setIsSubmitting(false);
    };

    const projectTypes = [
        { id: 'edificio', label: '🏢 Edificio / Torre', icon: '🏢' },
        { id: 'casa', label: '🏠 Vivienda Unifamiliar', icon: '🏠' },
        { id: 'refaccion', label: '🔧 Refacción / Remodelación', icon: '🔧' },
        { id: 'obra_publica', label: '🏛️ Obra Pública', icon: '🏛️' },
        { id: 'industrial', label: '🏭 Nave Industrial', icon: '🏭' },
        { id: 'barrio', label: '🏘️ Barrio / Loteo', icon: '🏘️' }
    ];

    const inputStyle = { width: '100%', padding: '14px 16px', background: '#0f172a', border: '1px solid #475569', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' };

    if (completed) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center', maxWidth: '520px', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
                    <h1 style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: 800, marginBottom: '12px' }}>¡Bienvenido a ObraSaaS!</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '32px' }}>
                        Tu cuenta y primera obra están listas. Ya podés empezar a gestionar con WhatsApp + IA.
                    </p>
                    <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155', marginBottom: '24px', textAlign: 'left' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>Tu workspace:</p>
                        <p style={{ color: '#f59e0b', fontSize: '1.1rem', fontWeight: 700 }}>{form.companyName.toLowerCase().replace(/\s+/g, '-')}.obrasaas.app</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <Link href="/dashboard" style={{ padding: '14px 28px', background: '#f59e0b', color: '#0f172a', borderRadius: '10px', fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}>
                            Ir al Dashboard →
                        </Link>
                        <Link href="/api-docs" style={{ padding: '14px 28px', background: '#334155', color: '#f8fafc', borderRadius: '10px', fontWeight: 600, textDecoration: 'none', fontSize: '1rem' }}>
                            Ver API Docs
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            {/* Header */}
            <header style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🏗️</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>ObraSaaS</span>
                </div>
                <Link href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver al inicio</Link>
            </header>

            <main style={{ maxWidth: '580px', margin: '0 auto', padding: '20px' }}>
                {/* Progress Steps */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
                    {[1, 2, 3].map(s => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: step >= s ? '#f59e0b' : '#334155', color: step >= s ? '#0f172a' : '#94a3b8',
                                fontWeight: 700, fontSize: '0.9rem'
                            }}>{s}</div>
                            <span style={{ color: step >= s ? '#f8fafc' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                                {s === 1 ? 'Empresa' : s === 2 ? 'Primera Obra' : 'Plan'}
                            </span>
                            {s < 3 && <div style={{ width: '40px', height: '2px', background: step > s ? '#f59e0b' : '#334155' }} />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Company */}
                {step === 1 && (
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Datos de tu empresa</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Creá tu cuenta en 2 minutos. Sin tarjeta de crédito.</p>
                        <input placeholder="Nombre de la empresa / estudio" value={form.companyName} onChange={e => updateForm('companyName', e.target.value)} style={inputStyle} />
                        <input placeholder="Tu nombre completo" value={form.ownerName} onChange={e => updateForm('ownerName', e.target.value)} style={inputStyle} />
                        <input placeholder="Email" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} style={inputStyle} />
                        <input placeholder="WhatsApp (+54 9 261 316-8608)" value={form.phone} onChange={e => updateForm('phone', e.target.value)} style={inputStyle} />
                        <button onClick={() => step < 3 && setStep(2)} disabled={!form.companyName || !form.email}
                            style={{ width: '100%', padding: '16px', background: form.companyName && form.email ? '#f59e0b' : '#475569', color: '#0f172a', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: '8px' }}>
                            Siguiente →
                        </button>
                    </div>
                )}

                {/* Step 2: First Project */}
                {step === 2 && (
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Tu primera obra</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Configurá la obra que vas a gestionar primero.</p>
                        <input placeholder="Nombre de la obra" value={form.projectName} onChange={e => updateForm('projectName', e.target.value)} style={inputStyle} />
                        <input placeholder="Ciudad" value={form.city} onChange={e => updateForm('city', e.target.value)} style={inputStyle} />
                        <input placeholder="Dirección" value={form.address} onChange={e => updateForm('address', e.target.value)} style={inputStyle} />
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>Tipo de obra:</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                            {projectTypes.map(pt => (
                                <button key={pt.id} onClick={() => updateForm('projectType', pt.id)}
                                    style={{
                                        padding: '12px 8px', background: form.projectType === pt.id ? '#f59e0b' : '#1e293b',
                                        color: form.projectType === pt.id ? '#0f172a' : '#f8fafc', border: form.projectType === pt.id ? '2px solid #f59e0b' : '1px solid #334155',
                                        borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center'
                                    }}>
                                    <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{pt.icon}</div>
                                    {pt.label.split(' ').slice(1).join(' ')}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>← Atrás</button>
                            <button onClick={() => setStep(3)} disabled={!form.projectName} style={{ flex: 2, padding: '14px', background: form.projectName ? '#f59e0b' : '#475569', color: '#0f172a', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Siguiente →</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Plan */}
                {step === 3 && (
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Elegí tu plan</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>14 días gratis en cualquier plan. Sin tarjeta.</p>
                        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                            {[
                                { id: 'starter', name: 'Starter', price: 29, obras: '1', users: '5', features: ['WhatsApp Bot', 'Gantt', 'KYC', 'Clima'] },
                                { id: 'professional', name: 'Professional', price: 99, obras: '5', users: '20', features: ['+ Control Costos', '+ IA Predictiva', '+ API REST', '+ Certificaciones'], recommended: true },
                                { id: 'enterprise', name: 'Enterprise', price: 199, obras: '∞', users: '∞', features: ['+ Multi-Tenant', '+ SSO', '+ SLA 99.9%', '+ Soporte Dedicado'] }
                            ].map(plan => (
                                <button key={plan.id} onClick={() => updateForm('plan', plan.id)}
                                    style={{
                                        padding: '20px', background: form.plan === plan.id ? '#1e293b' : '#0f172a',
                                        border: form.plan === plan.id ? '2px solid #f59e0b' : '1px solid #334155',
                                        borderRadius: '12px', cursor: 'pointer', textAlign: 'left', position: 'relative'
                                    }}>
                                    {plan.recommended && <span style={{ position: 'absolute', top: '-10px', right: '12px', background: '#f59e0b', color: '#0f172a', padding: '2px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>RECOMENDADO</span>}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.1rem' }}>{plan.name}</span>
                                        <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.3rem' }}>${plan.price}<span style={{ fontSize: '0.75rem', color: '#64748b' }}>/mes</span></span>
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px' }}>{plan.obras} obras • {plan.users} usuarios</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {plan.features.map((f, i) => (
                                            <span key={i} style={{ background: '#0f172a', color: '#94a3b8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>{f}</span>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setStep(2)} style={{ flex: 1, padding: '14px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>← Atrás</button>
                            <button onClick={handleSubmit} disabled={isSubmitting}
                                style={{ flex: 2, padding: '14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                                {isSubmitting ? '⏳ Creando tu workspace...' : '🚀 Crear Cuenta Gratis'}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
