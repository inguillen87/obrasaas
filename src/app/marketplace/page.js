"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    tokens, 
    Badge, 
    Button, 
    GlassCard, 
    StatCard, 
    ProgressBar, 
    Tabs, 
    PageHeader, 
    Modal, 
    EmptyState 
} from '@/lib/design-system';

// Formateadores monetarios
const formatARS = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
const formatUSD = (val, rate = 1250) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val / rate);

// Catálogo base de proveedores y corralones homologados
const INITIAL_PROVIDERS = [
    { 
        id: 'p-1', 
        name: 'Cementos Avellaneda S.A.', 
        rubro: 'Materiales & Áridos', 
        rating: 4.9, 
        city: 'Buenos Aires (GBA / CABA)', 
        phone: '5491144445555', 
        leadTime: '24-48 hs', 
        priceRange: '$$', 
        verified: true,
        certifications: ['IRAM 1669', 'ISO 9001:2015'],
        coverageRadius: 'Hasta 60 km',
        freightPolicy: 'Flete bonificado en compras > $ 2.500.000',
        products: [
            { name: 'Cemento Portland Normal CP40 (50kg)', price: 9850, unit: 'bolsa' },
            { name: 'Cal Hidratada Extra (30kg)', price: 4600, unit: 'bolsa' },
            { name: 'Mortero Listo de Albañilería (25kg)', price: 5400, unit: 'bolsa' }
        ]
    },
    { 
        id: 'p-2', 
        name: 'AceroRed & Hierros Barilari', 
        rubro: 'Aceros & Armaduras', 
        rating: 4.8, 
        city: 'Rosario / San Nicolás / CABA', 
        phone: '5493415556666', 
        leadTime: '48-72 hs', 
        priceRange: '$$', 
        verified: true,
        certifications: ['INTI / CIRSOC 201', 'ISO 14001'],
        coverageRadius: 'Radio nacional / Flota pesada',
        freightPolicy: 'Flete con semirremolque según tonelaje',
        products: [
            { name: 'Barra Hierro ADN 420 ø12mm x 12m', price: 16800, unit: 'barra' },
            { name: 'Barra Hierro ADN 420 ø8mm x 12m', price: 7950, unit: 'barra' },
            { name: 'Malla Electrosoldada SIMA 15x15 ø6mm (2.4x6m)', price: 46200, unit: 'panel' },
            { name: 'Alambre recocido N° 16', price: 3400, unit: 'kg' }
        ]
    },
    { 
        id: 'p-3', 
        name: 'Hormigonera LomaMix Industrial', 
        rubro: 'Hormigón Elaborado', 
        rating: 4.9, 
        city: 'Campana / Tigre / Escobar / CABA', 
        phone: '5491133334444', 
        leadTime: '24 hs programada', 
        priceRange: '$$$', 
        verified: true,
        certifications: ['IRAM 1666', 'Planta Automatizada H-30'],
        coverageRadius: 'Hasta 40 km (radio de fraguado)',
        freightPolicy: 'Incluye motohormigonero y bomba telescópica 28m',
        products: [
            { name: 'Hormigón Elaborado H-21 Asentamiento 10', price: 132000, unit: 'm³' },
            { name: 'Hormigón Estructural H-30 Bombeado', price: 154000, unit: 'm³' },
            { name: 'Servicio de Bombeo Adicional', price: 380000, unit: 'servicio' }
        ]
    },
    { 
        id: 'p-4', 
        name: 'Sanitarios FV & Cañerías Tigre', 
        rubro: 'Instalaciones', 
        rating: 4.9, 
        city: 'CABA / Vicente López', 
        phone: '5491177778888', 
        leadTime: '24-48 hs', 
        priceRange: '$$$', 
        verified: true,
        certifications: ['IRAM / Enargas', 'Garantía 10 años'],
        coverageRadius: 'Todo AMBA',
        freightPolicy: 'Entrega sin cargo en obra',
        products: [
            { name: 'Caño Awaduct ø110 x 4m c/ junta labiada', price: 28400, unit: 'tira' },
            { name: 'Caño Termofusión Saladillo ø20 x 4m', price: 9200, unit: 'tira' },
            { name: 'Grifería Monocomando Lavatorio FV Pampa', price: 78500, unit: 'un' }
        ]
    },
    { 
        id: 'p-5', 
        name: 'Cerámicas & Revestimientos San Lorenzo', 
        rubro: 'Terminaciones & Revestimientos', 
        rating: 4.7, 
        city: 'Mendoza / San Luis / CABA', 
        phone: '5492619990000', 
        leadTime: '3-5 días', 
        priceRange: '$$', 
        verified: true,
        certifications: ['Norma IRAM 11591', 'Primera Selección'],
        coverageRadius: 'Red de distribución nacional',
        freightPolicy: 'Descarga en pallet flejado',
        products: [
            { name: 'Porcelanato Rectificado 60x120 Calacatta', price: 29500, unit: 'm²' },
            { name: 'Cerámica Esmaltada 45x45 Gris Cemento', price: 13800, unit: 'm²' },
            { name: 'Pegamento Weber Impermeable x 30kg', price: 11200, unit: 'bolsa' }
        ]
    },
    { 
        id: 'p-6', 
        name: 'Aluar & Vidrios Blindex Austral', 
        rubro: 'Carpinterías & Vidrios', 
        rating: 4.8, 
        city: 'Puerto Madryn / La Plata / CABA', 
        phone: '5492804445555', 
        leadTime: '15-20 días fábrica', 
        priceRange: '$$$', 
        verified: true,
        certifications: ['Aluminio Primario Aluar', 'Vidrio Laminado IRAM 12595'],
        coverageRadius: 'AMBA & Gran La Plata',
        freightPolicy: 'Caballetes de transporte protegidos',
        products: [
            { name: 'Ventana Corrediza Módena DVH 1.50 x 1.10m', price: 285000, unit: 'un' },
            { name: 'Puerta Balcón A30 New 2.00 x 2.20m DVH 4+4', price: 640000, unit: 'un' }
        ]
    }
];

