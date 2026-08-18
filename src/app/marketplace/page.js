"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MarketplacePage() {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('todos');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/state').then(r => r.json()).then(state => {
            // Build providers from worker registry + default catalog
            const registry = (state.workerRegistry || []).filter(w => w.status === 'Proveedor');
            const catalog = [
                { id: 'p-1', name: 'Cementos Avellaneda', rubro: 'Materiales', rating: 4.8, city: 'Buenos Aires', phone: '+54 11 4444-5555', products: ['Cemento Portland', 'Cal Hidratada', 'Mortero'], leadTime: '24-48hs', priceRange: '$' },
                { id: 'p-2', name: 'Hierros Barilari', rubro: 'Estructura', rating: 4.5, city: 'Rosario', phone: '+54 341 555-6666', products: ['Hierro ADN420', 'Malla SIMA', 'Estribos'], leadTime: '48-72hs', priceRange: '$$' },
                { id: 'p-3', name: 'Sanitarios FV', rubro: 'Instalaciones', rating: 4.9, city: 'CABA', phone: '+54 11 7777-8888', products: ['Grifería', 'Sanitarios', 'Piletas'], leadTime: '5-7 días', priceRange: '$$$' },
                { id: 'p-4', name: 'Cerámicas San Lorenzo', rubro: 'Terminaciones', rating: 4.3, city: 'Mendoza', phone: '+54 261 999-0000', products: ['Porcellanato', 'Cerámicos', 'Mosaicos'], leadTime: '7-10 días', priceRange: '$$' },
                { id: 'p-5', name: 'Pinturas ALBA', rubro: 'Terminaciones', rating: 4.7, city: 'Buenos Aires', phone: '+54 11 2222-3333', products: ['Latex Interior', 'Membrana', 'Impermeabilizante'], leadTime: '24hs', priceRange: '$' },
                { id: 'p-6', name: 'Aluar Aberturas', rubro: 'Carpintería', rating: 4.6, city: 'Puerto Madryn', phone: '+54 280 444-5555', products: ['Ventanas DVH', 'Puertas Aluminio', 'Mamparas'], leadTime: '15-20 días', priceRange: '$$$' },
                ...registry.map(w => ({ id: w.id, name: w.name, rubro: w.trade || 'General', rating: 4.0, city: 'Local', phone: w.phone, products: [w.trade], leadTime: 'Consultar', priceRange: '$$' }))
            ];
            setProviders(catalog);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const rubros = ['todos', ...new Set(providers.map(p => p.rubro))];
    const filtered = providers
        .filter(p => filter === 'todos' || p.rubro === filter)
        .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.products.some(pr => pr.toLowerCase().includes(search.toLowerCase())));

    if (loading) return <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Cargando marketplace...</div>;

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
            <header style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>🏪 Marketplace de Proveedores</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>Directorio verificado — cotizá y contratá directo</p>
                </div>
                <Link href="/dashboard" style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver</Link>
            </header>

            <main style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Search + Filter */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="🔍 Buscar proveedor o producto..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1, minWidth: '200px', padding: '10px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem' }} />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {rubros.map(r => (
                            <button key={r} onClick={() => setFilter(r)}
                                style={{ padding: '8px 14px', background: filter === r ? '#f59e0b' : '#1e293b', color: filter === r ? '#0f172a' : '#94a3b8', border: '1px solid #334155', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: filter === r ? 700 : 400 }}>
                                {r === 'todos' ? '📦 Todos' : r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Provider Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {filtered.map(p => (
                        <div key={p.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px' }}>{p.name}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#172032', borderRadius: '10px', color: '#94a3b8' }}>{p.rubro}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#f59e0b', fontWeight: 700 }}>★ {p.rating}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.priceRange}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>
                                📍 {p.city} • ⏱ {p.leadTime}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                                {p.products.slice(0, 3).map((pr, i) => (
                                    <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#0f172a', borderRadius: '6px', color: '#cbd5e1' }}>{pr}</span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a href={`https://wa.me/${p.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                                    style={{ flex: 1, padding: '8px', background: '#22c55e', color: '#fff', borderRadius: '6px', textAlign: 'center', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
                                    📱 WhatsApp
                                </a>
                                <button style={{ flex: 1, padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                                    📋 Pedir Cotización
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        No se encontraron proveedores para "{search || filter}"
                    </div>
                )}
            </main>
        </div>
    );
}
