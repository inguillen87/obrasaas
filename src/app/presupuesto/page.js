"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    tokens, 
    Badge, 
    Button, 
    GlassCard, 
    StatCard, 
    PageHeader, 
    ProgressBar, 
    Tabs, 
    Modal 
} from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

// Ítems iniciales de cómputo métrico
const INITIAL_ITEMS = [
    { id: 'IT-01', rubro: 'Preliminares', descripcion: 'Replanteo planialtimétrico, cerco perimetral de obra y cartelería reglamentaria', unidad: 'm2', cantidad: 450, precioUnitario: 8500 },
    { id: 'IT-02', rubro: 'Movimiento de Suelos', descripcion: 'Excavación mecánica para fundaciones, retiro de tierra y compactación', unidad: 'm3', cantidad: 320, precioUnitario: 24000 },
    { id: 'IT-03', rubro: 'Estructuras', descripcion: 'Estructura de Hormigón Armado H-30 bombeado (bases, columnas, vigas y losas)', unidad: 'm3', cantidad: 180, precioUnitario: 215000 },
    { id: 'IT-04', rubro: 'Cerramientos', descripcion: 'Mampostería de ladrillo cerámico hueco 18x18x33 con azotado hidrófugo exterior', unidad: 'm2', cantidad: 1250, precioUnitario: 18500 },
    { id: 'IT-05', rubro: 'Instalaciones', descripcion: 'Instalación Sanitaria completa & pluviales en polipropileno alta resistencia Awaduct', unidad: 'gl', cantidad: 1, precioUnitario: 14200000 },
    { id: 'IT-06', rubro: 'Construcción en Seco', descripcion: 'Tabiques divisorios y cielorrasos suspendidos Durlock con aislación de lana de vidrio', unidad: 'm2', cantidad: 890, precioUnitario: 16800 },
    { id: 'IT-07', rubro: 'Carpinterías', descripcion: 'Carpinterías de Aluminio Negro Anodizado Línea A30 New con DVH 4+12+4', unidad: 'm2', cantidad: 110, precioUnitario: 85000 },
    { id: 'IT-08', rubro: 'Terminaciones', descripcion: 'Piso porcellanato rectificado 60x120 símil hormigón y zócalos de madera', unidad: 'm2', cantidad: 480, precioUnitario: 28500 },
    { id: 'IT-09', rubro: 'Terminaciones', descripcion: 'Pintura Látex Interior Lavable Pro a 3 manos y esmalte sintético sobre herrería', unidad: 'm2', cantidad: 1600, precioUnitario: 6800 },
    { id: 'IT-10', rubro: 'Final de Obra', descripcion: 'Limpieza profunda de obra, retiro de contenedores y puesta en marcha final', unidad: 'gl', cantidad: 1, precioUnitario: 3200000 }
];

const HISTORIAL_PROPUESTAS = [
    { id: 'COT-2026-089', cliente: 'Fideicomiso Residencial Park', monto: 146820000, fecha: 'Hoy 11:30', status: 'Enviada', canal: 'WhatsApp Web' },
    { id: 'COT-2026-088', cliente: 'Estudio Baudizzone Arqs', monto: 88400000, fecha: 'Ayer 17:00', status: 'Aprobada', canal: 'Email Oficial' },
    { id: 'COT-2026-087', cliente: 'Desarrollos Libertador SA', monto: 215000000, fecha: '12 Sep 2026', status: 'En Negociación', canal: 'WhatsApp Web' },
    { id: 'COT-2026-086', cliente: 'Grupo Habitat Urbano', monto: 64200000, fecha: '08 Sep 2026', status: 'Aprobada', canal: 'Plataforma Portal' }
];