// Matriz comparativa de cotizaciones para compras críticas
const COMPARATOR_ITEMS = [
    {
        id: 'cmp-1',
        title: 'Cemento Portland Normal CP40 — Pedido Masivo 500 Bolsas',
        rubro: 'Materiales & Áridos',
        cantidadRequerida: '500 bolsas (25 Tn)',
        plazoLimite: 'Entrega en 48 hs para Losa Nivel +4',
        oferentes: [
            {
                id: 'of-1',
                proveedor: 'Cementos Avellaneda S.A.',
                precioUnitario: 9850,
                costoFlete: 0,
                fleteNota: 'Bonificado por > $2.5M',
                plazoEntrega: '24 hs hábiles',
                condicionPago: 'eCheq 30/60 días sin interés',
                descuentoContado: '4%',
                totalNeto: 4925000,
                dispersionVsPromedio: -7.2,
                esRecomendada: true,
                razon: 'Menor costo integral, flete bonificado y financiación con eCheq'
            },
            {
                id: 'of-2',
                proveedor: 'Corralón Central Belgrano',
                precioUnitario: 10400,
                costoFlete: 180000,
                fleteNota: 'Flete con camión volcador y pluma',
                plazoEntrega: '48 hs',
                condicionPago: 'Transferencia anticipada 100%',
                descuentoContado: '2%',
                totalNeto: 5380000,
                dispersionVsPromedio: +2.1,
                esRecomendada: false,
                razon: 'Precio de lista superior y flete con cargo'
            },
            {
                id: 'of-3',
                proveedor: 'Distribuidora Loma Materiales',
                precioUnitario: 10200,
                costoFlete: 220000,
                fleteNota: 'Descarga a pie de obra',
                plazoEntrega: '72 hs',
                condicionPago: 'eCheq 30 días',
                descuentoContado: '0%',
                totalNeto: 5320000,
                dispersionVsPromedio: +1.0,
                esRecomendada: false,
                razon: 'Plazo de entrega excede ventana óptima de colada'
            }
        ]
    },
    {
        id: 'cmp-2',
        title: 'Hierro de Construcción ADN 420 ø12mm — 250 Barras de 12m',
        rubro: 'Aceros & Armaduras',
        cantidadRequerida: '250 barras (2.66 Tn)',
        plazoLimite: 'Entrega en 72 hs para armado de vigas',
        oferentes: [
            {
                id: 'of-4',
                proveedor: 'AceroRed & Hierros Barilari',
                precioUnitario: 16800,
                costoFlete: 95000,
                fleteNota: 'Semirremolque c/ grúa pluma',
                plazoEntrega: '48 hs hábiles',
                condicionPago: 'eCheq 30 días',
                descuentoContado: '5%',
                totalNeto: 4295000,
                dispersionVsPromedio: -5.8,
                esRecomendada: true,
                razon: 'Acero certificado INTI, barra entera sin empalmes y mejor tasa'
            },
            {
                id: 'of-5',
                proveedor: 'Siderurgia & Acero Directo',
                precioUnitario: 17400,
                costoFlete: 120000,
                fleteNota: 'Flete tercerizado',
                plazoEntrega: '4 días',
                condicionPago: 'Contado contra entrega',
                descuentoContado: '3%',
                totalNeto: 4470000,
                dispersionVsPromedio: +2.4,
                esRecomendada: false,
                razon: 'No ofrece plazo eCheq para constructoras'
            },
            {
                id: 'of-6',
                proveedor: 'Hierros del Plata S.R.L.',
                precioUnitario: 17150,
                costoFlete: 140000,
                fleteNota: 'Descarga con hidrogrua 15m',
                plazoEntrega: '3 días',
                condicionPago: 'eCheq 45 días',
                descuentoContado: '0%',
                totalNeto: 4427500,
                dispersionVsPromedio: +0.8,
                esRecomendada: false,
                razon: 'Costo de flete encarece la partida total'
            }
        ]
    }
];

