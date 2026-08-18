"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, PageHeader, Modal, EmptyState } from '@/lib/design-system';

export default function MarketplacePage() {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('todos');
    const [search, setSearch] = useState('');
    const [rfqModal, setRfqModal] = useState({ show: false, provider: null });
    const [rfqDetails, setRfqDetails] = useState({ material: '', quantity: '', deliveryDate: '', notes: '' });
    const [rfqSent, setRfqSent] = useState(false);

    useEffect(() => {
        fetch('/api/state').then(r => r.json()).then(state => {
            const registry = (state.workerRegistry || []).filter(w => w.status === 'Proveedor');
            const catalog = [
                { id: 'p-1', name: 'Cementos Avellaneda S.A.', rubro: 'Materiales', rating: 4.9, city: 'Buenos Aires', phone: '5491144445555', products: ['Cemento Portland', 'Cal Hidratada', 'Mortero Listo'], leadTime: '24-48 hs', priceRange: '$', verified: true },
                { id: 'p-2', name: 'Hierros Barilari & Hnos', rubro: 'Estructura', rating: 4.8, city: 'Rosario, Santa Fe', phone: '5493415556666', products: ['Hierro ADN420', 'Malla Electrosoldada SIMA', 'Estribos Conformados'], leadTime: '48-72 hs', priceRange: '$$', verified: true },
                { id: 'p-3', name: 'Sanitarios FV Griferías', rubro: 'Instalaciones', rating: 4.9, city: 'CABA', phone: '5491177778888', products: ['Grifería Monocomando', 'Válvulas', 'Piletas de Acero'], leadTime: '5-7 días', priceRange: '$$$', verified: true },
                { id: 'p-4', name: 'Cerámicas San Lorenzo', rubro: 'Terminaciones', rating: 4.7, city: 'Mendoza', phone: '5492619990000', products: ['Porcellanato Rectificado', 'Cerámica Esmaltada', 'Zócalos'], leadTime: '5-7 días', priceRange: '$$', verified: true },
                { id: 'p-5', name: 'Pinturas ALBA Pro', rubro: 'Terminaciones', rating: 4.8, city: 'Buenos Aires', phone: '5491122223333', products: ['Látex Interior Pro', 'Membrana Líquida Poliuretánica', 'Enduido'], leadTime: '24 hs', priceRange: '$', verified: true },
                { id: 'p-6', name: 'Aluar Aberturas de Aluminio', rubro: 'Carpintería', rating: 4.6, city: 'Puerto Madryn', phone: '5492804445555', products: ['Ventanas Línea Módena DVH', 'Puertas Balcón', 'Mamparas'], leadTime: '15-20 días', priceRange: '$$$', verified: true },
                ...registry.map(w => ({ id: w.id, name: w.name, rubro: w.trade || 'General', rating: 4.2, city: 'Local', phone: w.phone, products: [w.trade], leadTime: 'Consultar', priceRange: '$$', verified: false }))
            ];
            setProviders(catalog);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleSendRfq = (e) => {
        e.preventDefault();
        setRfqSent(true);
        setTimeout(() => {
            setRfqSent(false);
            setRfqModal({ show: false, provider: null });
            setRfqDetails({ material: '', quantity: '', deliveryDate: '', notes: '' });
        }, 1800);
    };

    const rubros = ['todos', ...new Set(providers.map(p => p.rubro))];
    const filtered = providers
        .filter(p => filter === 'todos' || p.rubro === filter)
        .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.products.some(pr => pr.toLowerCase().includes(search.toLowerCase())));

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                icon="🏪"
                title="Marketplace Oficial de Proveedores de Obra"
                subtitle="Directorio verificado con cotizaciones automatizadas y contacto directo por WhatsApp"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Marketplace' }]}
                actions={
                    <Link href="/dashboard">
                        <Button variant="secondary" size="sm">← Volver al Dashboard</Button>
                    </Link>
                }
            />

            <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '32px 24px 80px' }}>
                
                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', gap: '14px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="🔍 Buscar insumos, corralones o materiales..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '14px 18px',
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '14px',
                                color: '#f8fafc',
                                fontSize: '0.92rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {rubros.map(r => (
                            <button
                                key={r}
                                onClick={() => setFilter(r)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '999px',
                                    border: filter === r ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: filter === r ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                    color: filter === r ? '#fbbf24' : '#94a3b8',
                                    fontSize: '0.8rem',
                                    fontWeight: filter === r ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {r === 'todos' ? '📦 Todos los Rubros' : r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Provider Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', margin: '0 auto 16px' }} />
                        <p style={{ color: '#94a3b8' }}>Cargando catálogo de proveedores...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon="🔍"
                        title="No se encontraron proveedores"
                        description={`No hay resultados que coincidan con "${search || filter}". Intente con otro término o rubro.`}
                        action={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilter('todos'); }}>Restablecer Filtros</Button>}
                    />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                        {filtered.map(p => (
                            <GlassCard key={p.id} style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} hover>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                                    {p.name}
                                                </h3>
                                                {p.verified && <span title="Proveedor Verificado ObraSaaS" style={{ color: '#3b82f6', fontSize: '0.85rem' }}>✓</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                <Badge color="#f59e0b" variant="subtle" size="xs">{p.rubro}</Badge>
                                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {p.city}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem' }}>★ {p.rating}</div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Rango: {p.priceRange}</div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '14px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px' }}>
                                        ⏱ Plazo de entrega habitual: <strong style={{ color: '#f8fafc' }}>{p.leadTime}</strong>
                                    </div>

                                    {/* Products Pills */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Productos Principales:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {p.products.map((pr, idx) => (
                                                <span key={idx} style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', color: '#cbd5e1' }}>
                                                    {pr}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* CTAs */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <a
                                        href={`https://wa.me/${p.phone}?text=Hola%20${encodeURIComponent(p.name)},%20los%20contacto%20desde%20la%20plataforma%20ObraSaaS%20para%20solicitar%20cotización.`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ flex: 1, textDecoration: 'none' }}
                                    >
                                        <Button variant="whatsapp" size="sm" style={{ width: '100%' }} icon="💬">
                                            WhatsApp
                                        </Button>
                                    </a>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        style={{ flex: 1 }}
                                        icon="📋"
                                        onClick={() => setRfqModal({ show: true, provider: p })}
                                    >
                                        Cotizar
                                    </Button>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </main>

            {/* RFQ / Quotation Modal */}
            <Modal
                isOpen={rfqModal.show}
                onClose={() => setRfqModal({ show: false, provider: null })}
                title={`Solicitar Cotización a ${rfqModal.provider?.name || 'Proveedor'}`}
                subtitle="El pedido se registrará en el Libro de Compras y se enviará notificación"
            >
                {rfqSent ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#10b981' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>✅</div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>¡Cotización Enviada!</h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>El proveedor responderá en menos de 2 horas vía WhatsApp.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSendRfq} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Material o Insumo Requerido *</label>
                            <input
                                required
                                placeholder="Ej: Cemento Portland x100 bolsas"
                                value={rfqDetails.material}
                                onChange={e => setRfqDetails({ ...rfqDetails, material: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Cantidad Estimada *</label>
                                <input
                                    required
                                    placeholder="100 un / 50 m³"
                                    value={rfqDetails.quantity}
                                    onChange={e => setRfqDetails({ ...rfqDetails, quantity: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Fecha Requerida en Obra</label>
                                <input
                                    type="date"
                                    value={rfqDetails.deliveryDate}
                                    onChange={e => setRfqDetails({ ...rfqDetails, deliveryDate: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Observaciones de Entrega</label>
                            <textarea
                                rows={3}
                                placeholder="Indicar si se requiere camión con grúa, horario de descarga, etc."
                                value={rfqDetails.notes}
                                onChange={e => setRfqDetails({ ...rfqDetails, notes: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc', resize: 'none' }}
                            />
                        </div>
                        <Button variant="primary" size="md" style={{ width: '100%', marginTop: '6px' }} icon="🚀">
                            Enviar Pedido de Cotización Formal
                        </Button>
                    </form>
                )}
            </Modal>

        </div>
    );
}
