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

// --- DATA: Licitaciones Públicas Oficiales ---
const LICITACIONES_DATA = [
    {
        id: 'lic-01',
        organismo: 'Ministerio de Obras Públicas (Nación)',
        organismoCorto: 'MOP Nación',
        title: 'Construcción Centro de Salud & Módulos Sanitarios',
        expediente: 'EX-2026-4410-APN',
        ubicacion: 'La Matanza, Buenos Aires',
        provincia: 'Buenos Aires',
        presupuestoOficial: 340000000,
        apertura: '28 Ago 2026',
        aperturaHora: '11:00 hs',
        categoria: 'Edificación',
        matchScore: 96,
        pliegoGratis: true,
        costoPliego: 0,
        caucion: 3400000, // 1%
        plazoMeses: 14,
        status: 'VIGENTE',
        descripcion: 'Construcción de edificio modular sanitario de 1.850 m2 cubiertos con salas de guardia, consultorios externos y quirófano menor.',
        requisitos: ['Capacidad Financiera $450M+', 'Certificado Registro de Constructores', '3 obras similares en últimos 5 años', 'Póliza Caución 1%']
    },
    {
        id: 'lic-02',
        organismo: 'Gobierno de la Ciudad de Buenos Aires (GCBA)',
        organismoCorto: 'GCBA',
        title: 'Puesta en Valor & Refuncionalización Espacio Verde',
        expediente: 'BAC-7712-2026',
        ubicacion: 'Palermo, CABA',
        provincia: 'CABA',
        presupuestoOficial: 185000000,
        apertura: '04 Sep 2026',
        aperturaHora: '12:00 hs',
        categoria: 'Arquitectura',
        matchScore: 89,
        pliegoGratis: true,
        costoPliego: 0,
        caucion: 1850000,
        plazoMeses: 8,
        status: 'VIGENTE',
        descripcion: 'Intervención paisajística, solados intertrabados, iluminación LED fotovoltaica y equipamiento urbano en parque de 4 hectáreas.',
        requisitos: ['Inscripción RIUGCBA', 'Garantía Oferta 1%', 'Arquitecto Director Matriculado CPAU', 'Plan de Mitigación Ambiental']
    },
    {
        id: 'lic-03',
        organismo: 'Dirección Provincial de Vialidad (Mendoza)',
        organismoCorto: 'DPV Mendoza',
        title: 'Pavimentación Urbana y Desagües Pluviales Colectora',
        expediente: 'DPV-MZA-882-2026',
        ubicacion: 'Guaymallén, Mendoza',
        provincia: 'Mendoza',
        presupuestoOficial: 620000000,
        apertura: '12 Sep 2026',
        aperturaHora: '10:30 hs',
        categoria: 'Vial',
        matchScore: 78,
        pliegoGratis: false,
        costoPliego: 45000,
        caucion: 6200000,
        plazoMeses: 18,
        status: 'VIGENTE',
        descripcion: 'Repavimentación en carpeta asfáltica en caliente de 8.4 km de colectoras y ensanche de cunetas de hormigón armado.',
        requisitos: ['Registro DPV Mendoza Especialidad Vial', 'Parque de maquinarias verificado', 'Capacidad Anual de Contratación Ley 4416', 'Póliza ART nómina completa']
    },
    {
        id: 'lic-04',
        organismo: 'Dirección General de Escuelas (Córdoba)',
        organismoCorto: 'DGE Córdoba',
        title: 'Ampliación 4 Aulas y Salón de Usos Múltiples',
        expediente: 'DGE-CBA-319-2026',
        ubicacion: 'Villa Carlos Paz, Córdoba',
        provincia: 'Córdoba',
        presupuestoOficial: 120000000,
        apertura: '18 Sep 2026',
        aperturaHora: '09:00 hs',
        categoria: 'Edificación',
        matchScore: 92,
        pliegoGratis: true,
        costoPliego: 0,
        caucion: 1200000,
        plazoMeses: 6,
        status: 'VIGENTE',
        descripcion: 'Construcción tradicional de 480 m2 con estructura de hormigón, mampostería revocada y cubierta metálica termoacústica.',
        requisitos: ['Inscripción ROP Córdoba', 'Garantía 1% en efectivo o póliza', 'Certificado Libre Deuda Fiscal DGR', 'Cálculo estructural CIRSOC 101/201']
    },
    {
        id: 'lic-05',
        organismo: 'Min. Infraestructura y Servicios Públicos (Santa Fe)',
        organismoCorto: 'MISP Santa Fe',
        title: 'Renovación Integral Red Troncal Colectora Cloacal',
        expediente: 'MISP-SF-5501-2026',
        ubicacion: 'Rosario, Santa Fe',
        provincia: 'Santa Fe',
        presupuestoOficial: 210000000,
        apertura: '24 Sep 2026',
        aperturaHora: '11:30 hs',
        categoria: 'Hidráulica',
        matchScore: 85,
        pliegoGratis: true,
        costoPliego: 0,
        caucion: 2100000,
        plazoMeses: 10,
        status: 'VIGENTE',
        descripcion: 'Tendido de 2.200 metros lineales de cañería de PEAD de 400mm con bocas de registro y empalme a estación elevadora central.',
        requisitos: ['Especialidad Hidráulica y Saneamiento', 'Equipo de electrofusión certificado', 'Protocolo SRT 319/99 excavación', 'Seguro RC Terceros $50M']
    },
    {
        id: 'lic-06',
        organismo: 'AySA Agua y Saneamientos Argentinos',
        organismoCorto: 'AySA',
        title: 'Estación de Bombeo y Conducción Impulsión Norte',
        expediente: 'AYSA-CT-2026-109',
        ubicacion: 'Tigre, Buenos Aires',
        provincia: 'Buenos Aires',
        presupuestoOficial: 70000000,
        apertura: '02 Oct 2026',
        aperturaHora: '10:00 hs',
        categoria: 'Hidráulica',
        matchScore: 91,
        pliegoGratis: true,
        costoPliego: 0,
        caucion: 700000,
        plazoMeses: 4,
        status: 'VIGENTE',
        descripcion: 'Provisión e instalación de 2 electrobombas sumergibles de 75 HP, tablero de comando con variador de frecuencia y cámara de carga.',
        requisitos: ['Proveedor homologado AySA', 'Garantía de equipos 24 meses', 'Ensayo hidrostático bajo norma IRAM', 'Plan de contingencia ambiental']
    }
];

