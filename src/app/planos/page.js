"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, PageHeader, Modal } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function PlanosPage() {
    const { isMobile } = useBreakpoint();
    const [discipline, setDiscipline] = useState('Arquitectura');
    const [sheet, setSheet] = useState('planta-tipo');
    const [zoom, setZoom] = useState(1);
    const [activeViewMode, setActiveViewMode] = useState('planos'); // 'planos' | 'punchlist' | 'rfi'
    const [activeTool, setActiveTool] = useState('pin'); // 'pin' | 'measure' | 'cloud' | 'stamp'
    const [measurePoints, setMeasurePoints] = useState([]);
    const [measurements, setMeasurements] = useState([
        { id: 'm-1', x1: 80, y1: 80, x2: 400, y2: 80, lengthMeters: 6.4, label: '6.40 m' }
    ]);
    const [clouds, setClouds] = useState([
        { id: 'c-1', x: 440, y: 180, width: 140, height: 80, text: 'Verificar cota de mesada con instalador sanitario' }
    ]);
    const [stamps, setStamps] = useState([
        { id: 's-1', x: 800, y: 120, text: 'APROBADO PARA CONSTRUCCIÓN', date: '18/08/2026', author: 'Arq. Marcelo' }
    ]);
    const [pins, setPins] = useState([
        { id: 'pin-1', x: 35, y: 42, discipline: 'Arquitectura', type: 'critical', title: 'Falta Enlucido Fino', reporter: 'Arq. Marcelo', date: '18 Ago', trade: 'Albañilería Principal', status: 'EN_CORRECCION', photoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb180c5f5?auto=format&fit=crop&w=600&q=80', deadline: '20 Ago' },
        { id: 'pin-2', x: 68, y: 28, discipline: 'Sanitarias', type: 'warning', title: 'Prueba Hidráulica Pendiente en Columna B', reporter: 'Carlos Pérez', date: '18 Ago', trade: 'Plomero / Gasista', status: 'ABIERTA', photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80', deadline: '19 Ago' },
        { id: 'pin-3', x: 50, y: 75, discipline: 'Estructura', type: 'success', title: 'Losa Nivelada 100% y Curada', reporter: 'Juan Gómez', date: '17 Ago', trade: 'Albañilería Principal', status: 'APROBADA', photoUrl: null, deadline: '17 Ago' },
        { id: 'pin-4', x: 82, y: 60, discipline: 'Eléctricas', type: 'info', title: 'Pase de Cañero Embutido en Tabique', reporter: 'Miguel Silva', date: '16 Ago', trade: 'Electricista Matriculado', status: 'RESUELTA', photoUrl: null, deadline: '18 Ago' }
    ]);
    const [rfis, setRfis] = useState([]);
    const [selectedPin, setSelectedPin] = useState(null);
    const [newPinModal, setNewPinModal] = useState({ show: false, x: 0, y: 0 });
    const [newPinTitle, setNewPinTitle] = useState('');
    const [newPinType, setNewPinType] = useState('warning');
    const [newPinTrade, setNewPinTrade] = useState('Albañilería Principal');
    const [newPinDeadline, setNewPinDeadline] = useState('24hs');
    const [filterStatus, setFilterStatus] = useState('all');
    const [exportNotice, setExportNotice] = useState(false);

    useEffect(() => {
        fetch('/api/v1/rfi')
            .then(r => r.json())
            .then(d => { if (d.rfis) setRfis(d.rfis); })
            .catch(() => {});
    }, []);

    const disciplines = [
        { id: 'Arquitectura', icon: '🏛️', label: 'Arquitectura' },
        { id: 'Estructura', icon: '🏗️', label: 'Estructura (CIRSOC)' },
        { id: 'Sanitarias', icon: '🚰', label: 'Inst. Sanitarias' },
        { id: 'Eléctricas', icon: '⚡', label: 'Inst. Eléctricas' }
    ];

    const sheets = [
        { id: 'planta-tipo', code: 'ARQ-P03-REV02', name: 'Planta Tipo (Pisos 1 al 6)', scale: '1:50' },
        { id: 'subsuelo', code: 'EST-S01-REV01', name: 'Subsuelo S1 & Fundaciones', scale: '1:75' },
        { id: 'planta-baja', code: 'ARQ-PB-REV04', name: 'Planta Baja & Hall de Acceso', scale: '1:50' },
        { id: 'azotea', code: 'INS-AZ-REV01', name: 'Azotea Técnica & Tanques', scale: '1:100' }
    ];

    const tradesList = [
        'Albañilería Principal (Juan Gómez)',
        'Plomero / Gasista (Luis Martínez)',
        'Pintor / Revestimientos (Carlos Pérez)',
        'Electricista Matriculado',
        'Herrería & Estructuras Metálicas',
        'Yesería & Durlock'
    ];

    const handleCanvasClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const xPercent = Math.round((rawX / rect.width) * 100);
        const yPercent = Math.round((rawY / rect.height) * 100);

        if (activeTool === 'pin') {
            setNewPinModal({ show: true, x: xPercent, y: yPercent });
        } else if (activeTool === 'measure') {
            if (measurePoints.length === 0) {
                setMeasurePoints([{ x: rawX, y: rawY }]);
            } else {
                const p1 = measurePoints[0];
                const p2 = { x: rawX, y: rawY };
                const distPx = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                // Scale factor: approx 50px = 1 meter in SVG
                const meters = (distPx / 50).toFixed(2);
                setMeasurements([...measurements, {
                    id: `m-${Date.now()}`,
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    lengthMeters: meters,
                    label: `${meters} m`
                }]);
                setMeasurePoints([]);
            }
        } else if (activeTool === 'cloud') {
            setClouds([...clouds, {
                id: `c-${Date.now()}`,
                x: rawX - 60,
                y: rawY - 30,
                width: 140,
                height: 70,
                text: 'Revisión Técnica en Obra'
            }]);
        } else if (activeTool === 'stamp') {
            setStamps([...stamps, {
                id: `s-${Date.now()}`,
                x: rawX - 80,
                y: rawY - 25,
                text: 'APROBADO POR DIRECCIÓN',
                date: new Date().toLocaleDateString('es-AR'),
                author: 'Arq. Marcelo'
            }]);
        }
    };

    const handleCreatePin = (e) => {
        e.preventDefault();
        if (!newPinTitle) return;

        const newPin = {
            id: `pin-${Date.now()}`,
            x: newPinModal.x,
            y: newPinModal.y,
            discipline,
            type: newPinType,
            title: newPinTitle,
            reporter: 'Arq. Marcelo (Director)',
            date: 'Hoy',
            trade: newPinTrade,
            status: 'ABIERTA',
            photoUrl: null,
            deadline: newPinDeadline
        };

        setPins([...pins, newPin]);
        setNewPinModal({ show: false, x: 0, y: 0 });
        setNewPinTitle('');
    };

    const handleUpdatePinStatus = (pinId, newStatus) => {
        setPins(pins.map(p => p.id === pinId ? { ...p, status: newStatus } : p));
        if (selectedPin && selectedPin.id === pinId) {
            setSelectedPin({ ...selectedPin, status: newStatus });
        }
    };

    const handleExportPlan = () => {
        setExportNotice(true);
        setTimeout(() => setExportNotice(false), 4000);
    };

    const currentSheetObj = sheets.find(s => s.id === sheet) || sheets[0];

    const filteredPins = pins.filter(p => {
        const matchDisc = p.discipline === discipline;
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        return matchDisc && matchStatus;
    });

    const pinColorMap = {
        critical: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        success: '#10b981'
    };

    const statusBadgeMap = {
        ABIERTA: { color: '#ef4444', label: '🔴 ABIERTA' },
        EN_CORRECCION: { color: '#f59e0b', label: '🟡 EN CORRECCIÓN' },
        RESUELTA: { color: '#3b82f6', label: '🔵 RESUELTA' },
        APROBADA: { color: '#10b981', label: '🟢 APROBADA POR DIRECCIÓN' }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                title="Visor de Planos CAD & Geocontrol en Terreno"
                subtitle="Navegación vectorial multipágina con marcado QA/QC, mediciones calibradas y sellos de aprobación"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Planos' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                            <Button variant="secondary" size="sm">← Dashboard</Button>
                        </Link>
                        <Button variant="secondary" size="sm" icon="📥" onClick={handleExportPlan}>
                            Exportar Lámina
                        </Button>
                        <Button variant="primary" size="sm" icon="+" onClick={() => setNewPinModal({ show: true, x: 50, y: 50 })}>
                            Nuevo Marcador
                        </Button>
                    </div>
                }
            />

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px clamp(14px, 4vw, 32px) 80px' }}>
                
                {exportNotice && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>✅</span> Lámina {currentSheetObj.code} con {pins.length} marcadores y {measurements.length} cotas generada para descarga en alta resolución.
                    </div>
                )}

                {/* View Mode & Control Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                    {/* View Switcher Tabs */}
                    <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <button
                            onClick={() => setActiveViewMode('planos')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background: activeViewMode === 'planos' ? '#f59e0b' : 'transparent',
                                color: activeViewMode === 'planos' ? '#060913' : '#94a3b8',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            📐 Plano 2D & Marcadores ({pins.length})
                        </button>
                        <button
                            onClick={() => setActiveViewMode('punchlist')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background: activeViewMode === 'punchlist' ? '#f59e0b' : 'transparent',
                                color: activeViewMode === 'punchlist' ? '#060913' : '#94a3b8',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            📋 Punch List QA/QC
                        </button>
                        <button
                            onClick={() => setActiveViewMode('rfi')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background: activeViewMode === 'rfi' ? '#f59e0b' : 'transparent',
                                color: activeViewMode === 'rfi' ? '#060913' : '#94a3b8',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            💬 Consultas RFI ({rfis.length})
                        </button>
                    </div>

                    {/* Sheet & Discipline Selectors */}
                    {activeViewMode === 'planos' && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                                value={sheet}
                                onChange={e => setSheet(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#f8fafc',
                                    fontSize: '0.8rem',
                                    fontWeight: 600
                                }}
                            >
                                {sheets.map(s => (
                                    <option key={s.id} value={s.id}>📄 {s.code} • {s.name}</option>
                                ))}
                            </select>

                            <div style={{ display: 'flex', gap: '4px' }}>
                                {disciplines.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => setDiscipline(d.id)}
                                        style={{
                                            padding: '7px 12px',
                                            borderRadius: '8px',
                                            border: discipline === d.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                            background: discipline === d.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                            color: discipline === d.id ? '#38bdf8' : '#94a3b8',
                                            fontSize: '0.78rem',
                                            fontWeight: discipline === d.id ? 700 : 500,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span>{d.icon}</span>
                                        <span>{d.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* VIEW 1: INTERACTIVE 2D FLOORPLAN & FIELDWIRE MARKUP TOOLS */}
                {activeViewMode === 'planos' && (
                    <div style={{ display: 'grid', gridTemplateColumns: (selectedPin && !isMobile) ? '1fr 360px' : '1fr', gap: '20px', alignItems: 'start' }}>
                        
                        <GlassCard style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                            
                            {/* Toolbar Header (Fieldwire style) */}
                            <div style={{ padding: '10px 16px', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 700 }}>
                                        {currentSheetObj.code}
                                    </span>
                                    <Badge color="#38bdf8" variant="filled" size="xs">Escala {currentSheetObj.scale}</Badge>

                                    {/* Tool Selector Bar */}
                                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(6, 9, 19, 0.7)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <button
                                            onClick={() => setActiveTool('pin')}
                                            style={{ padding: '4px 10px', borderRadius: '6px', background: activeTool === 'pin' ? '#f59e0b' : 'transparent', color: activeTool === 'pin' ? '#060913' : '#94a3b8', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            📍 Pin QA/QC
                                        </button>
                                        <button
                                            onClick={() => setActiveTool('measure')}
                                            style={{ padding: '4px 10px', borderRadius: '6px', background: activeTool === 'measure' ? '#38bdf8' : 'transparent', color: activeTool === 'measure' ? '#060913' : '#94a3b8', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            📏 Regla de Medición
                                        </button>
                                        <button
                                            onClick={() => setActiveTool('cloud')}
                                            style={{ padding: '4px 10px', borderRadius: '6px', background: activeTool === 'cloud' ? '#a855f7' : 'transparent', color: activeTool === 'cloud' ? '#fff' : '#94a3b8', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            ☁️ Nube de Revisión
                                        </button>
                                        <button
                                            onClick={() => setActiveTool('stamp')}
                                            style={{ padding: '4px 10px', borderRadius: '6px', background: activeTool === 'stamp' ? '#10b981' : 'transparent', color: activeTool === 'stamp' ? '#060913' : '#94a3b8', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            🏷️ Sello Dirección
                                        </button>
                                    </div>
                                </div>

                                {/* Zoom Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button onClick={() => setZoom(Math.max(0.7, zoom - 0.15))} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', cursor: 'pointer' }}>-</button>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                                    <button onClick={() => setZoom(Math.min(2.0, zoom + 0.15))} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', cursor: 'pointer' }}>+</button>
                                    <button onClick={() => setZoom(1)} style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer' }}>Reset</button>
                                </div>
                            </div>

                            {/* Plan Canvas SVG with Markup Layers */}
                            <div
                                onClick={handleCanvasClick}
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    minHeight: '440px',
                                    height: '62vh',
                                    background: '#040711',
                                    overflow: 'auto',
                                    cursor: activeTool === 'pin' ? 'crosshair' : activeTool === 'measure' ? 'cell' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    touchAction: 'pan-x pan-y',
                                    WebkitOverflowScrolling: 'touch'
                                }}
                            >
                                <svg width="1000" height="600" viewBox="0 0 1000 600" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s', width: '100%', height: '100%', minWidth: '700px' }}>
                                    <defs>
                                        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="1" />
                                        </pattern>
                                    </defs>
                                    <rect width="1000" height="600" fill="url(#grid-pattern)" />

                                    {/* Architectural Walls */}
                                    <rect x="80" y="80" width="840" height="440" fill="none" stroke="#38bdf8" strokeWidth="4" />
                                    <line x1="400" y1="80" x2="400" y2="520" stroke="#38bdf8" strokeWidth="3" />
                                    <line x1="80" y1="320" x2="400" y2="320" stroke="#38bdf8" strokeWidth="3" />
                                    <line x1="650" y1="80" x2="650" y2="360" stroke="#38bdf8" strokeWidth="3" />

                                    {/* Room Labels */}
                                    <text x="140" y="180" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">DORMITORIO PPAL</text>
                                    <text x="140" y="420" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">ESTAR / COMEDOR</text>
                                    <text x="440" y="180" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">COCINA INTEGRADA</text>
                                    <text x="720" y="180" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">SUITE BALCÓN</text>
                                    <text x="560" y="440" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">TERRAZA TÉCNICA</text>

                                    {/* Measurements Layer */}
                                    {measurements.map(m => (
                                        <g key={m.id}>
                                            <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#38bdf8" strokeWidth="2" strokeDasharray="4,4" />
                                            <circle cx={m.x1} cy={m.y1} r="4" fill="#38bdf8" />
                                            <circle cx={m.x2} cy={m.y2} r="4" fill="#38bdf8" />
                                            <rect x={(m.x1 + m.x2) / 2 - 25} y={(m.y1 + m.y2) / 2 - 12} width="50" height="20" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                                            <text x={(m.x1 + m.x2) / 2} y={(m.y1 + m.y2) / 2 + 2} fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">
                                                {m.label}
                                            </text>
                                        </g>
                                    ))}

                                    {/* Revision Clouds Layer */}
                                    {clouds.map(c => (
                                        <g key={c.id}>
                                            <rect x={c.x} y={c.y} width={c.width} height={c.height} rx="14" fill="rgba(168, 85, 247, 0.1)" stroke="#a855f7" strokeWidth="2" strokeDasharray="6,4" />
                                            <text x={c.x + 8} y={c.y + 20} fill="#d8b4fe" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                                                ☁️ {c.text}
                                            </text>
                                        </g>
                                    ))}

                                    {/* Stamps Layer */}
                                    {stamps.map(s => (
                                        <g key={s.id} transform={`translate(${s.x}, ${s.y}) rotate(-5)`}>
                                            <rect x="0" y="0" width="180" height="50" rx="6" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" />
                                            <text x="90" y="20" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                                                ✓ {s.text}
                                            </text>
                                            <text x="90" y="38" fill="#6ee7b7" fontSize="9" textAnchor="middle" fontFamily="sans-serif">
                                                {s.author} • {s.date}
                                            </text>
                                        </g>
                                    ))}
                                </svg>

                                {/* Clickable Pins */}
                                {filteredPins.map(pin => (
                                    <motion.div
                                        key={pin.id}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }}
                                        style={{
                                            position: 'absolute',
                                            left: `${pin.x}%` ,
                                            top: `${pin.y}%`,
                                            transform: 'translate(-50%, -100%)',
                                            cursor: 'pointer',
                                            zIndex: 10
                                        }}
                                    >
                                        <div style={{
                                            background: pinColorMap[pin.type] || '#f59e0b',
                                            color: '#fff',
                                            width: '30px',
                                            height: '30px',
                                            borderRadius: '50% 50% 50% 0',
                                            transform: 'rotate(-45deg)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: `0 4px 14px ${pinColorMap[pin.type]}90`,
                                            border: '2px solid #fff'
                                        }}>
                                            <span style={{ transform: 'rotate(45deg)', fontSize: '11px', fontWeight: 900 }}>📍</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </GlassCard>

                        {/* Side Detail Card for Selected Pin */}
                        {selectedPin && (
                            <GlassCard style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <Badge color={statusBadgeMap[selectedPin.status]?.color || '#f59e0b'} variant="filled" size="xs">
                                            {statusBadgeMap[selectedPin.status]?.label || selectedPin.status}
                                        </Badge>
                                        <button
                                            onClick={() => setSelectedPin(null)}
                                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 10px', color: '#f8fafc' }}>
                                        {selectedPin.title}
                                    </h3>

                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                        <div>🏷️ Disciplina: <strong style={{ color: '#f8fafc' }}>{selectedPin.discipline}</strong></div>
                                        <div>👷 Gremio Asignado: <strong style={{ color: '#f59e0b' }}>{selectedPin.trade}</strong></div>
                                        <div>👤 Reportó: <strong style={{ color: '#f8fafc' }}>{selectedPin.reporter}</strong></div>
                                        <div>⏰ Plazo Máximo: <strong style={{ color: '#38bdf8' }}>{selectedPin.deadline}</strong></div>
                                        <div>📍 Coordenadas: <code style={{ color: '#f59e0b' }}>X:{selectedPin.x}% Y:{selectedPin.y}%</code></div>
                                    </div>

                                    {/* Status Transition Buttons */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                                            Cambiar Estado QA/QC:
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                            <button
                                                onClick={() => handleUpdatePinStatus(selectedPin.id, 'EN_CORRECCION')}
                                                style={{ padding: '6px', borderRadius: '6px', background: selectedPin.status === 'EN_CORRECCION' ? '#f59e0b' : 'rgba(15, 23, 42, 0.6)', color: selectedPin.status === 'EN_CORRECCION' ? '#060913' : '#fcd34d', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                🟡 En Corrección
                                            </button>
                                            <button
                                                onClick={() => handleUpdatePinStatus(selectedPin.id, 'RESUELTA')}
                                                style={{ padding: '6px', borderRadius: '6px', background: selectedPin.status === 'RESUELTA' ? '#3b82f6' : 'rgba(15, 23, 42, 0.6)', color: selectedPin.status === 'RESUELTA' ? '#fff' : '#93c5fd', border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                🔵 Resuelta
                                            </button>
                                            <button
                                                onClick={() => handleUpdatePinStatus(selectedPin.id, 'APROBADA')}
                                                style={{ gridColumn: 'span 2', padding: '6px', borderRadius: '6px', background: selectedPin.status === 'APROBADA' ? '#10b981' : 'rgba(15, 23, 42, 0.6)', color: selectedPin.status === 'APROBADA' ? '#060913' : '#86efac', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                🟢 Aprobada por Dirección
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Button
                                        variant="whatsapp"
                                        size="sm"
                                        icon="💬"
                                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🚨 *NO CONFORMIDAD EN OBRA*\n• Título: *${selectedPin.title}*\n• Gremio: ${selectedPin.trade}\n• Disciplina: ${selectedPin.discipline}\n• Coordenadas: X:${selectedPin.x}% Y:${selectedPin.y}%\n• Plazo de Subsanación: ${selectedPin.deadline}\n\n_Gestionado vía ObraSaaS QA/QC Engine_`)}`)}
                                    >
                                        Notificar al Gremio por WhatsApp
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => {
                                            setPins(pins.filter(p => p.id !== selectedPin.id));
                                            setSelectedPin(null);
                                        }}
                                    >
                                        Eliminar Marcador
                                    </Button>
                                </div>
                            </GlassCard>
                        )}

                    </div>
                )}

                {/* VIEW 2: PUNCH LIST & NO CONFORMIDADES TABLE */}
                {activeViewMode === 'punchlist' && (
                    <GlassCard style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    📋 Punch List & Registro de No Conformidades
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                    Seguimiento riguroso de vicios, terminaciones y observaciones por subcontratista
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['all', 'ABIERTA', 'EN_CORRECCION', 'RESUELTA', 'APROBADA'].map(st => (
                                    <button
                                        key={st}
                                        onClick={() => setFilterStatus(st)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: filterStatus === st ? '#f59e0b' : 'rgba(15, 23, 42, 0.6)',
                                            color: filterStatus === st ? '#060913' : '#94a3b8',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {st === 'all' ? 'Todos' : st}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b', textAlign: 'left' }}>
                                        <th style={{ padding: '10px' }}>ESTADO</th>
                                        <th style={{ padding: '10px' }}>DESCRIPCIÓN DE NO CONFORMIDAD</th>
                                        <th style={{ padding: '10px' }}>GREMIO RESPONSABLE</th>
                                        <th style={{ padding: '10px' }}>DISCIPLINA</th>
                                        <th style={{ padding: '10px' }}>PLAZO</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pins.filter(p => filterStatus === 'all' || p.status === filterStatus).map((p, i) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(15, 23, 42, 0.3)' : 'transparent' }}>
                                            <td style={{ padding: '12px 10px' }}>
                                                <Badge color={statusBadgeMap[p.status]?.color || '#f59e0b'} variant="filled" size="xs">
                                                    {statusBadgeMap[p.status]?.label || p.status}
                                                </Badge>
                                            </td>
                                            <td style={{ padding: '12px 10px', fontWeight: 700, color: '#f8fafc' }}>
                                                {p.title}
                                                <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>Ubicación: X:{p.x}% Y:{p.y}%</span>
                                            </td>
                                            <td style={{ padding: '12px 10px', color: '#f59e0b', fontWeight: 600 }}>{p.trade}</td>
                                            <td style={{ padding: '12px 10px', color: '#94a3b8' }}>{p.discipline}</td>
                                            <td style={{ padding: '12px 10px', color: '#38bdf8', fontWeight: 700 }}>{p.deadline}</td>
                                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => { setSelectedPin(p); setActiveViewMode('planos'); }}
                                                        style={{ padding: '4px 8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                                                    >
                                                        Ver en Plano
                                                    </button>
                                                    <button
                                                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🚨 *RECLAMO PUNCH LIST OBRA*\n• Ítem: *${p.title}*\n• Gremio: ${p.trade}\n• Plazo: ${p.deadline}\n\nPor favor confirmar inicio de reparación por este medio.`)}`)}
                                                        style={{ padding: '4px 8px', background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', border: '1px solid rgba(37, 211, 102, 0.3)', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                                                    >
                                                        💬 WhatsApp
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                )}

                {/* VIEW 3: RFIS (CONSULTAS TÉCNICAS) */}
                {activeViewMode === 'rfi' && (
                    <GlassCard style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc' }}>
                                    💬 Consultas Técnicas Formales (RFIs & Ball-in-Court)
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                                    Resolución de interferencias, cotas y detalles constructivos sin retrasar el cronograma
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <Link href="/inspecciones" style={{ textDecoration: 'none' }}>
                                    <Button variant="secondary" size="sm" icon="📋">Inspecciones</Button>
                                </Link>
                                <Link href="/documentos" style={{ textDecoration: 'none' }}>
                                    <Button variant="secondary" size="sm" icon="📁">Documentos</Button>
                                </Link>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px' }}>
                            {rfis.map(rfi => (
                                <div key={rfi.id} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <Badge color={rfi.status === 'RESPONDIDO' ? '#10b981' : '#f59e0b'} variant="filled" size="xs">
                                                RFI #{rfi.rfiNumber} • {rfi.status}
                                            </Badge>
                                            <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{rfi.discipline}</span>
                                        </div>

                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
                                            {rfi.subject}
                                        </h4>
                                        <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 12px' }}>
                                            "{rfi.question}"
                                        </p>

                                        {rfi.officialAnswer ? (
                                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '12px' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginBottom: '2px' }}>✓ RESPUESTA OFICIAL DIRECCIÓN:</div>
                                                <div style={{ fontSize: '0.78rem', color: '#f8fafc' }}>{rfi.officialAnswer}</div>
                                            </div>
                                        ) : (
                                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '12px' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, marginBottom: '2px' }}>⏳ RESPONSABLE ACTUAL (BALL-IN-COURT):</div>
                                                <div style={{ fontSize: '0.78rem', color: '#fcd34d' }}>{rfi.ballInCourt}</div>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon="💬"
                                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`📋 *RFI #${rfi.rfiNumber}: ${rfi.subject}*\n• Estado: ${rfi.status}\n• Consulta: ${rfi.question}\n• Respuesta: ${rfi.officialAnswer || 'Pendiente de Director'}`)}`)}
                                    >
                                        Compartir RFI en WhatsApp
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                )}

            </main>

            {/* Create Pin Modal */}
            <Modal
                isOpen={newPinModal.show}
                onClose={() => setNewPinModal({ show: false, x: 0, y: 0 })}
                title="Nuevo Marcador de No Conformidad sobre Plano"
                subtitle={`Ubicación seleccionada en ${discipline}: X:${newPinModal.x}% Y:${newPinModal.y}%`}
            >
                <form onSubmit={handleCreatePin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Título del Reclamo / No Conformidad *</label>
                        <input
                            required
                            placeholder="Ej: Caño de desagüe sin pendiente en losa"
                            value={newPinTitle}
                            onChange={e => setNewPinTitle(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Gremio Responsable Asignado</label>
                        <select
                            value={newPinTrade}
                            onChange={e => setNewPinTrade(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        >
                            {tradesList.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Severidad</label>
                            <select
                                value={newPinType}
                                onChange={e => setNewPinType(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                            >
                                <option value="critical">🚨 Crítica / Vicio Oculto</option>
                                <option value="warning">⚠️ Alerta / Observación</option>
                                <option value="info">ℹ️ Nota Técnica</option>
                                <option value="success">✅ Aprobado</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Plazo de Corrección</label>
                            <input
                                placeholder="Ej: 24hs, 48hs"
                                value={newPinDeadline}
                                onChange={e => setNewPinDeadline(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                            />
                        </div>
                    </div>

                    <Button variant="primary" size="md" style={{ width: '100%', marginTop: '6px' }} icon="📍">
                        Registrar en Punch List & Colocar Marcador
                    </Button>
                </form>
            </Modal>

        </div>
    );
}
