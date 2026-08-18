"use client";

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, PageHeader, Modal } from '@/lib/design-system';

export default function PlanosPage() {
    const [discipline, setDiscipline] = useState('Arquitectura');
    const [zoom, setZoom] = useState(1);
    const [pins, setPins] = useState([
        { id: 'pin-1', x: 35, y: 42, discipline: 'Arquitectura', type: 'critical', title: 'Falta Enlucido Fino', reporter: 'Arq. Marcelo', date: '18 Ago' },
        { id: 'pin-2', x: 68, y: 28, discipline: 'Sanitarias', type: 'warning', title: 'Prueba Hidráulica Pendiente', reporter: 'Carlos Pérez', date: '18 Ago' },
        { id: 'pin-3', x: 50, y: 75, discipline: 'Estructura', type: 'success', title: 'Losa Nivelada 100%', reporter: 'Juan Gómez', date: '17 Ago' },
        { id: 'pin-4', x: 82, y: 60, discipline: 'Eléctricas', type: 'info', title: 'Pase de Cañero Embutido', reporter: 'Miguel Silva', date: '16 Ago' }
    ]);
    const [selectedPin, setSelectedPin] = useState(null);
    const [newPinModal, setNewPinModal] = useState({ show: false, x: 0, y: 0 });
    const [newPinTitle, setNewPinTitle] = useState('');
    const [newPinType, setNewPinType] = useState('warning');

    const disciplines = [
        { id: 'Arquitectura', icon: '🏛️', label: 'Arquitectura' },
        { id: 'Estructura', icon: '🏗️', label: 'Estructura (CIRSOC)' },
        { id: 'Sanitarias', icon: '🚰', label: 'Inst. Sanitarias' },
        { id: 'Eléctricas', icon: '⚡', label: 'Inst. Eléctricas' }
    ];

    const handleCanvasClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

        setNewPinModal({ show: true, x, y });
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
            reporter: 'Arq. Marcelo',
            date: 'Hoy'
        };

        setPins([...pins, newPin]);
        setNewPinModal({ show: false, x: 0, y: 0 });
        setNewPinTitle('');
    };

    const filteredPins = pins.filter(p => p.discipline === discipline);

    const pinColorMap = {
        critical: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        success: '#10b981'
    };

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                icon="📐"
                title="Visor de Planos Interactivos & Geocontrol en Terreno"
                subtitle="Navegación de planos CAD / DWG con marcado de incidencias geolocalizadas"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Planos' }]}
                actions={
                    <>
                        <Link href="/dashboard">
                            <Button variant="secondary" size="sm">← Dashboard</Button>
                        </Link>
                        <Button variant="primary" size="sm" icon="+" onClick={() => setNewPinModal({ show: true, x: 50, y: 50 })}>
                            Nuevo Marcador
                        </Button>
                    </>
                }
            />

            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 24px 80px' }}>
                
                {/* Top Discipline Bar & Zoom Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    
                    {/* Discipline Switcher */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {disciplines.map(d => (
                            <button
                                key={d.id}
                                onClick={() => setDiscipline(d.id)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: discipline === d.id ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                                    background: discipline === d.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                    color: discipline === d.id ? '#fbbf24' : '#94a3b8',
                                    fontSize: '0.84rem',
                                    fontWeight: discipline === d.id ? 700 : 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span>{d.icon}</span>
                                <span>{d.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Zoom & View Controls */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Button variant="secondary" size="sm" onClick={() => setZoom(prev => Math.max(0.7, prev - 0.15))}>🔍 -</Button>
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontFamily: tokens.font.mono }}>{Math.round(zoom * 100)}%</span>
                        <Button variant="secondary" size="sm" onClick={() => setZoom(prev => Math.min(2.0, prev + 0.15))}>🔍 +</Button>
                        <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>Reset</Button>
                    </div>
                </div>

                {/* Main Blueprint Canvas Area */}
                <div style={{ display: 'grid', gridTemplateColumns: selectedPin ? '1fr 340px' : '1fr', gap: '20px' }}>
                    
                    <GlassCard style={{ padding: '20px', overflow: 'auto', minHeight: '620px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        
                        <div
                            onClick={handleCanvasClick}
                            style={{
                                width: '920px',
                                height: '580px',
                                background: '#0a0f1d',
                                border: '2px solid rgba(59, 130, 246, 0.4)',
                                borderRadius: '12px',
                                position: 'relative',
                                transform: `scale(${zoom})`,
                                transformOrigin: 'center center',
                                transition: 'transform 0.2s ease',
                                cursor: 'crosshair',
                                backgroundImage: `
                                    linear-gradient(to right, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(59, 130, 246, 0.08) 1px, transparent 1px)
                                `,
                                backgroundSize: '40px 40px'
                            }}
                        >
                            {/* Blueprint SVG Vector Layout */}
                            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                                {/* Perimeter walls */}
                                <rect x="40" y="40" width="840" height="500" fill="none" stroke="#38bdf8" strokeWidth="3" strokeDasharray="0" />
                                
                                {/* Room divisions */}
                                <line x1="320" y1="40" x2="320" y2="540" stroke="#38bdf8" strokeWidth="2" />
                                <line x1="620" y1="40" x2="620" y2="340" stroke="#38bdf8" strokeWidth="2" />
                                <line x1="40" y1="300" x2="320" y2="300" stroke="#38bdf8" strokeWidth="2" />
                                <line x1="320" y1="340" x2="880" y2="340" stroke="#38bdf8" strokeWidth="2" />

                                {/* Columns & Structural elements */}
                                <rect x="35" y="35" width="20" height="20" fill="#f59e0b" />
                                <rect x="310" y="35" width="20" height="20" fill="#f59e0b" />
                                <rect x="610" y="35" width="20" height="20" fill="#f59e0b" />
                                <rect x="865" y="35" width="20" height="20" fill="#f59e0b" />
                                <rect x="35" y="525" width="20" height="20" fill="#f59e0b" />
                                <rect x="310" y="525" width="20" height="20" fill="#f59e0b" />
                                <rect x="865" y="525" width="20" height="20" fill="#f59e0b" />

                                {/* Labels */}
                                <text x="140" y="180" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">DORMITORIO PPAL</text>
                                <text x="140" y="420" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">ESTAR / COMEDOR</text>
                                <text x="440" y="180" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">COCINA INTEGRADA</text>
                                <text x="720" y="180" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">SUITE BALCÓN</text>
                                <text x="560" y="440" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="sans-serif">TERRAZA TÉCNICA</text>
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
                                        left: `${pin.x}%`,
                                        top: `${pin.y}%`,
                                        transform: 'translate(-50%, -100%)',
                                        cursor: 'pointer',
                                        zIndex: 10
                                    }}
                                >
                                    <div style={{
                                        background: pinColorMap[pin.type] || '#f59e0b',
                                        color: '#fff',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50% 50% 50% 0',
                                        transform: 'rotate(-45deg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 4px 12px ${pinColorMap[pin.type]}80`,
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
                                    <Badge color={pinColorMap[selectedPin.type]} variant="filled" size="xs">
                                        {selectedPin.type.toUpperCase()}
                                    </Badge>
                                    <button
                                        onClick={() => setSelectedPin(null)}
                                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
                                    {selectedPin.title}
                                </h3>

                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                                    <div>🏷️ Disciplina: <strong style={{ color: '#f8fafc' }}>{selectedPin.discipline}</strong></div>
                                    <div>👤 Reportó: <strong style={{ color: '#f8fafc' }}>{selectedPin.reporter}</strong></div>
                                    <div>📅 Fecha: <strong style={{ color: '#f8fafc' }}>{selectedPin.date}</strong></div>
                                    <div>📍 Coordenadas en Plano: <code style={{ color: '#f59e0b' }}>X:{selectedPin.x}% Y:{selectedPin.y}%</code></div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <Button
                                    variant="whatsapp"
                                    size="sm"
                                    icon="💬"
                                    onClick={() => window.open(`https://wa.me/5492613168608?text=Alerta%20Plano:%20${encodeURIComponent(selectedPin.title)}`)}
                                >
                                    Enviar a Cuadrilla por WhatsApp
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                        setPins(pins.filter(p => p.id !== selectedPin.id));
                                        setSelectedPin(null);
                                    }}
                                >
                                    Marcar como Resuelto
                                </Button>
                            </div>
                        </GlassCard>
                    )}

                </div>

            </main>

            {/* Create Pin Modal */}
            <Modal
                isOpen={newPinModal.show}
                onClose={() => setNewPinModal({ show: false, x: 0, y: 0 })}
                title="Nuevo Marcador sobre Plano"
                subtitle={`Ubicación seleccionada en ${discipline}: X:${newPinModal.x}% Y:${newPinModal.y}%`}
            >
                <form onSubmit={handleCreatePin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Título del Marcador / Tarea *</label>
                        <input
                            required
                            placeholder="Ej: Fuga en codo termofusión"
                            value={newPinTitle}
                            onChange={e => setNewPinTitle(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Severidad</label>
                        <select
                            value={newPinType}
                            onChange={e => setNewPinType(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
                        >
                            <option value="critical">🚨 Crítica / Vicio Oculto</option>
                            <option value="warning">⚠️ Alerta / Pendiente</option>
                            <option value="info">ℹ️ Informativo / Nota Técnica</option>
                            <option value="success">✅ Hito Completado</option>
                        </select>
                    </div>
                    <Button variant="primary" size="md" style={{ width: '100%', marginTop: '6px' }} icon="📍">
                        Colocar Marcador en Plano
                    </Button>
                </form>
            </Modal>

        </div>
    );
}