// --- DATA: Concursos Privados & Comparador de Subcontratistas ---
const CONCURSOS_PAQUETES = [
    {
        id: 'pkg-01',
        titulo: 'Tabiquería, Cielorrasos & Yesería Drywall',
        obra: 'Torre Alvear Icon - Nivel +4 a +12',
        rubro: 'Construcción en Seco',
        presupuestoOficialRubro: 19800000,
        oferentes: [
            {
                id: 'sub-01',
                nombre: 'YesoSur SRL',
                cuit: '30-71289410-8',
                representante: 'Ing. Lucas Varela',
                telefono: '+54 9 11 5521-9840',
                score: 96,
                artVigente: true,
                plazoDias: 45,
                materiales: 10200000,
                manoObra: 6800000,
                logisticaEquipos: 1450000,
                total: 18450000,
                dispersionPct: -6.8, // Ahorro vs presupuesto oficial
                recomendado: true,
                badge: 'Mejor Oferta Técnica & Económica'
            },
            {
                id: 'sub-02',
                nombre: 'Cielorrasos & Aislaciones SA',
                cuit: '33-69812401-9',
                representante: 'Arq. Claudio Méndez',
                telefono: '+54 9 11 4410-3320',
                score: 89,
                artVigente: true,
                plazoDias: 40,
                materiales: 11100000,
                manoObra: 7400000,
                logisticaEquipos: 1600000,
                total: 20100000,
                dispersionPct: +1.5,
                recomendado: false,
                badge: 'Menor Plazo de Obra'
            },
            {
                id: 'sub-03',
                nombre: 'Durlock Pro Argentina',
                cuit: '30-71882319-2',
                representante: 'Mariano Benítez',
                telefono: '+54 9 11 6390-1122',
                score: 79,
                artVigente: false,
                plazoDias: 55,
                materiales: 12500000,
                manoObra: 7900000,
                logisticaEquipos: 1900000,
                total: 22300000,
                dispersionPct: +12.6,
                recomendado: false,
                badge: 'ART en Trámite'
            }
        ]
    },
    {
        id: 'pkg-02',
        titulo: 'Instalaciones Termomecánicas & VRV Inverter',
        obra: 'Residencial Libertador Park',
        rubro: 'Climatización',
        presupuestoOficialRubro: 42000000,
        oferentes: [
            {
                id: 'sub-04',
                nombre: 'TermoClima Industrial SA',
                cuit: '30-68112003-4',
                representante: 'Ing. Fernando Rossi',
                telefono: '+54 9 11 4409-1234',
                score: 94,
                artVigente: true,
                plazoDias: 60,
                materiales: 24500000,
                manoObra: 11200000,
                logisticaEquipos: 3100000,
                total: 38800000,
                dispersionPct: -7.6,
                recomendado: true,
                badge: 'Distribuidor Oficial Daikin'
            },
            {
                id: 'sub-05',
                nombre: 'Aires del Plata SRL',
                cuit: '30-71009944-1',
                representante: 'Germán Duarte',
                telefono: '+54 9 11 3311-7788',
                score: 86,
                artVigente: true,
                plazoDias: 50,
                materiales: 26800000,
                manoObra: 12000000,
                logisticaEquipos: 3500000,
                total: 42300000,
                dispersionPct: +0.7,
                recomendado: false,
                badge: 'Garantía Extendida 36m'
            },
            {
                id: 'sub-06',
                nombre: 'ClimaTec Soluciones',
                cuit: '30-71654321-9',
                representante: 'Pablo Echeverría',
                telefono: '+54 9 11 5599-4433',
                score: 81,
                artVigente: true,
                plazoDias: 70,
                materiales: 29000000,
                manoObra: 13500000,
                logisticaEquipos: 4000000,
                total: 46500000,
                dispersionPct: +10.7,
                recomendado: false,
                badge: 'Capacidad de Stock Limitada'
            }
        ]
    },
    {
        id: 'pkg-03',
        titulo: 'Hormigón Elaborado H-30 Bombeado (650 m³)',
        obra: 'Complejo Logístico Ruta 9',
        rubro: 'Estructuras',
        presupuestoOficialRubro: 58500000,
        oferentes: [
            {
                id: 'sub-07',
                nombre: 'Loma Negra / Hormisur',
                cuit: '30-50001234-9',
                representante: 'Lic. Gonzalo Prat',
                telefono: '+54 9 11 2233-4455',
                score: 98,
                artVigente: true,
                plazoDias: 30,
                materiales: 42000000,
                manoObra: 6500000,
                logisticaEquipos: 6200000,
                total: 54700000,
                dispersionPct: -6.5,
                recomendado: true,
                badge: 'Certificación IRAM 1666'
            },
            {
                id: 'sub-08',
                nombre: 'Hormigonera Platense',
                cuit: '30-67890123-5',
                representante: 'Ing. Esteban Castro',
                telefono: '+54 9 11 6677-8899',
                score: 90,
                artVigente: true,
                plazoDias: 25,
                materiales: 44200000,
                manoObra: 7100000,
                logisticaEquipos: 6500000,
                total: 57800000,
                dispersionPct: -1.2,
                recomendado: false,
                badge: 'Planta a 8 km de Obra'
            },
            {
                id: 'sub-09',
                nombre: 'MixConcret SRL',
                cuit: '30-71456789-0',
                representante: 'Nicolás Ferraro',
                telefono: '+54 9 11 9900-1122',
                score: 77,
                artVigente: true,
                plazoDias: 35,
                materiales: 47000000,
                manoObra: 7800000,
                logisticaEquipos: 7200000,
                total: 62000000,
                dispersionPct: +6.0,
                recomendado: false,
                badge: 'Disponibilidad de Bombas 28m'
            }
        ]
    }
];

