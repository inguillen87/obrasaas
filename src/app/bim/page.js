'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function BimDigitalTwinPage() {
    const [activeDiscipline, setActiveDiscipline] = useState('all'); // all, estructura, mamposteria, instalaciones
    const [viewMode, setViewMode] = useState('progress'); // progress, heatmap, materials
    const [timelineDay, setTimelineDay] = useState(12); // Day 12 of 37
    const [selectedElement, setSelectedElement] = useState({
        id: 'slab-03',
        name: 'Losa Hormigón Armado Nivel 3',
        discipline: 'Estructura H°A°',
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

    const getElementColor = (floor) => {
        if (viewMode === 'heatmap') {
            if (floor.progress === 100) return 'bg-emerald-500/80 border-emerald-400';
            if (floor.progress >= 50) return 'bg-amber-500/80 border-amber-400';
            return 'bg-rose-500/80 border-rose-400';
        }
        if (viewMode === 'materials') {
            if (floor.discipline === 'estructura') return 'bg-slate-400/80 border-slate-300';
            if (floor.discipline === 'mamposteria') return 'bg-orange-600/80 border-orange-400';
            return 'bg-cyan-500/80 border-cyan-300';
        }
        // Default Progress Mode
        if (floor.progress === 100) return 'bg-emerald-600/85 border-emerald-400 shadow-emerald-500/30';
        if (floor.progress > 0) return 'bg-amber-500/85 border-amber-300 shadow-amber-500/30 animate-pulse';
        return 'bg-slate-800/60 border-slate-700 opacity-40';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
            {/* Top Navigation Bar */}
            <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-2">
                        ← Dashboard
                    </Link>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-lg">
                            🧊
                        </div>
                        <div>
                            <h1 className="text-sm font-black tracking-wide text-white uppercase">Visor 3D BIM & Gemelo Digital</h1>
                            <p className="text-xs text-slate-400 font-medium">Torre Palermo Soho • Modelo IFC v4.3</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Mode Switcher */}
                    <div className="bg-slate-800/80 p-1 rounded-lg border border-slate-700 flex text-xs font-bold">
                        <button 
                            onClick={() => setViewMode('progress')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'progress' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                            Avance Real %
                        </button>
                        <button 
                            onClick={() => setViewMode('heatmap')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'heatmap' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                            Mapa de Riesgo 🔥
                        </button>
                        <button 
                            onClick={() => setViewMode('materials')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'materials' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                            Por Disciplina
                        </button>
                    </div>

                    <Link href="/planos" className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200">
                        📐 Ver Planos 2D
                    </Link>
                </div>
            </header>

            {/* Main Content Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Discipline Filters & 4D Simulation Slider */}
                <div className="w-80 border-r border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between shrink-0">
                    <div className="space-y-6">
                        {/* 4D Timeline Slider */}
                        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs uppercase font-bold text-amber-400">Cronograma 4D BIM</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Día {timelineDay} / 37
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="37" 
                                value={timelineDay}
                                onChange={(e) => setTimelineDay(parseInt(e.target.value))}
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                                <span>Fundaciones</span>
                                <span>Estructura</span>
                                <span>Entrega</span>
                            </div>
                        </div>

                        {/* Discipline Filter */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Capas de Modelo (IFC Layers)</p>
                            <div className="space-y-2">
                                {[
                                    { id: 'all', label: 'Todas las Capas', icon: '🏛️', count: '10 Pisos' },
                                    { id: 'estructura', label: 'Estructura (Hormigón)', icon: '🧱', count: 'H-30 / ADN-420' },
                                    { id: 'mamposteria', label: 'Mampostería y Revoque', icon: '🏗️', count: 'Ladrillos Portantes' },
                                    { id: 'instalaciones', label: 'Sanitarias & Cloacas', icon: '🚰', count: 'PVC 110 CIRSOC' },
                                ].map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setActiveDiscipline(d.id)}
                                        className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer border ${
                                            activeDiscipline === d.id 
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                                                : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                        }`}>
                                        <span className="flex items-center gap-2">
                                            <span>{d.icon}</span>
                                            <span>{d.label}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal">{d.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3D Model Legend */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                            <p className="font-bold text-slate-300 uppercase text-[10px] tracking-wider mb-2">Convención de Colores</p>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                <span className="text-slate-300">100% Completado & Certificado</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                                <span className="text-slate-300">En Ejecución Activa (Hoy)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-slate-700"></span>
                                <span className="text-slate-400">Pendiente / Próximas Fases</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-400 text-center border-t border-slate-800 pt-3 font-semibold">
                        Arrastrá con el mouse para rotar el edificio en 3D 🔄
                    </div>
                </div>

                {/* Center: 3D Interactive WebGL / Isometric Canvas */}
                <div 
                    className="flex-1 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}>
                    
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25"></div>

                    {/* Camera Rotation Indicator */}
                    <div className="absolute top-4 left-4 bg-slate-900/80 border border-slate-800 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] font-mono text-slate-400">
                        X: {Math.round(rotation.x)}° • Y: {Math.round(rotation.y)}°
                    </div>

                    {/* Interactive 3D Building Isometric Stack */}
                    <div 
                        style={{
                            transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                            transformStyle: 'preserve-3d',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                        }}
                        className="relative w-72 flex flex-col items-center gap-2.5 py-12">
                        
                        {floors
                            .filter(f => activeDiscipline === 'all' || f.discipline === activeDiscipline)
                            .map((f) => (
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
                                    className={`w-64 h-11 border-2 rounded-lg flex items-center justify-between px-4 transition-all duration-300 cursor-pointer shadow-lg hover:scale-105 hover:border-amber-400 ${getElementColor(f)}`}>
                                    <span className="text-xs font-black text-white drop-shadow-md">
                                        NIVEL {f.level}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white drop-shadow-md">
                                            {f.progress}%
                                        </span>
                                    </div>
                                </div>
                            ))}

                        {/* Ground Grid Base Plate */}
                        <div className="w-80 h-80 bg-amber-500/10 border-2 border-dashed border-amber-500/30 rounded-2xl absolute -bottom-16 -z-10 -rotate-x-90 flex items-center justify-center">
                            <span className="text-amber-400/50 font-black text-xs tracking-widest uppercase">
                                Predio Obra: Honduras 4850
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: BIM Element Inspector & Properties */}
                <div className="w-96 border-l border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 flex flex-col justify-between shrink-0">
                    <div className="space-y-6">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {selectedElement.discipline}
                            </span>
                            <h2 className="text-xl font-black text-white mt-2 leading-snug">
                                {selectedElement.name}
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">ID Elemento: {selectedElement.id} • Torre Palermo</p>
                        </div>

                        {/* Progress Gauge */}
                        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-400">Avance de Ejecución</span>
                                <span className="text-lg font-black text-amber-400">{selectedElement.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${selectedElement.progress}%` }}>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-2">
                                <span>Estado: <strong className="text-emerald-400">{selectedElement.status}</strong></span>
                                <span>Riesgo: <strong className="text-amber-400">{selectedElement.riskLevel}</strong></span>
                            </div>
                        </div>

                        {/* Technical Properties Grid */}
                        <div className="space-y-3 text-xs">
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between">
                                <span className="text-slate-400">Cubicaje Hormigón:</span>
                                <span className="font-bold text-slate-200">{selectedElement.volume}</span>
                            </div>
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between">
                                <span className="text-slate-400">Cuantía de Armadura:</span>
                                <span className="font-bold text-slate-200">{selectedElement.reinforcement}</span>
                            </div>
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between">
                                <span className="text-slate-400">Cuadrilla Asignada:</span>
                                <span className="font-bold text-slate-200">{selectedElement.contractor}</span>
                            </div>
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between">
                                <span className="text-slate-400">Última Inspección:</span>
                                <span className="font-bold text-slate-200">{selectedElement.lastInspection}</span>
                            </div>
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between">
                                <span className="text-slate-400">Certificado por:</span>
                                <span className="font-bold text-amber-400">{selectedElement.inspector}</span>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Action Launcher */}
                    <div className="space-y-3 pt-6 border-t border-slate-800">
                        <a 
                            href={`https://wa.me/15551533706?text=${encodeURIComponent(`Consulta Técnica sobre ${selectedElement.name}: Estado actual ${selectedElement.progress}% de avance.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer">
                            💬 Consultar Elemento vía WhatsApp
                        </a>
                        <Link 
                            href="/dashboard"
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl flex items-center justify-center text-xs border border-slate-700">
                            Volver al Panel Principal
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