// Órdenes de Compra y remitos en tracking
const INITIAL_PURCHASE_ORDERS = [
    {
        id: 'OC-2026-104',
        proveedor: 'Hormigonera LomaMix Industrial',
        rubro: 'Hormigón Elaborado',
        fechaEmision: '15/09/2026',
        items: '45 m³ Hormigón H-21 + Bomba Pluma 28m',
        montoTotal: 6320000,
        condicionPago: 'eCheq 30 días',
        step: 3, // 1: Emitida, 2: En Preparación, 3: En Tránsito, 4: Recibida en Obra
        estadoTexto: 'Camión mixer en viaje (GPS en ruta)',
        eta: 'Hoy 14:30 hs',
        remitoNro: 'REM-009142',
        chofer: 'Marcelo Fernández (Scania P360 / Dominio AF-281-KM)',
        conformado: false
    },
    {
        id: 'OC-2026-103',
        proveedor: 'AceroRed & Hierros Barilari',
        rubro: 'Aceros & Armaduras',
        fechaEmision: '12/09/2026',
        items: '200 barras ø12mm + 150 barras ø8mm + 40 paneles SIMA',
        montoTotal: 6140000,
        condicionPago: 'eCheq 30/60 días',
        step: 4,
        estadoTexto: 'Conformado y Acopiado en Subsuelo',
        eta: 'Entregado 14/09 11:00 hs',
        remitoNro: 'REM-008740',
        chofer: 'Darío Benítez (Iveco Stralis / Dominio AD-902-PO)',
        conformado: true,
        receptor: 'Capataz Miguel Silva',
        hashFirma: 'c8f3b219e4a0...d18e'
    },
    {
        id: 'OC-2026-102',
        proveedor: 'Cementos Avellaneda S.A.',
        rubro: 'Materiales & Áridos',
        fechaEmision: '10/09/2026',
        items: '300 bolsas Cemento CP40 + 100 bolsas Cal Hidratada',
        montoTotal: 3415000,
        condicionPago: 'Contado -4%',
        step: 4,
        estadoTexto: 'Conformado y Acopiado en Depósito',
        eta: 'Entregado 11/09 09:30 hs',
        remitoNro: 'REM-008612',
        chofer: 'Juan Carlos Gómez (Mercedes 1620 / Dominio AB-443-TT)',
        conformado: true,
        receptor: 'Encargado de Depósito Roberto',
        hashFirma: 'e4d7a881f9b3...201c'
    },
    {
        id: 'OC-2026-101',
        proveedor: 'Sanitarios FV & Cañerías Tigre',
        rubro: 'Instalaciones',
        fechaEmision: '14/09/2026',
        items: 'Lote Cañerías Awaduct ø110 + Codos 87° + Ramales',
        montoTotal: 1890000,
        condicionPago: 'eCheq 30 días',
        step: 2,
        estadoTexto: 'En Preparación de Depósito Central',
        eta: 'Mañana 09:00 hs',
        remitoNro: 'REM-PROV-0041',
        chofer: 'A confirmar por proveedor',
        conformado: false
    }
];