// --- DATA: Pipeline de Adjudicaciones ---
const PIPELINE_DATA = [
    {
        etapa: 'estudio',
        tituloEtapa: 'En Análisis Técnico',
        color: '#3b82f6',
        items: [
            {
                id: 'pip-01',
                licitacion: 'Construcción Centro de Salud & Módulos Sanitarios',
                organismo: 'MOP Nación',
                monto: 340000000,
                vencimiento: '28 Ago 2026',
                diasRestantes: 14,
                caucionStatus: 'En emisión (San Cristóbal)',
                responsable: 'Arq. Marcelo Guillén',
                progresoPliego: 65
            },
            {
                id: 'pip-02',
                licitacion: 'Ampliación 4 Aulas y SUM Escolar',
                organismo: 'DGE Córdoba',
                monto: 120000000,
                vencimiento: '18 Sep 2026',
                diasRestantes: 35,
                caucionStatus: 'Pendiente cotización',
                responsable: 'Ing. Lucas Varela',
                progresoPliego: 30
            }
        ]
    },
    {
        etapa: 'armado',
        tituloEtapa: 'Pliego & Oferta Armada',
        color: '#8b5cf6',
        items: [
            {
                id: 'pip-03',
                licitacion: 'Puesta en Valor Espacio Verde Palermo',
                organismo: 'GCBA',
                monto: 185000000,
                vencimiento: '04 Sep 2026',
                diasRestantes: 21,
                caucionStatus: 'Póliza Emitida #CAU-9921',
                responsable: 'Arq. Victoria Schiaffino',
                progresoPliego: 92
            }
        ]
    },
    {
        etapa: 'presentado',
        tituloEtapa: 'Sobres Presentados',
        color: '#f59e0b',
        items: [
            {
                id: 'pip-04',
                licitacion: 'Pavimentación Urbana Guaymallén',
                organismo: 'DPV Mendoza',
                monto: 620000000,
                vencimiento: '12 Sep 2026',
                diasRestantes: 8,
                caucionStatus: 'Aceptada por Organismo',
                responsable: 'Ing. Fernando Rossi',
                progresoPliego: 100
            }
        ]
    },
    {
        etapa: 'evaluacion',
        tituloEtapa: 'Apertura & Pre-adjudicación',
        color: '#ec4899',
        items: [
            {
                id: 'pip-05',
                licitacion: 'Red Troncal Colectora Cloacal',
                organismo: 'MISP Santa Fe',
                monto: 210000000,
                vencimiento: 'En dictamen comisión',
                diasRestantes: 0,
                caucionStatus: 'Vigente hasta resolución',
                responsable: 'Dr. Andrés Balbín (Legal)',
                progresoPliego: 100,
                posicionOrden: '1º en Orden de Mérito (Oferta $198.4M)'
            }
        ]
    },
    {
        etapa: 'adjudicada',
        tituloEtapa: 'Adjudicada & Contrato',
        color: '#10b981',
        items: [
            {
                id: 'pip-06',
                licitacion: 'Estación de Bombeo Tigre',
                organismo: 'AySA',
                monto: 70000000,
                vencimiento: 'Firma Contrato 22 Ago',
                diasRestantes: 2,
                caucionStatus: 'Canjeada por Fondo de Reparo 5%',
                responsable: 'Arq. Marcelo Guillén',
                progresoPliego: 100,
                posicionOrden: 'Adjudicación Definitiva Res. 401/26'
            }
        ]
    }
];

