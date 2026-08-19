"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, PageHeader } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function PricingPage() {
    const [billingCycle, setBillingCycle] = useState('annual'); // 'monthly' | 'annual'
    const [activeFaq, setActiveFaq] = useState(null);
    const { isMobile } = useBreakpoint();

    const plans = [
        {
            id: 'starter',
            name: 'Starter',
            badge: 'Profesionales y Obras Medianas',
            monthlyPrice: 29,
            annualPrice: 23,
            description: 'Para directores de obra y estudios de arquitectura que buscan digitalizar su primera obra.',
            features: [
                '1 obra activa simultánea',
                'Hasta 5 usuarios de panel',
                'WhatsApp Bot IA ilimitado (voz + fotos)',
                'Gantt interactivo con avance dinámico',
                'KYC biométrico con DNI y validación facial',
                'Telemetría meteorológica CIRSOC 201',
                'Geocercas GPS para presentismo',
                'Auditoría criptográfica SHA-256'
            ],
            color: '#10b981',
            popular: false,
            cta: 'Comenzar Prueba Gratis'
        },
        {
            id: 'professional',
            name: 'Professional',
            badge: 'MÁS ELEGIDO',
            monthlyPrice: 99,
            annualPrice: 79,
            description: 'Para empresas constructoras en crecimiento con múltiples proyectos en simultáneo.',
            features: [
                'Hasta 5 obras activas',
                'Hasta 20 usuarios con roles y permisos',
                'Todo lo incluido en Starter, más:',
                'Control de Costos por Rubro & Curva S',
                'IA Predictiva de retrasos y desvíos',
                'Libro de Obra Digital oficial (Ley 22.250)',
                'Compliance CCT UOCRA & Alertas de ART',
                'Portal Vecino Digital para inversores',
                'API REST v1 pública y Webhooks'
            ],
            color: '#f59e0b',
            popular: true,
            cta: 'Comenzar con Professional'
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            badge: 'Corporativo & Gobiernos',
            monthlyPrice: 199,
            annualPrice: 159,
            description: 'Para desarrolladoras inmobiliarias de gran escala, corporaciones y licitaciones públicas.',
            features: [
                'Obras y proyectos ilimitados',
                'Usuarios y cuadrillas ilimitadas',
                'Todo lo incluido en Professional, más:',
                'Arquitectura Multi-tenant aislada',
                'Dashboard Ejecutivo CEO con KPIs consolidados',
                'SLA 99.9% de uptime garantizado',
                'Soporte técnico 24/7 con Account Manager',
                'Exportación fiscal AFIP / ARBA / IERIC',
                'Whitelabel con logo y dominio propio'
            ],
            color: '#8b5cf6',
            popular: false,
            cta: 'Hablar con un Especialista'
        }
    ];

    const faqs = [
        { q: '¿Hay un período de prueba gratis?', a: 'Sí, tenés 14 días de prueba completa con todas las funcionalidades activas en cualquier plan. No requerimos tarjeta de crédito para comenzar.' },
        { q: '¿Cómo funciona la interacción por WhatsApp?', a: 'Conectás tu número a través de la Meta Cloud API oficial. Tus albañiles y directores interactúan por notas de voz y fotos directamente desde su chat habitual sin instalar nada.' },
        { q: '¿Puedo cambiar de plan más adelante?', a: 'Por supuesto. Podés actualizar o cambiar de plan en cualquier momento desde tu panel de administración; el monto se ajustará automáticamente de manera proporcional.' },
        { q: '¿Qué medios de pago aceptan?', a: 'Aceptamos Mercado Pago, tarjetas de crédito/débito nacionales e internacionales (Visa, Mastercard, Amex) y transferencia bancaria con factura A o B.' },
        { q: '¿El Libro de Obra Digital es válido legalmente?', a: 'Sí. Cada registro diario incluye la nómina presente, órdenes de servicio, clima y avances firmados con algoritmo criptográfico SHA-256 inmutable conforme a la Ley 22.250 y Res. SRT 319/99.' }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Planes y Precios"
                subtitle="Sin costos ocultos. Elegí el plan que mejor se adapte a tu operación."
                breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Precios' }]}
                actions={
                    <Link href="/onboarding">
                        <Button variant="primary" size="sm">
                            Comenzar prueba gratis
                        </Button>
                    </Link>
                }
            />

            <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px 80px' }}>
                
                {/* Billing Toggle Header */}
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '0 0 12px', fontFamily: tokens.font.heading, letterSpacing: '-0.03em' }}>
                        Invertí en previsibilidad, evitá sobrecostos
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto 28px' }}>
                        Todas las suscripciones incluyen actualizaciones automáticas, copias de seguridad continuas y soporte.
                    </p>

                    {/* Toggle Button */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(15, 23, 42, 0.7)', padding: '6px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '12px',
                                border: 'none',
                                background: billingCycle === 'monthly' ? '#1e293b' : 'transparent',
                                color: billingCycle === 'monthly' ? '#f8fafc' : '#94a3b8',
                                fontSize: '0.88rem',
                                fontWeight: billingCycle === 'monthly' ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Facturación Mensual
                        </button>
                        <button
                            onClick={() => setBillingCycle('annual')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '12px',
                                border: 'none',
                                background: billingCycle === 'annual' ? '#f59e0b' : 'transparent',
                                color: billingCycle === 'annual' ? '#060913' : '#94a3b8',
                                fontSize: '0.88rem',
                                fontWeight: billingCycle === 'annual' ? 800 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>Facturación Anual</span>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(0,0,0,0.25)', borderRadius: '999px', color: '#fff', fontWeight: 800 }}>
                                20% OFF
                            </span>
                        </button>
                    </div>
                </div>

                {/* Plans Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', marginBottom: '80px', alignItems: 'stretch' }}>
                    {plans.map((plan) => {
                        const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                        return (
                            <GlassCard
                                key={plan.id}
                                style={{
                                    padding: '36px 32px',
                                    border: plan.popular ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: plan.popular ? 'rgba(245, 158, 11, 0.04)' : 'rgba(15, 23, 42, 0.65)',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                                hover
                                glow={plan.popular}
                            >
                                {plan.popular && (
                                    <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)' }}>
                                        <Badge color="#f59e0b" variant="solid" size="md">
                                            ★ {plan.badge}
                                        </Badge>
                                    </div>
                                )}

                                <div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: plan.popular ? '#f59e0b' : '#f8fafc', marginBottom: '4px' }}>
                                        {plan.name}
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 24px', lineHeight: 1.5, minHeight: '40px' }}>
                                        {plan.description}
                                    </p>

                                    {/* Price section */}
                                    <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                            <span style={{ fontSize: '3.2rem', fontWeight: 900, color: plan.popular ? '#f59e0b' : '#f8fafc', fontFamily: tokens.font.heading, letterSpacing: '-0.04em' }}>
                                                ${price}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>USD / mes</span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
                                            {billingCycle === 'annual' ? `Facturado anualmente ($${price * 12} USD/año)` : 'Facturado mes a mes'}
                                        </div>
                                    </div>

                                    {/* Features list */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>
                                            Incluye:
                                        </div>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {plan.features.map((feat, idx) => (
                                                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.86rem', color: feat.startsWith('Todo lo') ? '#f59e0b' : '#cbd5e1', lineHeight: 1.4 }}>
                                                    <span style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 800 }}>✓</span>
                                                    <span>{feat}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {/* Plan CTA button */}
                                <Link href={`/onboarding?plan=${plan.id}`} style={{ width: '100%' }}>
                                    <Button
                                        variant={plan.popular ? 'primary' : 'secondary'}
                                        size="lg"
                                        style={{ width: '100%' }}
                                    >
                                        {plan.cta}
                                    </Button>
                                </Link>
                            </GlassCard>
                        );
                    })}
                </div>

                {/* FAQs Section */}
                <div style={{ maxWidth: '860px', margin: '0 auto 80px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <Badge color="#06b6d4" variant="filled">PREGUNTAS FRECUENTES SOBRE PLANES</Badge>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '12px 0 0', fontFamily: tokens.font.heading }}>
                            ¿Tenés dudas sobre la contratación?
                        </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {faqs.map((faq, i) => {
                            const isOpen = activeFaq === i;
                            return (
                                <GlassCard
                                    key={i}
                                    style={{ padding: '20px 24px', cursor: 'pointer' }}
                                    onClick={() => setActiveFaq(isOpen ? null : i)}
                                    hover={false}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '0.96rem', fontWeight: 700, color: isOpen ? '#f59e0b' : '#f8fafc' }}>
                                            {faq.q}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '1.1rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                            ↓
                                        </span>
                                    </div>
                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25 }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6, margin: '14px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                                                    {faq.a}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </GlassCard>
                            );
                        })}
                    </div>
                </div>

                {/* Final Callout */}
                <GlassCard style={{ padding: '48px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '0 0 12px', fontFamily: tokens.font.heading }}>
                        ¿Tu constructora gestiona más de 10 obras o licitaciones públicas?
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 28px' }}>
                        Ofrecemos planes personalizados para organismos de gobierno y cámaras de construcción con acuerdos SLA y capacitación en campo.
                    </p>
                    <Link href="/onboarding?plan=enterprise">
                        <Button variant="primary" size="lg" icon="📞">
                            Solicitar Asesoramiento Corporativo
                        </Button>
                    </Link>
                </GlassCard>

            </main>
        </div>
    );
}
