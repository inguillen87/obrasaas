'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from '@/lib/design-system';

export default function BimDigitalTwinPage() {
    const [activeDiscipline, setActiveDiscipline] = useState('all'); // all, estructura, mamposteria, instalaciones
    const [viewMode, setViewMode] = useState('progress'); // progress, heatmap, materials
    const [timelineDay, setTimelineDay] = useState(12); // Day 12 of 37
    const [selectedElement, setSelectedElement] = useState({
        id: 'slab-03',
        name: 'Losa Hormigón Armado Nivel 3',
        discipline: 'ESTRUCTURA H°A°',
        volume: '42.5 m³ Hormigón H-30',
        reinforcement: '2.850 kg Hierro ADN-420',
        contractor: 'Juan Gómez (Albañilería Principal)',
        progress: 85,
        status: 'En Curado (CIRSOC 201)',
        riskLevel: 'Bajo',
        lastInspection: 'Hoy, 04:16 p. m.',
        inspector: 'Arq. Marcelo'
    });

    const [rotation, setRotation] = useState({ x: 25, y: -35 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setRotation(prev => ({
            x: Math.max(-60, Math.min(60, prev.x - dy * 0.4)),
            y: prev.y + dx * 0.4
        }));
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsDragging(false);

    // 10 Building Floors / Levels
    const floors = [
        { level: 10, name: 'Azotea & Sala de Máquinas', phase: 5, progress: 0, discipline: 'estructura' },
        { level: 9, name: 'Piso 9 — Semipiso A/B', phase: 5, progress: 10, discipline: 'mamposteria' },
        { level: 8, name: 'Piso 8 — Semipiso A/B', phase: 4, progress: 30, discipline: 'instalaciones' },
        { level: 7, name: 'Piso 7 — Departamentos 2 Amb.', phase: 4, progress: 45, discipline: 'instalaciones' },
        { level: 6, name: 'Piso 6 — Departamentos 2 Amb.', phase: 3, progress: 60, discipline: 'mamposteria' },
        { level: 5, name: 'Piso 5 — Departamentos 2 Amb.', phase: 3, progress: 75, discipline: 'mamposteria' },
        { level: 4, name: 'Piso 4 — Planta Tipo', phase: 2, progress: 80, discipline: 'estructura' },
        { level: 3, name: 'Piso 3 — Losa Hormigón Armado', phase: 2, progress: 85, discipline: 'estructura', active: true },
        { level: 2, name: 'Piso 2 — Estructura Terminada', phase: 1, progress: 100, discipline: 'estructura' },
        { level: 1, name: 'Piso 1 — Hall de Acceso', phase: 1, progress: 100, discipline: 'estructura' },
        { level: 0, name: 'Subsuelo & Fundaciones (Pilotes)', phase: 0, progress: 100, discipline: 'estructura' }
    ];

    const getFloorStyle = (floor) => {
        let bg = 'rgba(30, 41, 59, 0.7)';
        let border = 'rgba(255, 255, 255, 0.15)';
        let shadow = 'none';

        if (viewMode === 'heatmap') {
            if (floor.progress === 100) {
                bg = 'rgba(16, 185, 129, 0.85)';
                border = '#34d399';
            } else if (floor.progress >= 50) {
                bg = 'rgba(245, 158, 11, 0.85)';
                border = '#fbbf24';
            } else {
                bg = 'rgba(239, 68, 68, 0.85)';
                border = '#f87171';
            }
        } else if (viewMode === 'materials') {
            if (floor.discipline === 'estructura') {
                bg = 'rgba(148, 163, 184, 0.85)';
                border = '#cbd5e1';
            } else if (floor.discipline === 'mamposteria') {
                bg = 'rgba(234, 88, 12, 0.85)';
                border = '#fb923c';
            } else {
                bg = 'rgba(6, 182, 212, 0.85)';
                border = '#22d3ee';
            }
        } else {
            // Progress Mode
            if (floor.progress === 100) {
                bg = 'rgba(16, 185, 129, 0.85)';
                border = '#34d399';
                shadow = '0 0 16px rgba(16, 185, 129, 0.4)';
            } else if (floor.progress > 0) {
                bg = 'rgba(245, 158, 11, 0.85)';
                border = '#fcd34d';
                shadow = '0 0 16px rgba(245, 158, 11, 0.4)';
            } else {
                bg = 'rgba(15, 23, 42, 0.6)';
                border = 'rgba(255, 255, 255, 0.08)';
            }
        }

        return {
            background: bg,
            borderColor: border,
            boxShadow: shadow
        };
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#060913',
            color: '#f8fafc',
            fontFamily: tokens.font.sans,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Top Navigation Bar */}
            <header style={{
                height: '64px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ← Dashboard
                    </Link>
                    <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem'
                        }}>
                            🧊
                        </div>
                        <div>
                            <h1 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: '#fff', fontFamily: tokens.font.heading }}>
                                Visor 3D BIM & Gemelo Digital
                            </h1>
                            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                                Torre Palermo Soho • Modelo IFC v4.3 Federado
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* View Mode Switcher */}
                    <div style={{
                        background: 'rgba(6, 9, 19, 0.7)',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                    }}>
                        <button
                            onClick={() => setViewMode('progress')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: viewMode === 'progress' ? '#f59e0b' : 'transparent',
                                color: viewMode === 'progress' ? '#060913' : '#94a3b8',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Avance Real %
                        </button>
                        <button
                            onClick={() => setViewMode('heatmap')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: viewMode === 'heatmap' ? '#ef4444' : 'transparent',
                                color: viewMode === 'heatmap' ? '#fff' : '#94a3b8',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Mapa de Riesgo 🔥
                        </button>
                        <button
                            onClick={() => setViewMode('materials')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: viewMode === 'materials' ? '#06b6d4' : 'transparent',
                                color: viewMode === 'materials' ? '#060913' : '#94a3b8',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Por Disciplina
                        </button>
                    </div>

                    <Link href="/planos" style={{ textDecoration: 'none' }}>
                        <button style={{
                            padding: '8px 14px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '10px',
                            color: '#f8fafc',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            📐 Ver Planos 2D
                        </button>
                    </Link>
                </div>
            </header>

            {/* Main Content Workspace */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left Sidebar: Discipline Filters & 4D Simulation Slider */}
                <div style={{
                    width: '320px',
                    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(11, 17, 32, 0.7)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* 4D Timeline Slider */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '14px',
                            padding: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Cronograma 4D BIM
                                </span>
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 900,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.4)'
                                }}>
                                    Día {timelineDay} / 37
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="37"
                                value={timelineDay}
                                onChange={(e) => setTimelineDay(parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                                <span>Fundaciones</span>
                                <span>Estructura</span>
                                <span>Entrega</span>
                            </div>
                        </div>

                        {/* Discipline Filter */}
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                                Capas de Modelo (IFC Layers)
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { id: 'all', label: 'Todas las Capas', icon: '🏛️', count: '10 Pisos' },
                                    { id: 'estructura', label: 'Estructura (Hormigón)', icon: '🧱', count: 'H-30 / ADN-420' },
                                    { id: 'mamposteria', label: 'Mampostería y Revoque', icon: '🏗️', count: 'Ladrillos Portantes' },
                                    { id: 'instalaciones', label: 'Sanitarias & Cloacas', icon: '🚰', count: 'PVC 110 CIRSOC' },
                                ].map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setActiveDiscipline(d.id)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            border: activeDiscipline === d.id ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                            background: activeDiscipline === d.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                            color: activeDiscipline === d.id ? '#fbbf24' : '#cbd5e1',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{d.icon}</span>
                                            <span>{d.label}</span>
                                        </span>
                                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>{d.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3D Model Legend */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '14px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <p style={{ fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.5px', margin: 0 }}>
                                Convención de Colores
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                <span style={{ color: '#cbd5e1' }}>100% Completado & Certificado</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                <span style={{ color: '#cbd5e1' }}>En Ejecución Activa (Hoy)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#334155', display: 'inline-block' }} />
                                <span style={{ color: '#64748b' }}>Pendiente / Próximas Fases</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', fontWeight: 600 }}>
                        Arrastrá con el mouse para rotar el edificio en 3D 🔄
                    </div>
                </div>

                {/* Center: 3D Interactive Isometric Stack */}
                <div
                    style={{
                        flex: 1,
                        position: 'relative',
                        background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.9) 0%, #060913 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        overflow: 'hidden',
                        userSelect: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {/* Camera Rotation Indicator */}
                    <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(12px)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontFamily: 'monospace',
                        color: '#94a3b8'
                    }}>
                        X: {Math.round(rotation.x)}° • Y: {Math.round(rotation.y)}°
                    </div>

                    {/* Interactive 3D Building Isometric Stack */}
                    <div
                        style={{
                            transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                            transformStyle: 'preserve-3d',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            position: 'relative',
                            width: '280px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '40px 0'
                        }}
                    >
                        {floors
                            .filter(f => activeDiscipline === 'all' || f.discipline === activeDiscipline)
                            .map((f) => {
                                const st = getFloorStyle(f);
                                return (
                                    <div
                                        key={f.level}
                                        onClick={() => setSelectedElement({
                                            id: `slab-${f.level}`,
                                            name: `${f.name} (Nivel ${f.level})`,
                                            discipline: f.discipline.toUpperCase(),
                                            volume: `${(35 + f.level * 2.5).toFixed(1)} m³ Hormigón H-30`,
                                            reinforcement: `${(2400 + f.level * 150).toLocaleString('es-AR')} kg Hierro`,
                                            contractor: f.level > 5 ? 'Carlos Pérez (Pintura/Interiores)' : 'Juan Gómez (Albañilería)',
                                            progress: f.progress,
                                            status: f.progress === 100 ? 'Finalizado & Certificado' : f.progress > 0 ? 'En Ejecución Activa' : 'Sin Iniciar',
                                            riskLevel: f.progress < 50 && f.progress > 0 ? 'Medio' : 'Bajo',
                                            lastInspection: 'Hoy, 04:16 p. m.',
                                            inspector: 'Arq. Marcelo'
                                        })}
                                        style={{
                                            width: '240px',
                                            height: '40px',
                                            border: `2px solid ${st.borderColor}`,
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0 16px',
                                            cursor: 'pointer',
                                            background: st.background,
                                            boxShadow: st.boxShadow,
                                            transition: 'all 0.2s',
                                            transform: selectedElement.id === `slab-${f.level}` ? 'scale(1.06)' : 'scale(1)'
                                        }}
                                    >
                                        <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fff' }}>
                                            NIVEL {f.level}
                                        </span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff' }}>
                                            {f.progress}%
                                        </span>
                                    </div>
                                );
                            })}

                        {/* Ground Grid Base Plate */}
                        <div style={{
                            width: '320px',
                            height: '320px',
                            background: 'rgba(245, 158, 11, 0.05)',
                            border: '2px dashed rgba(245, 158, 11, 0.25)',
                            borderRadius: '24px',
                            position: 'absolute',
                            bottom: '-60px',
                            zIndex: -1,
                            transform: 'rotateX(90deg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span style={{ color: 'rgba(245, 158, 11, 0.4)', fontWeight: 900, fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                Predio Obra: Honduras 4850
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: BIM Element Inspector & Properties */}
                <div style={{
                    width: '360px',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(16px)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: 'rgba(99, 102, 241, 0.2)',
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.4)'
                            }}>
                                {selectedElement.discipline}
                            </span>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', margin: '8px 0 2px', fontFamily: tokens.font.heading }}>
                                {selectedElement.name}
                            </h2>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                                ID Elemento: {selectedElement.id} • Torre Palermo
                            </p>
                        </div>

                        {/* Progress Gauge */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            padding: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Avance de Ejecución</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b' }}>{selectedElement.progress}%</span>
                            </div>
                            <div style={{ width: '100%', background: '#1e293b', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                                <div
                                    style={{
                                        background: '#f59e0b',
                                        height: '100%',
                                        borderRadius: '9999px',
                                        width: `${selectedElement.progress}%`,
                                        transition: 'all 0.5s'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, marginTop: '8px' }}>
                                <span>Estado: <strong style={{ color: '#10b981' }}>{selectedElement.status}</strong></span>
                                <span>Riesgo: <strong style={{ color: '#fbbf24' }}>{selectedElement.riskLevel}</strong></span>
                            </div>
                        </div>

                        {/* Technical Properties Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                            <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Cubicaje Hormigón:</span>
                                <strong style={{ color: '#f8fafc' }}>{selectedElement.volume}</strong>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Cuantía de Armadura:</span>
                                <strong style={{ color: '#f8fafc' }}>{selectedElement.reinforcement}</strong>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Cuadrilla Asignada:</span>
                                <strong style={{ color: '#f8fafc' }}>{selectedElement.contractor}</strong>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Última Inspección:</span>
                                <strong style={{ color: '#f8fafc' }}>{selectedElement.lastInspection}</strong>
                            </div>
                            <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Certificado por:</span>
                                <strong style={{ color: '#f59e0b' }}>{selectedElement.inspector}</strong>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Action Launcher */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <a
                            href={`https://wa.me/15551533706?text=${encodeURIComponent(`Consulta Técnica sobre ${selectedElement.name}: Estado actual ${selectedElement.progress}% de avance.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#10b981',
                                color: '#fff',
                                fontWeight: 800,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '0.8rem',
                                textDecoration: 'none',
                                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            💬 Consultar Elemento vía WhatsApp
                        </a>
                        <Link
                            href="/dashboard"
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#cbd5e1',
                                fontWeight: 700,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.78rem',
                                textDecoration: 'none',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxSizing: 'border-box'
                            }}
                        >
                            Volver al Panel Principal
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