export default function LicitacionesPage() {
    const { isMobile } = useBreakpoint();
    
    // Tabs state
    const [activeTab, setActiveTab] = useState('publicas');
    
    // Tab 1 filters
    const [filterCategory, setFilterCategory] = useState('todas');
    const [filterProvincia, setFilterProvincia] = useState('todas');
    const [search, setSearch] = useState('');
    
    // Tab 2 package selector
    const [selectedPackageId, setSelectedPackageId] = useState('pkg-01');
    
    // Tab 3 Simulator state
    const [simPresupuestoOficial, setSimPresupuestoOficial] = useState(340000000);
    const [simCostoDirecto, setSimCostoDirecto] = useState(245000000);
    const [simGastosGeneralesPct, setSimGastosGeneralesPct] = useState(15);
    const [simBeneficioPct, setSimBeneficioPct] = useState(12);
    const [simGastosFinancierosPct, setSimGastosFinancierosPct] = useState(3);
    const [simIncluirIVA, setSimIncluirIVA] = useState(true);
    
    // Modals
    const [selectedLicitacion, setSelectedLicitacion] = useState(null);
    const [awardingSub, setAwardingSub] = useState(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [copiedOffer, setCopiedOffer] = useState(false);
    const [whatsAppDispatched, setWhatsAppDispatched] = useState(false);

    // Categories and Provinces
    const categories = ['todas', 'Edificación', 'Arquitectura', 'Vial', 'Hidráulica'];
    const provincias = ['todas', 'Buenos Aires', 'CABA', 'Mendoza', 'Córdoba', 'Santa Fe'];

    // Filtered Licitaciones
    const filteredLicitaciones = useMemo(() => {
        return LICITACIONES_DATA.filter(l => {
            const matchesCat = filterCategory === 'todas' || l.categoria === filterCategory;
            const matchesProv = filterProvincia === 'todas' || l.provincia === filterProvincia;
            const matchesSearch = !search || 
                l.title.toLowerCase().includes(search.toLowerCase()) || 
                l.organismo.toLowerCase().includes(search.toLowerCase()) ||
                l.ubicacion.toLowerCase().includes(search.toLowerCase()) ||
                l.expediente.toLowerCase().includes(search.toLowerCase());
            return matchesCat && matchesProv && matchesSearch;
        });
    }, [filterCategory, filterProvincia, search]);

    // Current Subcontract Package
    const activePackage = useMemo(() => {
        return CONCURSOS_PAQUETES.find(p => p.id === selectedPackageId) || CONCURSOS_PAQUETES[0];
    }, [selectedPackageId]);

    // Price Formation Calculations (Tab 3)
    const priceFormation = useMemo(() => {
        const costoDirecto = Number(simCostoDirecto) || 0;
        const gg = costoDirecto * (simGastosGeneralesPct / 100);
        const subtotalCosto = costoDirecto + gg;
        const beneficio = subtotalCosto * (simBeneficioPct / 100);
        const subtotalNeto = subtotalCosto + beneficio;
        const gastosFinancieros = subtotalNeto * (simGastosFinancierosPct / 100);
        const baseImponible = subtotalNeto + gastosFinancieros;
        
        // Impuestos: IVA 21% + IIBB 3% = 24%
        const impuestos = simIncluirIVA ? baseImponible * 0.24 : 0;
        const ofertaFinal = baseImponible + impuestos;
        
        const presupuestoOficial = Number(simPresupuestoOficial) || 1;
        const desvioMonto = ofertaFinal - presupuestoOficial;
        const desvioPct = ((ofertaFinal - presupuestoOficial) / presupuestoOficial) * 100;
        
        // Caución de Mantenimiento de Oferta: 1% de la Oferta
        const caucionOferta = ofertaFinal * 0.01;
        
        // Probabilidad de Adjudicación estimada heurística
        let probabilidad = 75;
        if (desvioPct < -15) probabilidad = 35; // Sospecha de oferta temeraria
        else if (desvioPct >= -15 && desvioPct <= -5) probabilidad = 92; // Zona ganadora óptima
        else if (desvioPct > -5 && desvioPct <= 0) probabilidad = 84; // Competitiva
        else if (desvioPct > 0 && desvioPct <= 5) probabilidad = 62; // Sobre oficial leve
        else if (desvioPct > 5 && desvioPct <= 10) probabilidad = 40; // Fuera de precio
        else probabilidad = 18;

        return {
            costoDirecto,
            gg,
            subtotalCosto,
            beneficio,
            subtotalNeto,
            gastosFinancieros,
            impuestos,
            ofertaFinal,
            desvioMonto,
            desvioPct,
            caucionOferta,
            probabilidad
        };
    }, [simCostoDirecto, simGastosGeneralesPct, simBeneficioPct, simGastosFinancierosPct, simIncluirIVA, simPresupuestoOficial]);

    // Format currency helper
    const formatARS = (amount) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
    };

    // Tabs configuration
    const tabsList = [
        { id: 'publicas', label: '🏛️ Licitaciones Públicas', badge: filteredLicitaciones.length },
        { id: 'concursos', label: '🤝 Concursos & Subcontratos', badge: CONCURSOS_PAQUETES.length },
        { id: 'simulador', label: '🧮 Simulador de Oferta' },
        { id: 'pipeline', label: '📈 Pipeline & Adjudicaciones', badge: 5 }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Licitaciones & Concursos Enterprise"
                subtitle="Monitoreo oficial de Compr.ar / BAC, comparador técnico de subcontratistas, simulador de precios y pipeline de adjudicaciones"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Licitaciones & Concursos' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => setShowInviteModal(true)}
                        >
                            + Invitar Subcontratista
                        </Button>
                        <Link href="/dashboard">
                            <Button variant="outline" size="sm">← Volver al Dashboard</Button>
                        </Link>
                    </div>
                }
            />

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 80px' }}>
                
                {/* Top Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    <StatCard 
                        label="LICITACIONES ACTIVAS" 
                        value="$1.545 M" 
                        sub="6 pliegos vigentes monitoreados" 
                        icon="🏛️" 
                        color="#3b82f6" 
                    />
                    <StatCard 
                        label="TASA DE ADJUDICACIÓN" 
                        value="38.5%" 
                        sub="+4.2% vs promedio 2025" 
                        icon="🎯" 
                        color="#10b981" 
                    />
                    <StatCard 
                        label="CAUCIÓN REQUERIDA (1%)" 
                        value="$15.45 M" 
                        sub="Garantía de oferta Ley 13.064" 
                        icon="🛡️" 
                        color="#f59e0b" 
                    />
                    <StatCard 
                        label="AHORRO EN SUBCONTRATOS" 
                        value="14.2%" 
                        sub="Optimización en comparativas" 
                        icon="💰" 
                        color="#8b5cf6" 
                    />
                </div>

                {/* Main Navigation Tabs */}
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <Tabs 
                        tabs={tabsList} 
                        activeTab={activeTab} 
                        onChange={setActiveTab} 
                        color="#3b82f6" 
                    />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                        Sincronización Compr.ar / BAC: <strong>En Vivo (Hoy 08:30)</strong>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: LICITACIONES PÚBLICAS */}
                {/* ========================================================================= */}
                {activeTab === 'publicas' && (
                    <motion.div
                        key="tab-publicas"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Search & Filters Card */}
                        <GlassCard style={{ padding: '18px 22px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="Buscar por organismo, número de expediente, obra o provincia..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '10px',
                                                color: '#f8fafc',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                    {search && (
                                        <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                                            Limpiar
                                        </Button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                    {/* Category Pills */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '4px' }}>Rubro:</span>
                                        {categories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setFilterCategory(cat)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: filterCategory === cat ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    background: filterCategory === cat ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                                                    color: filterCategory === cat ? '#60a5fa' : '#94a3b8',
                                                    fontSize: '0.76rem',
                                                    fontWeight: filterCategory === cat ? 700 : 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {cat === 'todas' ? 'Todas' : cat}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Province Pills */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '4px' }}>Jurisdicción:</span>
                                        {provincias.map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setFilterProvincia(p)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: filterProvincia === p ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    background: filterProvincia === p ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                                                    color: filterProvincia === p ? '#fbbf24' : '#94a3b8',
                                                    fontSize: '0.76rem',
                                                    fontWeight: filterProvincia === p ? 700 : 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {p === 'todas' ? 'Todas' : p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Results Count */}
                        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                            <span>Mostrando <strong>{filteredLicitaciones.length}</strong> licitaciones públicas disponibles</span>
                            <span>Tipo de cambio de referencia: <strong>$1.250 ARS / USD</strong></span>
                        </div>

                        {/* Licitaciones Cards List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredLicitaciones.map((l, index) => (
                                <motion.div
                                    key={l.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.35, delay: index * 0.05 }}
                                >
                                    <GlassCard style={{ padding: '24px', borderLeft: `4px solid ${l.matchScore >= 90 ? '#10b981' : l.matchScore >= 80 ? '#3b82f6' : '#f59e0b'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                                            
                                            {/* Columna Izquierda: Datos del pliego */}
                                            <div style={{ flex: 1, minWidth: '320px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                                    <Badge color="#3b82f6" variant="filled" size="xs">{l.organismoCorto}</Badge>
                                                    <Badge color="#f59e0b" variant="subtle" size="xs">{l.categoria}</Badge>
                                                    <Badge color="#8b5cf6" variant="subtle" size="xs">{l.provincia}</Badge>
                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: tokens.font.mono }}>
                                                        {l.expediente}
                                                    </span>
                                                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, marginLeft: 'auto' }}>
                                                        ● {l.status}
                                                    </span>
                                                </div>

                                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc', lineHeight: 1.3 }}>
                                                    {l.title}
                                                </h3>

                                                <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.45 }}>
                                                    {l.descripcion}
                                                </p>

                                                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#cbd5e1' }}>
                                                    <span>📍 <strong>{l.ubicacion}</strong></span>
                                                    <span>📅 Apertura: <strong style={{ color: '#f59e0b' }}>{l.apertura} ({l.aperturaHora})</strong></span>
                                                    <span>⏱️ Plazo: <strong>{l.plazoMeses} meses</strong></span>
                                                    <span>🛡️ Caución 1%: <strong style={{ color: '#10b981' }}>{formatARS(l.caucion)}</strong></span>
                                                </div>
                                            </div>

                                            {/* Columna Derecha: Presupuesto, Match y Acciones */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: '14px', minWidth: '220px' }}>
                                                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>
                                                        PRESUPUESTO OFICIAL
                                                    </div>
                                                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', fontFamily: tokens.font.heading }}>
                                                        {formatARS(l.presupuestoOficial)}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        ≈ USD {(l.presupuestoOficial / 1250).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>APTITUD TÉCNICA</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: l.matchScore >= 90 ? '#10b981' : '#3b82f6' }}>
                                                            {l.matchScore}% MATCH
                                                        </div>
                                                    </div>
                                                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#10b981' }}>
                                                        ✓
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => setSelectedLicitacion(l)}
                                                    >
                                                        Ver Pliego
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSimPresupuestoOficial(l.presupuestoOficial);
                                                            setSimCostoDirecto(Math.round(l.presupuestoOficial * 0.72));
                                                            setActiveTab('simulador');
                                                        }}
                                                    >
                                                        Simular Oferta 🧮
                                                    </Button>
                                                </div>
                                            </div>

                                        </div>
                                    </GlassCard>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: CONCURSOS PRIVADOS & COMPARADOR DE SUBCONTRATOS */}
                {/* ========================================================================= */}
                {activeTab === 'concursos' && (
                    <motion.div
                        key="tab-concursos"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Selector de Paquete / Licitación Privada */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '6px' }}>
                            {CONCURSOS_PAQUETES.map(pkg => {
                                const isSelected = pkg.id === selectedPackageId;
                                return (
                                    <button
                                        key={pkg.id}
                                        onClick={() => setSelectedPackageId(pkg.id)}
                                        style={{
                                            padding: '14px 20px',
                                            borderRadius: '12px',
                                            border: isSelected ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                                            background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 23, 42, 0.7)',
                                            color: isSelected ? '#fbbf24' : '#94a3b8',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            minWidth: '260px',
                                            flex: 1,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: isSelected ? '#f59e0b' : '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                                            {pkg.rubro} • {pkg.oferentes.length} Oferentes
                                        </div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: isSelected ? '#f8fafc' : '#cbd5e1', marginBottom: '4px' }}>
                                            {pkg.titulo}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                            Presupuesto Ref: <strong style={{ color: '#10b981' }}>{formatARS(pkg.presupuestoOficialRubro)}</strong>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Comparative Matrix Overview */}
                        <GlassCard style={{ padding: '24px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                        Matriz Comparativa de Subcontratistas: {activePackage.titulo}
                                    </h2>
                                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                                        Obra asignada: <strong style={{ color: '#f8fafc' }}>{activePackage.obra}</strong> • Presupuesto de Control: <strong style={{ color: '#10b981' }}>{formatARS(activePackage.presupuestoOficialRubro)}</strong>
                                    </p>
                                </div>

                                <Button 
                                    variant="secondary" 
                                    size="sm"
                                    onClick={() => setShowInviteModal(true)}
                                >
                                    + Invitar Nuevo Postulante
                                </Button>
                            </div>

                            {/* Side by side 3-card comparison grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                                {activePackage.oferentes.map((sub) => {
                                    const isLowest = sub.dispersionPct < 0;
                                    const borderColor = sub.recomendado ? '#10b981' : isLowest ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)';

                                    return (
                                        <div
                                            key={sub.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.75)',
                                                borderRadius: '14px',
                                                border: `2px solid ${borderColor}`,
                                                padding: '20px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                                boxShadow: sub.recomendado ? '0 8px 30px rgba(16, 185, 129, 0.15)' : 'none'
                                            }}
                                        >
                                            {sub.recomendado && (
                                                <div style={{ position: 'absolute', top: '-12px', right: '16px', background: '#10b981', color: '#042f2e', fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    ★ Recomendado IA
                                                </div>
                                            )}

                                            <div>
                                                {/* Header del Subcontratista */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 2px', color: '#f8fafc' }}>
                                                            {sub.nombre}
                                                        </h3>
                                                        <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: tokens.font.mono }}>
                                                            CUIT: {sub.cuit}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>SCORE TÉCNICO</div>
                                                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: sub.score >= 90 ? '#10b981' : '#f59e0b' }}>
                                                            {sub.score}/100
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Badges de Estado */}
                                                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                                    <Badge 
                                                        color={sub.artVigente ? '#10b981' : '#ef4444'} 
                                                        variant="filled" 
                                                        size="xs"
                                                    >
                                                        {sub.artVigente ? 'ART Vigente & Auditada' : 'ART Pendiente'}
                                                    </Badge>
                                                    <Badge color="#3b82f6" variant="subtle" size="xs">
                                                        {sub.plazoDias} días corridos
                                                    </Badge>
                                                    <Badge color="#f59e0b" variant="subtle" size="xs">
                                                        {sub.badge}
                                                    </Badge>
                                                </div>

                                                {/* Desglose de Costos del Oferente */}
                                                <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
                                                        <span>Materiales & Insumos:</span>
                                                        <strong style={{ color: '#cbd5e1' }}>{formatARS(sub.materiales)}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
                                                        <span>Mano de Obra UOCRA:</span>
                                                        <strong style={{ color: '#cbd5e1' }}>{formatARS(sub.manoObra)}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '8px' }}>
                                                        <span>Equipamiento & Flete:</span>
                                                        <strong style={{ color: '#cbd5e1' }}>{formatARS(sub.logisticaEquipos)}</strong>
                                                    </div>
                                                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>Total Cotizado:</span>
                                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>{formatARS(sub.total)}</span>
                                                    </div>
                                                </div>

                                                {/* Semáforo de Dispersión vs Presupuesto Oficial */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', padding: '8px 12px', borderRadius: '8px', background: isLowest ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Variación vs Presupuesto:</span>
                                                    <strong style={{ fontSize: '0.85rem', color: isLowest ? '#10b981' : '#ef4444' }}>
                                                        {sub.dispersionPct > 0 ? `+${sub.dispersionPct}% (Sobrecosto)` : `${sub.dispersionPct}% (Ahorro)`}
                                                    </strong>
                                                </div>
                                            </div>

                                            {/* Acciones de Adjudicación */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <Button
                                                    variant={sub.recomendado ? 'primary' : 'secondary'}
                                                    size="sm"
                                                    style={{ width: '100%' }}
                                                    onClick={() => {
                                                        setAwardingSub({ sub, paquete: activePackage });
                                                        setWhatsAppDispatched(false);
                                                    }}
                                                >
                                                    {sub.recomendado ? '🏆 Adjudicar Paquete' : 'Seleccionar Oferta'}
                                                </Button>

                                                <a
                                                    href={`https://wa.me/${sub.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${sub.representante} (${sub.nombre}), te contactamos de la Dirección de Obra de ObraSaaS respecto a su cotización para *${activePackage.titulo}*. Quisiéramos revisar detalles técnicos de la propuesta.`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <Button variant="outline" size="sm" style={{ width: '100%', color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.4)' }}>
                                                        💬 Consultar por WhatsApp
                                                    </Button>
                                                </a>
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 3: SIMULADOR DE OFERTA & FORMACIÓN DE PRECIOS */}
                {/* ========================================================================= */}
                {activeTab === 'simulador' && (
                    <motion.div
                        key="tab-simulador"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                            
                            {/* Panel Izquierdo: Inputs de Formación de Precios */}
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                                    🧮 Parámetros de Formación de Precio
                                </h3>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 20px' }}>
                                    Metodología oficial de descomposición de costos para licitaciones públicas y pliegos privados de envergadura.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {/* Presupuesto Oficial de Referencia */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Presupuesto Oficial del Organismo:</span>
                                            <strong style={{ color: '#3b82f6', fontFamily: tokens.font.mono }}>{formatARS(simPresupuestoOficial)}</strong>
                                        </div>
                                        <input
                                            type="number"
                                            value={simPresupuestoOficial}
                                            onChange={e => setSimPresupuestoOficial(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '8px',
                                                color: '#f8fafc',
                                                fontSize: '0.9rem',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    {/* Costo Directo */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Costo Directo (Materiales + Mano de Obra + Equipos):</span>
                                            <strong style={{ color: '#10b981', fontFamily: tokens.font.mono }}>{formatARS(simCostoDirecto)}</strong>
                                        </div>
                                        <input
                                            type="number"
                                            value={simCostoDirecto}
                                            onChange={e => setSimCostoDirecto(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '8px',
                                                color: '#f8fafc',
                                                fontSize: '0.9rem',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    {/* Gastos Generales Slider */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Gastos Generales de Obra e Indirectos:</span>
                                            <strong style={{ color: '#f59e0b', fontFamily: tokens.font.mono }}>{simGastosGeneralesPct}% ({formatARS(priceFormation.gg)})</strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="25"
                                            step="1"
                                            value={simGastosGeneralesPct}
                                            onChange={e => setSimGastosGeneralesPct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                                        />
                                    </div>

                                    {/* Beneficio Neto Slider */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Beneficio Constructora / Margen Bruto:</span>
                                            <strong style={{ color: '#8b5cf6', fontFamily: tokens.font.mono }}>{simBeneficioPct}% ({formatARS(priceFormation.beneficio)})</strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="25"
                                            step="1"
                                            value={simBeneficioPct}
                                            onChange={e => setSimBeneficioPct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
                                        />
                                    </div>

                                    {/* Gastos Financieros Slider */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Gastos Financieros & Pólizas de Caución:</span>
                                            <strong style={{ color: '#38bdf8', fontFamily: tokens.font.mono }}>{simGastosFinancierosPct}% ({formatARS(priceFormation.gastosFinancieros)})</strong>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="8"
                                            step="0.5"
                                            value={simGastosFinancierosPct}
                                            onChange={e => setSimGastosFinancierosPct(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                                        />
                                    </div>

                                    {/* Impuestos Checkbox */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                                                Incluir IVA (21%) + Ingresos Brutos (3%)
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                Total alícuotas impositivas: 24% s/ base neta
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={simIncluirIVA}
                                            onChange={e => setSimIncluirIVA(e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                                        />
                                    </div>

                                </div>
                            </GlassCard>

                            {/* Panel Derecho: Resultados, SVG de Desglose y Probabilidad */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {/* Card Principal de Oferta */}
                                <GlassCard style={{ padding: '24px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                VALOR FINAL OFERTA A PRESENTAR
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', fontFamily: tokens.font.heading }}>
                                                {formatARS(priceFormation.ofertaFinal)}
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>CAUCIÓN 1% REQUERIDA</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>
                                                {formatARS(priceFormation.caucionOferta)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Comparativa vs Oficial */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                        <div style={{ padding: '10px 14px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>DIFERENCIA VS OFICIAL</div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: priceFormation.desvioPct <= 0 ? '#10b981' : '#ef4444' }}>
                                                {priceFormation.desvioPct > 0 ? `+${priceFormation.desvioPct.toFixed(2)}%` : `${priceFormation.desvioPct.toFixed(2)}%`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                {formatARS(priceFormation.desvioMonto)}
                                            </div>
                                        </div>

                                        <div style={{ padding: '10px 14px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PROBABILIDAD ADJUDICACIÓN</div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: priceFormation.probabilidad >= 80 ? '#10b981' : priceFormation.probabilidad >= 50 ? '#f59e0b' : '#ef4444' }}>
                                                {priceFormation.probabilidad}%
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                {priceFormation.probabilidad >= 80 ? 'Rango muy competitivo' : 'Riesgo de descalificación'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gráfico SVG de Estructura de Costo (Stacked Bar) */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                                            COMPOSICIÓN DE LA OFERTA (% DE COSTO):
                                        </div>
                                        
                                        {/* SVG Bar */}
                                        <div style={{ width: '100%', height: '32px', borderRadius: '8px', overflow: 'hidden', background: '#0f172a', display: 'flex' }}>
                                            <div 
                                                style={{ 
                                                    width: `${(priceFormation.costoDirecto / priceFormation.ofertaFinal) * 100}%`, 
                                                    background: '#10b981' 
                                                }} 
                                            />
                                            <div 
                                                style={{ 
                                                    width: `${(priceFormation.gg / priceFormation.ofertaFinal) * 100}%`, 
                                                    background: '#f59e0b' 
                                                }} 
                                            />
                                            <div 
                                                style={{ 
                                                    width: `${(priceFormation.beneficio / priceFormation.ofertaFinal) * 100}%`, 
                                                    background: '#8b5cf6' 
                                                }} 
                                            />
                                            <div 
                                                style={{ 
                                                    width: `${(priceFormation.gastosFinancieros / priceFormation.ofertaFinal) * 100}%`, 
                                                    background: '#38bdf8' 
                                                }} 
                                            />
                                            {simIncluirIVA && (
                                                <div 
                                                    style={{ 
                                                        width: `${(priceFormation.impuestos / priceFormation.ofertaFinal) * 100}%`, 
                                                        background: '#64748b' 
                                                    }} 
                                                />
                                            )}
                                        </div>

                                        {/* Legend */}
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.72rem', color: '#94a3b8' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} />
                                                Directo ({((priceFormation.costoDirecto / priceFormation.ofertaFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} />
                                                GG ({((priceFormation.gg / priceFormation.ofertaFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#8b5cf6' }} />
                                                Beneficio ({((priceFormation.beneficio / priceFormation.ofertaFinal) * 100).toFixed(0)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#38bdf8' }} />
                                                Financiero ({((priceFormation.gastosFinancieros / priceFormation.ofertaFinal) * 100).toFixed(0)}%)
                                            </span>
                                            {simIncluirIVA && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#64748b' }} />
                                                    Impuestos ({((priceFormation.impuestos / priceFormation.ofertaFinal) * 100).toFixed(0)}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            style={{ flex: 1 }}
                                            onClick={() => {
                                                const offerText = `ESTRUCTURA DE OFERTA LICITACIÓN - OBRASAAS\n` +
                                                    `Presupuesto Oficial: ${formatARS(simPresupuestoOficial)}\n` +
                                                    `Costo Directo: ${formatARS(priceFormation.costoDirecto)}\n` +
                                                    `Gastos Generales (${simGastosGeneralesPct}%): ${formatARS(priceFormation.gg)}\n` +
                                                    `Beneficio Net (${simBeneficioPct}%): ${formatARS(priceFormation.beneficio)}\n` +
                                                    `Gastos Financieros (${simGastosFinancierosPct}%): ${formatARS(priceFormation.gastosFinancieros)}\n` +
                                                    `Impuestos IVA+IIBB: ${formatARS(priceFormation.impuestos)}\n` +
                                                    `TOTAL OFERTA FINAL: ${formatARS(priceFormation.ofertaFinal)}\n` +
                                                    `Caución de Mantenimiento Requerida: ${formatARS(priceFormation.caucionOferta)}\n` +
                                                    `Desvío vs Oficial: ${priceFormation.desvioPct.toFixed(2)}%`;
                                                navigator.clipboard?.writeText(offerText);
                                                setCopiedOffer(true);
                                                setTimeout(() => setCopiedOffer(false), 2500);
                                            }}
                                        >
                                            {copiedOffer ? '✓ Copiado al Portapapeles' : '📄 Copiar Resumen de Oferta'}
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => alert('Generando carátula y anexo de desglose de precios en PDF según modelo oficial Compr.ar...')}
                                        >
                                            Descargar Formato BAC
                                        </Button>
                                    </div>
                                </GlassCard>

                            </div>

                        </div>
                    </motion.div>
                )}

                {/* ========================================================================= */}
                {/* TAB 4: PIPELINE & ADJUDICACIONES */}
                {/* ========================================================================= */}
                {activeTab === 'pipeline' && (
                    <motion.div
                        key="tab-pipeline"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Resumen del Funnel */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    Pipeline Comercial de Licitaciones & Concursos
                                </h2>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                                    Trazabilidad extremo a extremo: desde la toma de pliego hasta la firma de contrato definitivo.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <Badge color="#10b981" variant="filled" size="sm">
                                    Total en Cartera: $1.545 M ARS
                                </Badge>
                                <Badge color="#3b82f6" variant="subtle" size="sm">
                                    5 Procesos Activos
                                </Badge>
                            </div>
                        </div>

                        {/* Kanban Columns */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', alignItems: 'start' }}>
                            {PIPELINE_DATA.map(col => (
                                <div
                                    key={col.etapa}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.65)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}
                                >
                                    {/* Header de Columna */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: `2px solid ${col.color}` }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                                            {col.tituloEtapa}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '10px', color: col.color, fontWeight: 700 }}>
                                            {col.items.length}
                                        </span>
                                    </div>

                                    {/* Items de Columna */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {col.items.map(item => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    background: 'rgba(30, 41, 59, 0.7)',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    padding: '14px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Badge color={col.color} variant="filled" size="xs">
                                                        {item.organismo}
                                                    </Badge>
                                                    {item.diasRestantes > 0 && (
                                                        <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700 }}>
                                                            ⏳ {item.diasRestantes}d restantes
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.3 }}>
                                                    {item.licitacion}
                                                </div>

                                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981' }}>
                                                    {formatARS(item.monto)}
                                                </div>

                                                {item.posicionOrden && (
                                                    <div style={{ fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                        {item.posicionOrden}
                                                    </div>
                                                )}

                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                    🛡️ Caución: <strong style={{ color: '#cbd5e1' }}>{item.caucionStatus}</strong>
                                                </div>

                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                    👤 Resp: <strong>{item.responsable}</strong>
                                                </div>

                                                {/* Barra de progreso de preparación */}
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginBottom: '3px' }}>
                                                        <span>Preparación de pliego:</span>
                                                        <span>{item.progresoPliego}%</span>
                                                    </div>
                                                    <ProgressBar value={item.progresoPliego} max={100} color={col.color} height={4} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

            </main>

            {/* ========================================================================= */}
            {/* MODAL 1: DETALLE DE PLIEGO Y REQUISITOS */}
            {/* ========================================================================= */}
            <Modal
                isOpen={!!selectedLicitacion}
                onClose={() => setSelectedLicitacion(null)}
                title={selectedLicitacion?.title || 'Detalle del Pliego'}
                subtitle={`Expediente: ${selectedLicitacion?.expediente || ''} • Organismo: ${selectedLicitacion?.organismo || ''}`}
                maxWidth="650px"
            >
                {selectedLicitacion && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PRESUPUESTO OFICIAL</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
                                    {formatARS(selectedLicitacion.presupuestoOficial)}
                                </div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>CAUCIÓN DE OFERTA (1%)</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b' }}>
                                    {formatARS(selectedLicitacion.caucion)}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                                Memoria Descriptiva & Alcance:
                            </div>
                            <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                                {selectedLicitacion.descripcion}
                            </p>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                                Requisitos de Admisibilidad Técnica & Pliego:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {selectedLicitacion.requisitos?.map((req, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                        <span style={{ color: '#10b981' }}>✓</span>
                                        <span>{req}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                Valor del Pliego: <strong style={{ color: '#f8fafc' }}>{selectedLicitacion.pliegoGratis ? 'GRATUITO' : formatARS(selectedLicitacion.costoPliego)}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => alert(`Descargando Pliego General de Condiciones, Pliego Técnico y Planos para ${selectedLicitacion.title}`)}
                                >
                                    Descargar Pliego Completo (ZIP)
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: CONFIRMACIÓN DE ADJUDICACIÓN & WHATSAPP */}
            {/* ========================================================================= */}
            <Modal
                isOpen={!!awardingSub}
                onClose={() => setAwardingSub(null)}
                title="Confirmar Adjudicación de Subcontrato"
                subtitle={`Paquete: ${awardingSub?.paquete?.titulo || ''}`}
                maxWidth="560px"
            >
                {awardingSub && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>SUBCONTRATISTA SELECCIONADO</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
                                {awardingSub.sub.nombre}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                CUIT: {awardingSub.sub.cuit} • Contacto: {awardingSub.sub.representante}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>MONTO TOTAL ADJUDICADO</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                                    {formatARS(awardingSub.sub.total)}
                                </div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PLAZO COMPROMETIDO</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f59e0b' }}>
                                    {awardingSub.sub.plazoDias} días
                                </div>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            Al confirmar, se generará la Orden de Compra preventiva en el ERP y se enviará la comunicación oficial con requerimiento de entrega de Póliza ART de nómina y Seguro de Caución de Ejecución de Contrato.
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                            <Button
                                variant="primary"
                                size="md"
                                style={{ flex: 1 }}
                                onClick={() => {
                                    setWhatsAppDispatched(true);
                                    const message = `Estimado *${awardingSub.sub.nombre}* (${awardingSub.sub.representante}), le notificamos que su propuesta para el paquete *${awardingSub.paquete.titulo}* ha sido PRE-ADJUDICADA formalmente por ObraSaaS Constructora. Monto adjudicado: ${formatARS(awardingSub.sub.total)} + IVA. Plazo: ${awardingSub.sub.plazoDias} días. Favor de remitir nómina con cobertura ART para ingreso a obra.`;
                                    window.open(`https://wa.me/${awardingSub.sub.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                                }}
                            >
                                {whatsAppDispatched ? '✓ Notificado por WhatsApp' : 'Confirmar & Enviar WhatsApp 💬'}
                            </Button>

                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setAwardingSub(null)}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 3: INVITAR SUBCONTRATISTA NUEVO */}
            {/* ========================================================================= */}
            <Modal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                title="Invitar Subcontratista al Concurso de Precios"
                subtitle="Genere un enlace seguro para que el proveedor cargue su cotización técnica"
                maxWidth="520px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                            Paquete / Rubro a cotizar:
                        </label>
                        <select
                            value={selectedPackageId}
                            onChange={e => setSelectedPackageId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '0.85rem'
                            }}
                        >
                            {CONCURSOS_PAQUETES.map(p => (
                                <option key={p.id} value={p.id}>{p.titulo} ({p.rubro})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '4px' }}>ENLACE DE COTIZACIÓN PARA PROVEEDORES:</div>
                        <div style={{ fontSize: '0.82rem', fontFamily: tokens.font.mono, color: '#3b82f6', wordBreak: 'break-all' }}>
                            https://obrasaas.vercel.app/concursos/proveedor?pkg={selectedPackageId}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <Button
                            variant="primary"
                            size="sm"
                            style={{ flex: 1 }}
                            onClick={() => {
                                navigator.clipboard?.writeText(`https://obrasaas.vercel.app/concursos/proveedor?pkg=${selectedPackageId}`);
                                alert('Enlace copiado al portapapeles. Puede compartirlo por WhatsApp o Email.');
                            }}
                        >
                            Copiar Enlace
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowInviteModal(false)}
                        >
                            Cerrar
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
}