export default function Presupuesto() {
    const { isMobile } = useBreakpoint();

    // Tabs state
    const [activeTab, setActiveTab] = useState('computo');

    // Cómputo state
    const [items, setItems] = useState(INITIAL_ITEMS);
    const [rubroFilter, setRubroFilter] = useState('todos');
    const [search, setSearch] = useState('');

    // Markups & Financial sliders
    const [gastosGeneralesPct, setGastosGeneralesPct] = useState(12);
    const [beneficioPct, setBeneficioPct] = useState(18);
    const [contingenciasPct, setContingenciasPct] = useState(5);
    const [cacAjustePct, setCacAjustePct] = useState(14.2);
    const [incluirIVA, setIncluirIVA] = useState(true);

    // Client and Project details
    const [clientDetails, setClientDetails] = useState({
        nombre: 'Fideicomiso Residencial Park',
        cuit: '30-71649988-2',
        proyecto: 'Torre Residencial Libertador Park',
        ubicacion: 'Av. Del Libertador 4850, CABA',
        superficieM2: 1450,
        contacto: 'Ing. Guillermo Valenzuela',
        telefono: '+54 9 11 4455-8899',
        email: 'g.valenzuela@residencialpark.com.ar',
        validezDias: 15
    });

    // Modals
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [newItem, setNewItem] = useState({
        rubro: 'Estructuras',
        descripcion: '',
        unidad: 'm2',
        cantidad: 100,
        precioUnitario: 25000
    });
    const [copiedProposal, setCopiedProposal] = useState(false);
    const [whatsAppDispatched, setWhatsAppDispatched] = useState(false);

    // Filter Rubros
    const rubrosDisponibles = ['todos', ...new Set(items.map(it => it.rubro))];

    const filteredItems = useMemo(() => {
        return items.filter(it => {
            const matchesRubro = rubroFilter === 'todos' || it.rubro === rubroFilter;
            const matchesSearch = !search || 
                it.descripcion.toLowerCase().includes(search.toLowerCase()) || 
                it.rubro.toLowerCase().includes(search.toLowerCase()) ||
                it.id.toLowerCase().includes(search.toLowerCase());
            return matchesRubro && matchesSearch;
        });
    }, [items, rubroFilter, search]);

    // Financial calculations
    const calculations = useMemo(() => {
        const costoDirecto = items.reduce((acc, it) => acc + (it.cantidad * it.precioUnitario), 0);
        const gastosGenerales = costoDirecto * (gastosGeneralesPct / 100);
        const subtotalCosto = costoDirecto + gastosGenerales;
        const beneficio = subtotalCosto * (beneficioPct / 100);
        const contingencias = subtotalCosto * (contingenciasPct / 100);
        const subtotalComercial = subtotalCosto + beneficio + contingencias;
        
        // Ajuste por CAC estimado
        const ajusteCac = subtotalComercial * (cacAjustePct / 100);
        const baseImponible = subtotalComercial + ajusteCac;
        
        // Impuestos IVA 21%
        const iva = incluirIVA ? baseImponible * 0.21 : 0;
        const totalFinal = baseImponible + iva;
        
        const margenEfectivoPct = totalFinal > 0 ? (beneficio / totalFinal) * 100 : 0;

        return {
            costoDirecto,
            gastosGenerales,
            subtotalCosto,
            beneficio,
            contingencias,
            subtotalComercial,
            ajusteCac,
            baseImponible,
            iva,
            totalFinal,
            margenEfectivoPct
        };
    }, [items, gastosGeneralesPct, beneficioPct, contingenciasPct, cacAjustePct, incluirIVA]);

    // Formatters
    const formatARS = (amount) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
    };

    const formatUSD = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount / 1250);
    };

    // Add item handler
    const handleAddItem = (e) => {
        e.preventDefault();
        if (!newItem.descripcion) return;
        const id = `IT-${String(items.length + 1).padStart(2, '0')}`;
        setItems(prev => [...prev, { id, ...newItem, cantidad: Number(newItem.cantidad), precioUnitario: Number(newItem.precioUnitario) }]);
        setNewItem({ rubro: 'Estructuras', descripcion: '', unidad: 'm2', cantidad: 100, precioUnitario: 25000 });
        setShowAddItemModal(false);
    };

    // Remove item handler
    const handleRemoveItem = (id) => {
        setItems(prev => prev.filter(it => it.id !== id));
    };

    // Tabs definition
    const tabsList = [
        { id: 'computo', label: '📋 Cómputo & Ítems', badge: items.length },
        { id: 'markups', label: '🎛️ Formación de Precios & Markups' },
        { id: 'propuesta', label: '📜 Propuesta Formal Cliente' },
        { id: 'whatsapp', label: '📱 Despacho WhatsApp', badge: 4 }
    ];

    // WhatsApp Message Text
    const whatsAppMessage = useMemo(() => {
        return `Estimado *${clientDetails.contacto}* (${clientDetails.nombre}):\n\n` +
            `Le compartimos la *Propuesta Económica & Cómputo Formal* para el proyecto *${clientDetails.proyecto}* (${clientDetails.superficieM2} m² cubiertos en ${clientDetails.ubicacion}).\n\n` +
            `• *Monto Total de Obra:* ${formatARS(calculations.totalFinal)} (IVA ${incluirIVA ? '21% Incluido' : 'Exento'})\n` +
            `• *Equivalente Dólar MEP:* ${formatUSD(calculations.totalFinal)}\n` +
            `• *Plazo de Ejecución:* 14 meses corridos en 4 hitos\n` +
            `• *Cláusula CAC:* Redeterminación Decreto 691/16\n` +
            `• *Validez de la Oferta:* ${clientDetails.validezDias} días corridos\n\n` +
            `Puede revisar el pliego interactivo y cronograma de desembolsos aquí:\n` +
            `https://obrasaas.vercel.app/presupuesto?ref=COT-2026-089\n\n` +
            `Quedamos a su disposición para coordinar la firma del contrato. Atte, Dirección Técnica ObraSaaS.`;
    }, [clientDetails, calculations, incluirIVA]);

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Presupuestador Inteligente & Propuestas Comerciales"
                subtitle="Generación dinámica de cómputos métricos, fijación paramétrica de márgenes y formalización de propuestas"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Presupuesto' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => {
                                window.print();
                            }}
                        >
                            🖨️ Imprimir / Guardar PDF
                        </Button>
                        <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => setShowAddItemModal(true)}
                        >
                            + Nuevo Ítem de Cómputo
                        </Button>
                        <Link href="/dashboard">
                            <Button variant="outline" size="sm">← Volver al Dashboard</Button>
                        </Link>
                    </div>
                }
            />

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 80px' }}>
                
                {/* Top KPI StatCards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    <StatCard 
                        label="PRESUPUESTO TOTAL COMERCIAL" 
                        value={formatARS(calculations.totalFinal)} 
                        sub={`≈ ${formatUSD(calculations.totalFinal)}`} 
                        icon="💰" 
                        color="#10b981" 
                    />
                    <StatCard 
                        label="COSTO DIRECTO DE OBRA" 
                        value={formatARS(calculations.costoDirecto)} 
                        sub={`${items.length} partidas presupuestarias`} 
                        icon="🏗️" 
                        color="#3b82f6" 
                    />
                    <StatCard 
                        label="MARGEN BRUTO CONSTRUCTORA" 
                        value={`${beneficioPct}% (${formatARS(calculations.beneficio)})`} 
                        sub={`Efectivo s/ total: ${calculations.margenEfectivoPct.toFixed(1)}%`} 
                        icon="📈" 
                        color="#f59e0b" 
                    />
                    <StatCard 
                        label="AJUSTE CAC & CONTINGENCIAS" 
                        value={formatARS(calculations.ajusteCac + calculations.contingencias)} 
                        sub={`CAC previsto ${cacAjustePct}%`} 
                        icon="🛡️" 
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
                        <span>Proyecto:</span>
                        <strong style={{ color: '#f8fafc' }}>{clientDetails.proyecto}</strong>
                        <span style={{ color: '#64748b' }}>({clientDetails.superficieM2} m²)</span>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: CÓMPUTO & ÍTEMS */}
                {/* ========================================================================= */}
                {activeTab === 'computo' && (
                    <motion.div
                        key="tab-computo"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Filtros y Buscador */}
                        <GlassCard style={{ padding: '16px 20px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                                <div style={{ flex: 1, minWidth: '260px' }}>
                                    <input 
                                        type="text"
                                        placeholder="Buscar por código, descripción o rubro constructivo..."
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

                                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                    {rubrosDisponibles.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setRubroFilter(r)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: rubroFilter === r ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                                                background: rubroFilter === r ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                                color: rubroFilter === r ? '#34d399' : '#94a3b8',
                                                fontSize: '0.78rem',
                                                fontWeight: rubroFilter === r ? 700 : 500,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {r === 'todos' ? 'Todos los Rubros' : r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </GlassCard>

                        {/* Tabla de Cómputo */}
                        <GlassCard style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '14px 18px' }}>Cód.</th>
                                            <th style={{ padding: '14px 18px' }}>Rubro</th>
                                            <th style={{ padding: '14px 18px' }}>Descripción Técnica</th>
                                            <th style={{ padding: '14px 18px', textAlign: 'right' }}>Cant.</th>
                                            <th style={{ padding: '14px 18px', textAlign: 'center' }}>Unid.</th>
                                            <th style={{ padding: '14px 18px', textAlign: 'right' }}>P. Unit Directo</th>
                                            <th style={{ padding: '14px 18px', textAlign: 'right' }}>Subtotal Directo</th>
                                            <th style={{ padding: '14px 18px', textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map((it, idx) => {
                                            const subtotal = it.cantidad * it.precioUnitario;
                                            return (
                                                <tr 
                                                    key={it.id}
                                                    style={{ 
                                                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                                                    }}
                                                >
                                                    <td style={{ padding: '14px 18px', fontFamily: tokens.font.mono, color: '#64748b', fontWeight: 600 }}>
                                                        {it.id}
                                                    </td>
                                                    <td style={{ padding: '14px 18px' }}>
                                                        <Badge color="#3b82f6" variant="subtle" size="xs">
                                                            {it.rubro}
                                                        </Badge>
                                                    </td>
                                                    <td style={{ padding: '14px 18px', color: '#f8fafc', fontWeight: 600, maxWidth: '380px' }}>
                                                        {it.descripcion}
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: tokens.font.mono, color: '#cbd5e1' }}>
                                                        {it.cantidad.toLocaleString('es-AR')}
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                                                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8' }}>
                                                            {it.unidad}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: tokens.font.mono, color: '#cbd5e1' }}>
                                                        {formatARS(it.precioUnitario)}
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: tokens.font.mono, color: '#10b981', fontWeight: 700 }}>
                                                        {formatARS(subtotal)}
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => handleRemoveItem(it.id)}
                                                            title="Eliminar ítem"
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: '#ef4444',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderTop: '2px solid rgba(255, 255, 255, 0.15)', fontWeight: 800 }}>
                                            <td colSpan="6" style={{ padding: '16px 18px', textAlign: 'right', color: '#94a3b8' }}>
                                                TOTAL COSTO DIRECTO DE CÓMPUTO:
                                            </td>
                                            <td style={{ padding: '16px 18px', textAlign: 'right', color: '#10b981', fontSize: '1.15rem' }}>
                                                {formatARS(calculations.costoDirecto)}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: FORMACIÓN DE PRECIOS & MARKUPS */}
                {/* ========================================================================= */}
                {activeTab === 'markups' && (
                    <motion.div
                        key="tab-markups"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                            
                            {/* Sliders de Markups */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                                    🎛️ Formación Financiera del Precio
                                </h3>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 24px' }}>
                                    Ajuste los multiplicadores y alícuotas que definen el precio final de venta al cliente.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    
                                    {/* Gastos Generales */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Gastos Generales de Obra (GG):</span>
                                            <strong style={{ color: '#f59e0b', fontFamily: tokens.font.mono }}>
                                                {gastosGeneralesPct}% ({formatARS(calculations.gastosGenerales)})
                                            </strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="25"
                                            step="0.5"
                                            value={gastosGeneralesPct}
                                            onChange={e => setGastosGeneralesPct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Estructura fija, capataz, fletes y seguros de obra</span>
                                    </div>

                                    {/* Beneficio Constructora */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Beneficio Constructora / Margen Neto:</span>
                                            <strong style={{ color: '#10b981', fontFamily: tokens.font.mono }}>
                                                {beneficioPct}% ({formatARS(calculations.beneficio)})
                                            </strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="35"
                                            step="0.5"
                                            value={beneficioPct}
                                            onChange={e => setBeneficioPct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Ganancia neta esperada sobre costo técnico</span>
                                    </div>

                                    {/* Contingencias */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Fondo de Imprevistos & Contingencias:</span>
                                            <strong style={{ color: '#8b5cf6', fontFamily: tokens.font.mono }}>
                                                {contingenciasPct}% ({formatARS(calculations.contingencias)})
                                            </strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="15"
                                            step="0.5"
                                            value={contingenciasPct}
                                            onChange={e => setContingenciasPct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Desvíos climáticos y variaciones geológicas de terreno</span>
                                    </div>

                                    {/* CAC Ajuste Estimado */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Indexación CAC Prevista (Decreto 691/16):</span>
                                            <strong style={{ color: '#38bdf8', fontFamily: tokens.font.mono }}>
                                                {cacAjustePct}% ({formatARS(calculations.ajusteCac)})
                                            </strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="30"
                                            step="0.5"
                                            value={cacAjustePct}
                                            onChange={e => setCacAjustePct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Variación estimada acumulada según Cámara Arg. Construcción</span>
                                    </div>

                                    {/* IVA Checkbox */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
                                                Incluir IVA (21%)
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                Monto impuesto: {formatARS(calculations.iva)}
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={incluirIVA}
                                            onChange={e => setIncluirIVA(e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                                        />
                                    </div>

                                </div>
                            </GlassCard>

                            {/* Resumen de Estructura de Precio & SVG */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <GlassCard style={{ padding: '24px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                        PRECIO TOTAL PROPUESTA COMERCIAL
                                    </div>
                                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981', fontFamily: tokens.font.heading, marginBottom: '6px' }}>
                                        {formatARS(calculations.totalFinal)}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '20px' }}>
                                        Costo por m² construido: <strong style={{ color: '#f8fafc' }}>{formatARS(calculations.totalFinal / clientDetails.superficieM2)}/m²</strong> (≈ {formatUSD(calculations.totalFinal / clientDetails.superficieM2)} USD/m²)
                                    </div>

                                    {/* SVG Stacked Bar */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                                            DESGLOSE PORCENTUAL DEL VALOR TOTAL:
                                        </div>
                                        <div style={{ width: '100%', height: '30px', borderRadius: '8px', overflow: 'hidden', background: '#0f172a', display: 'flex' }}>
                                            <div style={{ width: `${(calculations.costoDirecto / calculations.totalFinal) * 100}%`, background: '#3b82f6' }} title="Costo Directo" />
                                            <div style={{ width: `${(calculations.gastosGenerales / calculations.totalFinal) * 100}%`, background: '#f59e0b' }} title="Gastos Generales" />
                                            <div style={{ width: `${(calculations.beneficio / calculations.totalFinal) * 100}%`, background: '#10b981' }} title="Beneficio" />
                                            <div style={{ width: `${(calculations.contingencias / calculations.totalFinal) * 100}%`, background: '#8b5cf6' }} title="Contingencias" />
                                            <div style={{ width: `${(calculations.ajusteCac / calculations.totalFinal) * 100}%`, background: '#38bdf8' }} title="Ajuste CAC" />
                                            {incluirIVA && (
                                                <div style={{ width: `${(calculations.iva / calculations.totalFinal) * 100}%`, background: '#64748b' }} title="IVA 21%" />
                                            )}
                                        </div>

                                        {/* Legend */}
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.72rem', color: '#94a3b8' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} />
                                                Directo ({((calculations.costoDirecto / calculations.totalFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }} />
                                                GG ({((calculations.gastosGenerales / calculations.totalFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
                                                Beneficio ({((calculations.beneficio / calculations.totalFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#8b5cf6' }} />
                                                Imprevistos ({((calculations.contingencias / calculations.totalFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#38bdf8' }} />
                                                CAC ({((calculations.ajusteCac / calculations.totalFinal) * 100).toFixed(0)}%)
                                            </span>
                                            {incluirIVA && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#64748b' }} />
                                                    IVA ({((calculations.iva / calculations.totalFinal) * 100).toFixed(0)}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Breakdown details */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '10px', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                            <span>Subtotal Costo Directo:</span>
                                            <strong style={{ color: '#cbd5e1' }}>{formatARS(calculations.costoDirecto)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                            <span>Gastos Generales ({gastosGeneralesPct}%):</span>
                                            <strong style={{ color: '#cbd5e1' }}>{formatARS(calculations.gastosGenerales)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                            <span>Beneficio Constructora ({beneficioPct}%):</span>
                                            <strong style={{ color: '#10b981' }}>{formatARS(calculations.beneficio)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                            <span>Fondo Imprevistos ({contingenciasPct}%):</span>
                                            <strong style={{ color: '#cbd5e1' }}>{formatARS(calculations.contingencias)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                            <span>Previsión Índice CAC ({cacAjustePct}%):</span>
                                            <strong style={{ color: '#38bdf8' }}>{formatARS(calculations.ajusteCac)}</strong>
                                        </div>
                                        {incluirIVA && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                                <span>IVA (21%):</span>
                                                <strong style={{ color: '#cbd5e1' }}>{formatARS(calculations.iva)}</strong>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            style={{ flex: 1 }}
                                            onClick={() => setActiveTab('propuesta')}
                                        >
                                            Ver Propuesta Formal 📜
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setActiveTab('whatsapp')}
                                        >
                                            Enviar por WhatsApp 💬
                                        </Button>
                                    </div>
                                </GlassCard>
                            </div>

                        </div>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 3: PROPUESTA FORMAL CLIENTE (ESTILO MEMBRETADA) */}
                {/* ========================================================================= */}
                {activeTab === 'propuesta' && (
                    <motion.div
                        key="tab-propuesta"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Hoja Membretada Formal */}
                        <div 
                            style={{ 
                                background: '#0a0f1d', 
                                border: '1px solid rgba(255, 255, 255, 0.12)', 
                                borderRadius: '16px', 
                                padding: 'clamp(20px, 5vw, 48px)',
                                maxWidth: '1000px',
                                margin: '0 auto',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                position: 'relative'
                            }}
                        >
                            {/* Decorative top gradient bar */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'linear-gradient(90deg, #10b981, #3b82f6, #f59e0b)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }} />

                            {/* Header del documento */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '24px', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#042f2e', fontWeight: 900, fontSize: '1rem' }}>
                                            OS
                                        </div>
                                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em', fontFamily: tokens.font.heading }}>
                                            ObraSaaS Constructora
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        Dirección Técnica & Ingeniería • CUIT 30-71449921-5 • Buenos Aires, Argentina
                                    </div>
                                </div>

                                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                    <Badge color="#10b981" variant="filled" size="sm">
                                        PROPUESTA COMERCIAL FORMAL
                                    </Badge>
                                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '6px', fontFamily: tokens.font.mono }}>
                                        REF: COT-2026-089
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                        Fecha: 15 de Septiembre de 2026 • Validez: {clientDetails.validezDias} días
                                    </div>
                                </div>
                            </div>

                            {/* Destinatario y Proyecto */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', padding: '16px 20px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '28px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                                        PREPARADO PARA EL CLIENTE:
                                    </div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                                        {clientDetails.nombre}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        CUIT: {clientDetails.cuit} • Atención: {clientDetails.contacto}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                                        PROYECTO & EMPLAZAMIENTO:
                                    </div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                                        {clientDetails.proyecto}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        {clientDetails.ubicacion} • Superficie: {clientDetails.superficieM2} m² cubiertos
                                    </div>
                                </div>
                            </div>

                            {/* Resumen de Montos */}
                            <div style={{ marginBottom: '28px' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    1. Resumen Económico de la Propuesta
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>COSTO DIRECTO DE MATERIALES & MO</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                                            {formatARS(calculations.costoDirecto)}
                                        </div>
                                    </div>
                                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>GASTOS GENERALES + MARGEN CONTR.</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>
                                            {formatARS(calculations.gastosGenerales + calculations.beneficio)}
                                        </div>
                                    </div>
                                    <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TOTAL FINAL DE LA OFERTA</div>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>
                                            {formatARS(calculations.totalFinal)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cronograma de Desembolsos por Hitos */}
                            <div style={{ marginBottom: '28px' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    2. Cronograma de Pagos por Hitos Contractuales
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>Hito 1: Anticipo Financiero para Acopio de Materiales (30%)</span>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>A la firma del contrato y replanteo de obra</div>
                                        </div>
                                        <span style={{ fontWeight: 800, color: '#10b981', fontFamily: tokens.font.mono }}>
                                            {formatARS(calculations.totalFinal * 0.30)}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>Hito 2: Finalización de Estructura de Hormigón Nivel +4 (25%)</span>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Certificado intermedio con ensayo de probetas H-30</div>
                                        </div>
                                        <span style={{ fontWeight: 800, color: '#10b981', fontFamily: tokens.font.mono }}>
                                            {formatARS(calculations.totalFinal * 0.25)}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>Hito 3: Cerramientos, Instalaciones y Revoques (25%)</span>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pruebas hidráulicas y eléctricas aprobadas</div>
                                        </div>
                                        <span style={{ fontWeight: 800, color: '#10b981', fontFamily: tokens.font.mono }}>
                                            {formatARS(calculations.totalFinal * 0.25)}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>Hito 4: Terminaciones, Pintura y Entrega de Llaves (20%)</span>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Acta de recepción provisoria y fondo de reparo 5%</div>
                                        </div>
                                        <span style={{ fontWeight: 800, color: '#10b981', fontFamily: tokens.font.mono }}>
                                            {formatARS(calculations.totalFinal * 0.20)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Condiciones Contractuales y Cláusula CAC */}
                            <div style={{ marginBottom: '32px', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    3. Condiciones Contractuales & Cláusula de Ajuste
                                </div>
                                <p style={{ margin: '0 0 8px' }}>
                                    • <strong>Cláusula de Redeterminación de Precios:</strong> El saldo impago se redeterminará mensualmente según el índice de Costo de la Construcción de la Cámara Argentina de la Construcción (CAC), base mes de emisión, bajo lineamientos del Decreto Nacional 691/16.
                                </p>
                                <p style={{ margin: '0 0 8px' }}>
                                    • <strong>Fondo de Reparo:</strong> Se retendrá un 5% de cada certificado de obra en concepto de garantía por vicios ocultos (Ley 22.250 / CCT 76/75), a devolverse a los 180 días de la recepción definitiva.
                                </p>
                                <p style={{ margin: '0' }}>
                                    • <strong>Seguros & ART:</strong> Todo el personal involucrado cuenta con cobertura ART de primer nivel y seguro de Responsabilidad Civil hacia terceros por $100.000.000 ARS.
                                </p>
                            </div>

                            {/* Firmas y Sellos */}
                            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '4px' }}>FIRMA DIGITAL VERIFICADA:</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                                        Arq. Marcelo Guillén & Arq. Victoria Schiaffino
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: tokens.font.mono }}>
                                        HASH SHA-256: 7a8f9c1b4e2d5a3f... (Válido en Blockchain)
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => window.print()}
                                    >
                                        Descargar Propuesta en PDF
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            navigator.clipboard?.writeText(`https://obrasaas.vercel.app/presupuesto?ref=COT-2026-089`);
                                            setCopiedProposal(true);
                                            setTimeout(() => setCopiedProposal(false), 2000);
                                        }}
                                    >
                                        {copiedProposal ? '✓ Enlace Copiado' : '🔗 Copiar Enlace Cliente'}
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 4: DESPACHO & TRAZABILIDAD WHATSAPP */}
                {/* ========================================================================= */}
                {activeTab === 'whatsapp' && (
                    <motion.div
                        key="tab-whatsapp"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                            
                            {/* Generador de Mensaje WhatsApp */}
                            <GlassCard style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#fff' }}>
                                        💬
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                            Despacho Comercial por WhatsApp
                                        </h3>
                                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                                            Notificación formal con enlace directo y resumen financiero de la obra
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                                            Teléfono del Cliente / Desarrollador:
                                        </label>
                                        <input
                                            type="text"
                                            value={clientDetails.telefono}
                                            onChange={e => setClientDetails({ ...clientDetails, telefono: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '8px',
                                                color: '#f8fafc',
                                                fontSize: '0.88rem',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                                            Vista Previa del Mensaje Formal:
                                        </label>
                                        <textarea
                                            rows={11}
                                            readOnly
                                            value={whatsAppMessage}
                                            style={{
                                                width: '100%',
                                                padding: '12px 14px',
                                                background: 'rgba(0, 0, 0, 0.35)',
                                                border: '1px solid rgba(37, 211, 102, 0.3)',
                                                borderRadius: '8px',
                                                color: '#cbd5e1',
                                                fontSize: '0.82rem',
                                                lineHeight: 1.45,
                                                resize: 'none',
                                                boxSizing: 'border-box',
                                                fontFamily: tokens.font.sans
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Button
                                            variant="primary"
                                            size="md"
                                            style={{ flex: 1, background: '#25D366', color: '#042f2e', fontWeight: 800 }}
                                            onClick={() => {
                                                setWhatsAppDispatched(true);
                                                const cleanPhone = clientDetails.telefono.replace(/[^0-9]/g, '');
                                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`, '_blank');
                                            }}
                                        >
                                            {whatsAppDispatched ? '✓ Abriendo WhatsApp...' : 'Enviar Propuesta por WhatsApp 💬'}
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => {
                                                navigator.clipboard?.writeText(whatsAppMessage);
                                                alert('Texto del mensaje copiado al portapapeles');
                                            }}
                                        >
                                            Copiar Texto
                                        </Button>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Historial de Propuestas Enviadas */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    Historial de Cotizaciones Emitidas
                                </h3>
                                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 16px' }}>
                                    Trazabilidad de propuestas enviadas y confirmaciones de lectura
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {HISTORIAL_PROPUESTAS.map(prop => (
                                        <div
                                            key={prop.id}
                                            style={{
                                                padding: '14px 16px',
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                borderRadius: '10px',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontFamily: tokens.font.mono, color: '#64748b' }}>
                                                        {prop.id}
                                                    </span>
                                                    <Badge 
                                                        color={prop.status === 'Aprobada' ? '#10b981' : prop.status === 'Enviada' ? '#3b82f6' : '#f59e0b'} 
                                                        variant="subtle" 
                                                        size="xs"
                                                    >
                                                        {prop.status}
                                                    </Badge>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                                    {prop.cliente}
                                                </div>
                                                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                                                    Canal: {prop.canal} • {prop.fecha}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981' }}>
                                                    {formatARS(prop.monto)}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                    ≈ {formatUSD(prop.monto)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>

                        </div>
                    </motion.div>
                )}

            </main>

            {/* ========================================================================= */}
            {/* MODAL: AGREGAR ÍTEM DE CÓMPUTO */}
            {/* ========================================================================= */}
            <Modal
                isOpen={showAddItemModal}
                onClose={() => setShowAddItemModal(false)}
                title="Nuevo Ítem de Cómputo Métrico"
                subtitle="Incorpore una nueva partida constructiva al presupuesto oficial"
                maxWidth="520px"
            >
                <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                            Rubro Constructivo:
                        </label>
                        <select
                            value={newItem.rubro}
                            onChange={e => setNewItem({ ...newItem, rubro: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '0.85rem'
                            }}
                        >
                            <option value="Preliminares">Preliminares & Cerco</option>
                            <option value="Movimiento de Suelos">Movimiento de Suelos</option>
                            <option value="Estructuras">Estructuras de Hormigón</option>
                            <option value="Cerramientos">Mampostería & Cerramientos</option>
                            <option value="Instalaciones">Instalaciones Sanitarias & Gas</option>
                            <option value="Construcción en Seco">Construcción en Seco</option>
                            <option value="Carpinterías">Carpinterías & Herrería</option>
                            <option value="Terminaciones">Terminaciones & Pintura</option>
                            <option value="Final de Obra">Final de Obra</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                            Descripción Técnica del Ítem:
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ej. Losa de viguetas pretensadas y bovedillas cerámicas..."
                            value={newItem.descripcion}
                            onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                                Cantidad:
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={newItem.cantidad}
                                onChange={e => setNewItem({ ...newItem, cantidad: Number(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                                Unidad:
                            </label>
                            <select
                                value={newItem.unidad}
                                onChange={e => setNewItem({ ...newItem, unidad: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <option value="m2">m²</option>
                                <option value="m3">m³</option>
                                <option value="ml">ml</option>
                                <option value="gl">gl (global)</option>
                                <option value="u">u (unidad)</option>
                                <option value="kg">kg</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                                P. Unit (ARS):
                            </label>
                            <input
                                type="number"
                                required
                                min="100"
                                value={newItem.precioUnitario}
                                onChange={e => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            style={{ flex: 1 }}
                        >
                            + Guardar Ítem
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => setShowAddItemModal(false)}
                        >
                            Cancelar
                        </Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
}