export default function MarketplacePage() {
    const [activeTab, setActiveTab] = useState('directorio');
    const [providers, setProviders] = useState(INITIAL_PROVIDERS);
    const [comparatorItems] = useState(COMPARATOR_ITEMS);
    const [purchaseOrders, setPurchaseOrders] = useState(INITIAL_PURCHASE_ORDERS);
    const [filterRubro, setFilterRubro] = useState('todos');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Modal RFQ
    const [rfqModal, setRfqModal] = useState({ show: false, provider: null });
    const [rfqDetails, setRfqDetails] = useState({ material: '', quantity: '', deliveryDate: '', notes: '', payment: 'eCheq 30 días' });
    const [rfqSent, setRfqSent] = useState(false);

    // Modal Remito
    const [remitoModal, setRemitoModal] = useState({ show: false, order: null });

    // Toast Copiado
    const [toastMessage, setToastMessage] = useState('');

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Filtros de proveedores
    const rubrosDisponibles = ['todos', ...new Set(INITIAL_PROVIDERS.map(p => p.rubro))];
    const filteredProviders = providers
        .filter(p => filterRubro === 'todos' || p.rubro === filterRubro)
        .filter(p => {
            if (!search) return true;
            const term = search.toLowerCase();
            return p.name.toLowerCase().includes(term) ||
                p.city.toLowerCase().includes(term) ||
                p.rubro.toLowerCase().includes(term) ||
                p.products.some(pr => pr.name.toLowerCase().includes(term));
        });

    // Manejo de envío de RFQ
    const handleSendRfq = (e) => {
        e.preventDefault();
        setRfqSent(true);
        setTimeout(() => {
            setRfqSent(false);
            setRfqModal({ show: false, provider: null });
            showToast(`✅ Cotización formal enviada con éxito a ${rfqModal.provider?.name || 'Proveedor'}`);
            setRfqDetails({ material: '', quantity: '', deliveryDate: '', notes: '', payment: 'eCheq 30 días' });
        }, 1500);
    };

    // Tabs definition
    const tabsList = [
        { id: 'directorio', label: '🛒 Directorio de Proveedores', badge: filteredProviders.length },
        { id: 'comparador', label: '📊 Comparador Multioferta', badge: comparatorItems.length },
        { id: 'ordenes', label: '📦 Órdenes de Compra & Tracking', badge: purchaseOrders.length },
        { id: 'rfq_express', label: '⚡ RFQ Express & WhatsApp', badge: 3 }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Marketplace & Procurement Hub Oficial de Obra"
                subtitle="Directorio homologado IRAM/ISO, cotizador comparativo multioferta y tracking digital de remitos"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Marketplace' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => {
                                setRfqModal({ show: true, provider: providers[0] });
                            }}
                        >
                            + Nueva Solicitud RFQ
                        </Button>
                        <Link href="/presupuesto">
                            <Button variant="secondary" size="sm">Ir a Presupuestos</Button>
                        </Link>
                        <Link href="/dashboard">
                            <Button variant="outline" size="sm">← Volver al Dashboard</Button>
                        </Link>
                    </div>
                }
            />

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 80px' }}>
                
                {/* Top StatCards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    <StatCard 
                        label="PROVEEDORES HOMOLOGADOS" 
                        value={`${providers.length} Empresas`} 
                        sub="100% verificados con CUIT & IRAM" 
                        icon="🏢" 
                        color="#10b981" 
                    />
                    <StatCard 
                        label="ÓRDENES ACTIVAS EN TRÁNSITO" 
                        value={formatARS(purchaseOrders.reduce((acc, o) => acc + o.montoTotal, 0))} 
                        sub={`${purchaseOrders.length} OCs registradas`} 
                        icon="📦" 
                        color="#3b82f6" 
                    />
                    <StatCard 
                        label="DISPERSIÓN PRECIOS DETECTADA" 
                        value="14.8% Ahorro" 
                        sub="Optimización vía Comparador Multioferta" 
                        icon="📉" 
                        color="#f59e0b" 
                    />
                    <StatCard 
                        label="ENTREGA PROMEDIO EN OBRA" 
                        value="36 Horas" 
                        sub="SLA 98.4% de cumplimiento" 
                        icon="⏱️" 
                        color="#8b5cf6" 
                    />
                </div>

                {/* Tabs Switcher */}
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <Tabs 
                        tabs={tabsList} 
                        activeTab={activeTab} 
                        onChange={setActiveTab} 
                        color="#10b981" 
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <span>Obra Asignada:</span>
                        <strong style={{ color: '#f8fafc' }}>Torre Libertador Park</strong>
                        <span style={{ color: '#10b981' }}>● Logística Activa</span>
                    </div>
                </div>

                {/* Toast Message */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid #10b981',
                                color: '#a7f3d0',
                                padding: '12px 20px',
                                borderRadius: '10px',
                                marginBottom: '20px',
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <span>{toastMessage}</span>
                            <button onClick={() => setToastMessage('')} style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer' }}>✕</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========================================================================= */}
                {/* TAB 1: DIRECTORIO DE PROVEEDORES HOMOLOGADOS */}
                {/* ========================================================================= */}
                {activeTab === 'directorio' && (
                    <motion.div
                        key="tab-directorio"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Buscador y Filtros */}
                        <GlassCard style={{ padding: '16px 20px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1, minWidth: '280px' }}>
                                    <input 
                                        type="text"
                                        placeholder="Buscar por insumo, corralón, certificación o zona de entrega..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            borderRadius: '8px',
                                            color: '#f8fafc',
                                            fontSize: '0.88rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
                                    {rubrosDisponibles.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setFilterRubro(r)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: filterRubro === r ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                                                background: filterRubro === r ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                                color: filterRubro === r ? '#34d399' : '#94a3b8',
                                                fontSize: '0.78rem',
                                                fontWeight: filterRubro === r ? 700 : 500,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {r === 'todos' ? 'Todos los Rubros' : r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </GlassCard>

                        {/* Grid de Proveedores */}
                        {filteredProviders.length === 0 ? (
                            <EmptyState
                                title="No se encontraron proveedores"
                                description={`No existen corralones homologados con los términos "${search}".`}
                                action={
                                    <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilterRubro('todos'); }}>
                                        Limpiar Filtros
                                    </Button>
                                }
                            />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                                {filteredProviders.map(p => (
                                    <GlassCard key={p.id} style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            {/* Cabecera Proveedor */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                                            {p.name}
                                                        </h3>
                                                        {p.verified && (
                                                            <span title="Homologado ObraSaaS" style={{ color: '#10b981', fontSize: '0.9rem', cursor: 'help' }}>✓</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                        <Badge color="#10b981" variant="subtle" size="xs">{p.rubro}</Badge>
                                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>📍 {p.city}</span>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.92rem' }}>★ {p.rating}</div>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Rango {p.priceRange}</span>
                                                </div>
                                            </div>

                                            {/* Certificaciones y Cobertura */}
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                                {p.certifications?.map((c, i) => (
                                                    <span key={i} style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#93c5fd', borderRadius: '6px' }}>
                                                        🛡️ {c}
                                                    </span>
                                                ))}
                                                <span style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#6ee7b7', borderRadius: '6px' }}>
                                                    🚚 {p.coverageRadius}
                                                </span>
                                            </div>

                                            {/* Política de Flete y Plazo */}
                                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '0.76rem' }}>
                                                <div style={{ color: '#cbd5e1', marginBottom: '4px' }}>
                                                    ⏱ Plazo de Entrega: <strong style={{ color: '#f8fafc' }}>{p.leadTime}</strong>
                                                </div>
                                                <div style={{ color: '#94a3b8' }}>
                                                    📦 {p.freightPolicy}
                                                </div>
                                            </div>

                                            {/* Catálogo Testigo de Precios */}
                                            <div style={{ marginBottom: '18px' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
                                                    Precios Testigo de Referencia:
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {p.products.map((pr, idx) => (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: '6px' }}>
                                                            <span style={{ color: '#cbd5e1' }}>{pr.name}</span>
                                                            <span style={{ color: '#10b981', fontWeight: 700 }}>{formatARS(pr.price)} <span style={{ color: '#64748b', fontSize: '0.68rem' }}>/{pr.unit}</span></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Botones de Acción */}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                            <a
                                                href={`https://wa.me/${p.phone}?text=${encodeURIComponent(`Hola ${p.name}, los contacto desde ObraSaaS para solicitar cotización formal de materiales para la obra Torre Libertador Park.`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ flex: 1, textDecoration: 'none' }}
                                            >
                                                <Button variant="whatsapp" size="sm" style={{ width: '100%' }}>
                                                    WhatsApp Directo
                                                </Button>
                                            </a>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                style={{ flex: 1 }}
                                                onClick={() => {
                                                    setRfqModal({ show: true, provider: p });
                                                }}
                                            >
                                                Solicitar RFQ
                                            </Button>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: COMPARADOR MULTIOFERTA */}
                {/* ========================================================================= */}
                {activeTab === 'comparador' && (
                    <motion.div
                        key="tab-comparador"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                            {comparatorItems.map((item) => (
                                <GlassCard key={item.id} style={{ padding: '24px' }}>
                                    {/* Cabecera del Ítem */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Badge color="#3b82f6" variant="filled" size="sm">{item.rubro}</Badge>
                                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                                    {item.title}
                                                </h3>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                <span>📦 Cantidad Requerida: <strong style={{ color: '#f8fafc' }}>{item.cantidadRequerida}</strong></span>
                                                <span>⏱ Ventana Crítica: <strong style={{ color: '#f59e0b' }}>{item.plazoLimite}</strong></span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Badge color="#10b981" variant="subtle" size="sm">
                                                3 Ofertas Recibidas
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Columnas Comparativas Lado a Lado */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                        {item.oferentes.map((of) => (
                                            <div 
                                                key={of.id}
                                                style={{
                                                    background: of.esRecomendada ? 'rgba(16, 185, 129, 0.06)' : 'rgba(15, 23, 42, 0.6)',
                                                    border: of.esRecomendada ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '12px',
                                                    padding: '18px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    position: 'relative'
                                                }}
                                            >
                                                {of.esRecomendada && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '-11px',
                                                        right: '16px',
                                                        background: '#10b981',
                                                        color: '#060913',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 800,
                                                        padding: '3px 10px',
                                                        borderRadius: '999px',
                                                        letterSpacing: '0.04em'
                                                    }}>
                                                        ⭐ MEJOR OFERTA RECOMENDADA
                                                    </div>
                                                )}

                                                <div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                                                        {of.proveedor}
                                                    </div>
                                                    
                                                    {/* Dispersión */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                                        <Badge 
                                                            color={of.dispersionVsPromedio < 0 ? '#10b981' : '#f59e0b'} 
                                                            variant="subtle" 
                                                            size="xs"
                                                        >
                                                            {of.dispersionVsPromedio < 0 ? `${of.dispersionVsPromedio}% vs promedio` : `+${of.dispersionVsPromedio}% vs promedio`}
                                                        </Badge>
                                                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Descuento: {of.descuentoContado}</span>
                                                    </div>

                                                    {/* Desglose Económico */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', marginBottom: '16px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#94a3b8' }}>Precio Unitario:</span>
                                                            <strong style={{ color: '#f8fafc' }}>{formatARS(of.precioUnitario)}</strong>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#94a3b8' }}>Flete / Logística:</span>
                                                            <strong style={{ color: of.costoFlete === 0 ? '#10b981' : '#f8fafc' }}>
                                                                {of.costoFlete === 0 ? 'Bonificado' : formatARS(of.costoFlete)}
                                                            </strong>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#94a3b8' }}>Plazo en Obra:</span>
                                                            <span style={{ color: '#f8fafc' }}>{of.plazoEntrega}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#94a3b8' }}>Condición Comercial:</span>
                                                            <span style={{ color: '#cbd5e1' }}>{of.condicionPago}</span>
                                                        </div>
                                                    </div>

                                                    {/* Justificación IA */}
                                                    <div style={{ fontSize: '0.72rem', color: of.esRecomendada ? '#a7f3d0' : '#94a3b8', background: of.esRecomendada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)', padding: '8px 10px', borderRadius: '6px', marginBottom: '14px' }}>
                                                        💡 {of.razon}
                                                    </div>
                                                </div>

                                                {/* Monto Total & CTA */}
                                                <div>
                                                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', marginBottom: '12px' }}>
                                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>TOTAL NETO COTIZADO:</div>
                                                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: of.esRecomendada ? '#10b981' : '#f8fafc' }}>
                                                            {formatARS(of.totalNeto)}
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                            ≈ {formatUSD(of.totalNeto)}
                                                        </div>
                                                    </div>

                                                    <Button 
                                                        variant={of.esRecomendada ? 'primary' : 'secondary'} 
                                                        size="sm" 
                                                        style={{ width: '100%' }}
                                                        onClick={() => {
                                                            showToast(`Orden de Compra generada para ${of.proveedor} por ${formatARS(of.totalNeto)}`);
                                                        }}
                                                    >
                                                        {of.esRecomendada ? '⚡ Adjudicar & Emitir OC' : 'Seleccionar Oferente'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 3: ÓRDENES DE COMPRA & TRACKING DE REMITOS */}
                {/* ========================================================================= */}
                {activeTab === 'ordenes' && (
                    <motion.div
                        key="tab-ordenes"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {purchaseOrders.map((order) => (
                                <GlassCard key={order.id} style={{ padding: '22px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                                                    {order.id}
                                                </span>
                                                <Badge color="#3b82f6" variant="subtle" size="xs">{order.rubro}</Badge>
                                                <Badge 
                                                    color={order.step === 4 ? '#10b981' : order.step === 3 ? '#3b82f6' : '#f59e0b'} 
                                                    variant="filled" 
                                                    size="xs"
                                                >
                                                    {order.step === 4 ? 'Conformado en Obra' : order.step === 3 ? 'En Tránsito' : 'En Preparación'}
                                                </Badge>
                                            </div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#cbd5e1', marginTop: '4px' }}>
                                                {order.proveedor}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                                {order.items}
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>MONTO COMPROMETIDO:</div>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>
                                                {formatARS(order.montoTotal)}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                Condición: {order.condicionPago}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stepper de Seguimiento Logístico */}
                                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.74rem', color: '#94a3b8' }}>
                                            <span style={{ color: order.step >= 1 ? '#10b981' : '#64748b', fontWeight: 700 }}>1. Emitida</span>
                                            <span style={{ color: order.step >= 2 ? '#10b981' : '#64748b', fontWeight: 700 }}>2. En Preparación</span>
                                            <span style={{ color: order.step >= 3 ? '#3b82f6' : '#64748b', fontWeight: 700 }}>3. En Tránsito / GPS</span>
                                            <span style={{ color: order.step >= 4 ? '#10b981' : '#64748b', fontWeight: 700 }}>4. Conformada en Obra</span>
                                        </div>
                                        <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                width: `${(order.step / 4) * 100}%`, 
                                                background: order.step === 4 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #10b981)', 
                                                transition: 'width 0.4s ease' 
                                            }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.76rem' }}>
                                            <span style={{ color: '#cbd5e1' }}>
                                                📍 Estado actual: <strong style={{ color: '#f8fafc' }}>{order.estadoTexto}</strong>
                                            </span>
                                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                                ⏱ ETA: {order.eta}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info Chofer y Remito */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.76rem', color: '#94a3b8' }}>
                                        <div>
                                            <span>Remito Oficial: <strong style={{ color: '#f8fafc' }}>{order.remitoNro}</strong></span>
                                            <span style={{ margin: '0 8px' }}>•</span>
                                            <span>Chofer: <span style={{ color: '#cbd5e1' }}>{order.chofer}</span></span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Button 
                                                variant="secondary" 
                                                size="xs"
                                                onClick={() => {
                                                    setRemitoModal({ show: true, order });
                                                }}
                                            >
                                                📄 Ver Remito Digital
                                            </Button>
                                            <a
                                                href={`https://wa.me/5491144445555?text=${encodeURIComponent(`Hola, consulto por estado de entrega de la Orden ${order.id} (${order.items}) con remito ${order.remitoNro}.`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <Button variant="whatsapp" size="xs">
                                                    Consultar WhatsApp
                                                </Button>
                                            </a>
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 4: RFQ EXPRESS & WHATSAPP MASIVO */}
                {/* ========================================================================= */}
                {activeTab === 'rfq_express' && (
                    <motion.div
                        key="tab-rfq-express"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
                            {/* Panel Izquierdo: Lanzador de Cotización */}
                            <GlassCard style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '1.4rem' }}>⚡</span>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                            Lanzador de Cotización Express
                                        </h3>
                                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                                            Dispara la misma solicitud de precio simultáneamente a 3 corralones oficiales
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Material o Insumo Requerido *</label>
                                        <input 
                                            type="text"
                                            value={rfqDetails.material || 'Cemento Portland CP40 x 300 bolsas + Cal x 100 bolsas'}
                                            onChange={e => setRfqDetails({ ...rfqDetails, material: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '8px',
                                                color: '#f8fafc',
                                                fontSize: '0.86rem',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Fecha Máxima en Obra</label>
                                            <input 
                                                type="text"
                                                value="En 48 hs hábiles"
                                                readOnly
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    background: 'rgba(15, 23, 42, 0.8)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    borderRadius: '8px',
                                                    color: '#f8fafc',
                                                    fontSize: '0.86rem',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Forma de Pago Propuesta</label>
                                            <input 
                                                type="text"
                                                value="eCheq 30/60 días"
                                                readOnly
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    background: 'rgba(15, 23, 42, 0.8)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    borderRadius: '8px',
                                                    color: '#f8fafc',
                                                    fontSize: '0.86rem',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Vista Previa Mensaje WhatsApp Formal</label>
                                        <div style={{
                                            padding: '14px',
                                            background: 'rgba(15, 23, 42, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            color: '#cbd5e1',
                                            lineHeight: 1.5,
                                            fontFamily: 'monospace'
                                        }}>
                                            Estimados, solicitamos cotización urgente para *Torre Libertador Park*:<br/>
                                            • Insumos: Cemento CP40 (300 un) + Cal (100 un)<br/>
                                            • Plazo: Entrega en 48 hs a pie de obra<br/>
                                            • Pago: eCheq 30/60 días o Contado con descuento<br/>
                                            • Dirección: Av. Del Libertador 4850, CABA.<br/>
                                            Favor de responder con precio unitario final + flete.
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Panel Derecho: Corralones Destinatarios */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                                    Corralones Seleccionados para Despacho
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {[
                                        { name: 'Cementos Avellaneda S.A.', phone: '5491144445555', avgResponse: '14 min', status: 'En Línea' },
                                        { name: 'Corralón Central Belgrano', phone: '5491188889999', avgResponse: '28 min', status: 'En Línea' },
                                        { name: 'Distribuidora Loma Materiales', phone: '5491122221111', avgResponse: '45 min', status: 'Horario Comercial' }
                                    ].map((c, i) => (
                                        <div 
                                            key={i}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '10px',
                                                padding: '14px 16px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                                                    {c.name}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                                    ⏱ Tiempo de respuesta típico: <strong style={{ color: '#10b981' }}>{c.avgResponse}</strong>
                                                </div>
                                            </div>

                                            <a
                                                href={`https://wa.me/${c.phone}?text=${encodeURIComponent(`Estimados ${c.name}, solicitamos cotización formal urgente para Torre Libertador Park:\n• Insumos: Cemento CP40 (300 un) + Cal (100 un)\n• Plazo: Entrega en 48 hs a pie de obra\n• Pago: eCheq 30/60 días o Contado con descuento\n• Dirección: Av. Del Libertador 4850, CABA.\nFavor de responder con precio unitario final + flete.`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <Button variant="whatsapp" size="xs">
                                                    Enviar WhatsApp
                                                </Button>
                                            </a>
                                        </div>
                                    ))}

                                    <Button 
                                        variant="primary" 
                                        size="md" 
                                        style={{ marginTop: '12px' }}
                                        onClick={() => {
                                            showToast('🚀 RFQ masivo registrado en el Libro de Compras y notificado a los 3 proveedores');
                                        }}
                                    >
                                        Disparar Cotización a Todos (1-Clic)
                                    </Button>
                                </div>
                            </GlassCard>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Modal para Solicitud de Cotización (RFQ) */}
            <Modal
                isOpen={rfqModal.show}
                onClose={() => setRfqModal({ show: false, provider: null })}
                title={`Solicitud de Cotización Formal (RFQ)`}
                subtitle={`Destinatario: ${rfqModal.provider?.name || 'Proveedor Oficial'}`}
            >
                {rfqSent ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#10b981' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>✅</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>¡RFQ Registrada con Éxito!</h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
                            Se ha notificado al proveedor y se generó el registro en la Matriz Comparativa.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSendRfq} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                                Materiales / Insumos Requeridos *
                            </label>
                            <input
                                required
                                placeholder="Ej: 500 bolsas Cemento Portland Normal CP40"
                                value={rfqDetails.material}
                                onChange={e => setRfqDetails({ ...rfqDetails, material: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                                    Cantidad Estimada *
                                </label>
                                <input
                                    required
                                    placeholder="Ej: 500 bolsas / 25 Tn"
                                    value={rfqDetails.quantity}
                                    onChange={e => setRfqDetails({ ...rfqDetails, quantity: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                                    Plazo Máximo en Obra
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: 48 hs hábiles"
                                    value={rfqDetails.deliveryDate}
                                    onChange={e => setRfqDetails({ ...rfqDetails, deliveryDate: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                                Requisitos Especiales de Descarga
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Indicar si se requiere hidrogrua, descarga en subsuelo, etc."
                                value={rfqDetails.notes}
                                onChange={e => setRfqDetails({ ...rfqDetails, notes: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc', resize: 'none', boxSizing: 'border-box' }}
                            />
                        </div>

                        <Button variant="primary" size="md" style={{ width: '100%', marginTop: '8px' }}>
                            Emitir Pedido de Cotización Formal
                        </Button>
                    </form>
                )}
            </Modal>

            {/* Modal para Ver Remito Digital */}
            <Modal
                isOpen={remitoModal.show}
                onClose={() => setRemitoModal({ show: false, order: null })}
                title={`Remito Digital de Recepción — ${remitoModal.order?.remitoNro || ''}`}
                subtitle={`Orden de Compra: ${remitoModal.order?.id || ''} | Obra: Torre Libertador Park`}
            >
                {remitoModal.order && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: '#060913', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>PROVEEDOR EMISOR:</span>
                                <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>{remitoModal.order.proveedor}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>INSUMOS CONSIGNADOS:</span>
                                <strong style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>{remitoModal.order.items}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TRANSPORTE / CHOFER:</span>
                                <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{remitoModal.order.chofer}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ESTADO DE CONFORMIDAD:</span>
                                <Badge color={remitoModal.order.conformado ? '#10b981' : '#f59e0b'} variant="filled" size="xs">
                                    {remitoModal.order.conformado ? 'Firmado & Conforme' : 'Pendiente de Descarga'}
                                </Badge>
                            </div>
                        </div>

                        {remitoModal.order.conformado && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', borderRadius: '10px', padding: '14px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 700, marginBottom: '4px' }}>
                                    ✓ RECEPCIÓN CONFORME EN OBRA
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                                    Recibido por: <strong>{remitoModal.order.receptor}</strong>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
                                    Firma Digital SHA-256: {remitoModal.order.hashFirma}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Button 
                                variant="primary" 
                                size="sm" 
                                style={{ flex: 1 }}
                                onClick={() => {
                                    window.print();
                                }}
                            >
                                🖨️ Imprimir Remito
                            </Button>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                style={{ flex: 1 }}
                                onClick={() => setRemitoModal({ show: false, order: null })}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

