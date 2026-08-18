"use client";
import Link from 'next/link';

export default function PricingPage() {
    const plans = [
        {
            id: 'starter', name: 'Starter', price: 29, period: '/mes',
            description: 'Para profesionales independientes y obras pequeñas',
            features: ['1 obra activa', '5 usuarios', 'WhatsApp Bot IA', 'Gantt interactivo', 'KYC biométrico (DNI+Selfie)', 'Clima CIRSOC satelital', 'Geocerca GPS', 'Auditoría SHA-256'],
            cta: 'Empezar Gratis', color: '#22c55e', popular: false
        },
        {
            id: 'professional', name: 'Professional', price: 99, period: '/mes',
            description: 'Para estudios de arquitectura y constructoras medianas',
            features: ['5 obras activas', '20 usuarios', 'Todo de Starter +', 'Control de Costos por Rubro', 'IA Predictiva de retrasos', 'Certificaciones de avance PDF', 'API REST pública', 'Webhooks de eventos', 'Libro de Obra Digital (Ley 22.250)', 'UOCRA CCT compliance', 'Portal del Inversor'],
            cta: 'Elegir Professional', color: '#3b82f6', popular: true
        },
        {
            id: 'enterprise', name: 'Enterprise', price: 199, period: '/mes',
            description: 'Para grandes constructoras, desarrolladoras y gobiernos',
            features: ['Obras ilimitadas', 'Usuarios ilimitados', 'Todo de Professional +', 'Multi-tenant (sub-empresas)', 'SSO / SAML', 'SLA 99.9% garantizado', 'Soporte dedicado 24/7', 'Dashboard ejecutivo multi-obra', 'Integración AFIP/ARBA', 'Whitelabel (tu marca)', 'Onboarding personalizado'],
            cta: 'Contactar Ventas', color: '#a855f7', popular: false
        }
    ];

    const faqs = [
        { q: '¿Hay un período de prueba gratis?', a: 'Sí, 14 días gratis en cualquier plan. Sin tarjeta de crédito.' },
        { q: '¿Puedo cambiar de plan después?', a: 'Sí, podés upgradear o downgradear en cualquier momento. El cambio se prorratea.' },
        { q: '¿Cómo funciona el WhatsApp Bot?', a: 'Conectás tu número de WhatsApp Business. Los operarios envían mensajes al bot para fichaje, reportes y consultas. El director gestiona todo desde WhatsApp.' },
        { q: '¿Necesito instalar una app?', a: 'No. ObraSaaS es 100% web + WhatsApp. Funciona en cualquier celular sin descargar nada. También se instala como PWA.' },
        { q: '¿Qué pasa con mis datos si cancelo?', a: 'Tenés 30 días para exportar tus datos. Después de ese período se eliminan permanentemente.' },
        { q: '¿Aceptan Mercado Pago?', a: 'Sí, aceptamos Mercado Pago, tarjetas de crédito/débito y transferencia bancaria.' }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            {/* Header */}
            <header style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#f8fafc' }}>
                    <span style={{ fontSize: '1.5rem' }}>🏗️</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>ObraSaaS</span>
                </Link>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link href="/onboarding" style={{ padding: '10px 20px', background: '#f59e0b', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>Empezar Gratis</Link>
                </div>
            </header>

            <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
                {/* Hero */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '12px' }}>Planes para cada tipo de obra</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Desde el profesional independiente hasta la constructora con 50 obras. 14 días gratis.
                    </p>
                </div>

                {/* Plans Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '64px' }}>
                    {plans.map((plan, i) => (
                        <div key={i} style={{
                            background: '#1e293b', borderRadius: '16px', padding: plan.popular ? '32px 28px' : '28px',
                            border: plan.popular ? '2px solid #f59e0b' : '1px solid #334155', position: 'relative',
                            transform: plan.popular ? 'scale(1.05)' : 'none'
                        }}>
                            {plan.popular && (
                                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#0f172a', padding: '4px 16px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    MÁS POPULAR
                                </div>
                            )}
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px', color: plan.color }}>{plan.name}</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '16px' }}>{plan.description}</p>
                            <div style={{ marginBottom: '20px' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800 }}>${plan.price}</span>
                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}> USD{plan.period}</span>
                            </div>
                            <Link href="/onboarding" style={{
                                display: 'block', textAlign: 'center', padding: '14px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '1rem', marginBottom: '20px',
                                background: plan.popular ? '#f59e0b' : plan.color, color: plan.popular ? '#0f172a' : '#fff'
                            }}>
                                {plan.cta}
                            </Link>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {plan.features.map((f, j) => (
                                    <li key={j} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: f.startsWith('Todo de') ? '#f59e0b' : '#cbd5e1' }}>
                                        <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Comparison with Competitors */}
                <div style={{ background: '#1e293b', borderRadius: '16px', padding: '32px', border: '1px solid #334155', marginBottom: '48px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '20px', textAlign: 'center' }}>🏆 ¿Por qué ObraSaaS?</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        {[
                            { icon: '📱', title: 'WhatsApp First', desc: '96% de penetración en Argentina. No necesitás descargar nada.' },
                            { icon: '🤖', title: 'IA que trabaja por vos', desc: 'GPT-4o analiza fotos, OCR de DNI, predice retrasos y avance.' },
                            { icon: '🇦🇷', title: 'Hecho para Argentina', desc: 'UOCRA, ART, AFIP, CIRSOC nativos. No es un producto traducido.' },
                            { icon: '💰', title: '10x más barato', desc: 'Procore cuesta $500+/mes. ObraSaaS desde $29/mes.' },
                            { icon: '📖', title: 'Libro de Obra Legal', desc: 'Ley 22.250 con firma SHA-256. Válido para SRT e IERIC.' },
                            { icon: '🔐', title: 'Auditoría inmutable', desc: 'Blockchain-like con SHA-256. Cada acción queda certificada.' }
                        ].map((item, i) => (
                            <div key={i} style={{ padding: '16px', background: '#0f172a', borderRadius: '10px' }}>
                                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '8px', marginBottom: '4px' }}>{item.title}</h4>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FAQs */}
                <div style={{ marginBottom: '48px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '20px', textAlign: 'center' }}>❓ Preguntas Frecuentes</h2>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {faqs.map((faq, i) => (
                            <div key={i} style={{ background: '#1e293b', borderRadius: '10px', padding: '20px', border: '1px solid #334155' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>{faq.q}</h4>
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div style={{ textAlign: 'center', padding: '48px', background: 'linear-gradient(135deg, #1e293b, #172032)', borderRadius: '16px', border: '1px solid #334155' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px' }}>¿Listo para transformar tu obra?</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Empezá gratis en 2 minutos. Sin tarjeta de crédito.</p>
                    <Link href="/onboarding" style={{ padding: '16px 40px', background: '#f59e0b', color: '#0f172a', borderRadius: '12px', fontWeight: 800, fontSize: '1.1rem', textDecoration: 'none', display: 'inline-block' }}>
                        🚀 Crear Cuenta Gratis
                    </Link>
                </div>
            </main>

            <footer style={{ textAlign: 'center', padding: '24px', color: '#475569', fontSize: '0.75rem' }}>
                © {new Date().getFullYear()} ObraSaaS — La plataforma #1 de gestión de obra en LATAM
            </footer>
        </div>
    );
}
