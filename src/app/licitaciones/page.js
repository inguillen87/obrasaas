"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, PageHeader } from '@/lib/design-system';

export default function LicitacionesPage() {
    const [filterCategory, setFilterCategory] = useState('todas');
    const [search, setSearch] = useState('');

    const licitaciones = [
        {
            id: 'lic-01',
            organismo: 'Ministerio de Obras Públicas (Nación)',
            title: 'Construcción Centro de Salud & Módulos Sanitarios',
            ubicacion: 'La Matanza, Buenos Aires',
            presupuestoOficial: 340000000,
            apertura: '28 Ago 2026',
            categoria: 'Edificación',
            matchScore: 96,
            pliegoGratis: true,
            status: 'VIGENTE'
        },
        {
            id: 'lic-02',
            organismo: 'Gobierno de la Ciudad de Buenos Aires (GCBA)',
            title: 'Puesta en Valor & Refuncionalización Espacio Verde',
            ubicacion: 'Palermo, CABA',
            presupuestoOficial: 185000000,
            apertura: '04 Sep 2026',
            categoria: 'Arquitectura',
            matchScore: 89,
            pliegoGratis: true,
            status: 'VIGENTE'
        },
        {
            id: 'lic-03',
            organismo: 'Dirección Provincial de Vialidad (Mendoza)',
            title: 'Pavimentación Urbana y Desagües Pluviales Colectora',
            ubicacion: 'Guaymallén, Mendoza',
            presupuestoOficial: 620000000,
            apertura: '12 Sep 2026',
            categoria: 'Vial',
            matchScore: 78,
            pliegoGratis: false,
            status: 'VIGENTE'
        },
        {
            id: 'lic-04',
            organismo: 'Dirección General de Escuelas (Córdoba)',
            title: 'Ampliación 4 Aulas y Salón de Usos Múltiples',
            ubicacion: 'Villa Carlos Paz, Córdoba',
            presupuestoOficial: 120000000,
            apertura: '18 Sep 2026',
            categoria: 'Edificación',
            matchScore: 92,
            pliegoGratis: true,
            status: 'VIGENTE'
        }
    ];

    const categories = ['todas', 'Edificación', 'Arquitectura', 'Vial'];

    const filtered = licitaciones.filter(l => 
        (filterCategory === 'todas' || l.categoria === filterCategory) &&
        (!search || l.title.toLowerCase().includes(search.toLowerCase()) || l.organismo.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                icon="🏛️"
                title="Licitómetro — Oportunidades de Obra Pública & Gobiernos"
                subtitle="Monitoreo automatizado de ComprarGob, Contrat.ar y Boletines Oficiales con matching técnico IA"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Licitómetro' }]}
                actions={
                    <Link href="/dashboard">
                        <Button variant="secondary" size="sm">← Volver al Dashboard</Button>
                    </Link>
                }
            />

            <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '32px 24px 80px' }}>
                
                {/* Top Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    <StatCard label="LICITACIONES ACTIVAS" value={licitaciones.length} sub="Monitoreo diario" icon="📋" color="#3b82f6" />
                    <StatCard label="VOLUMEN TOTAL EN JUEGO" value="$1.265 M" sub="Presupuestos oficiales" icon="💰" color="#10b981" />
                    <StatCard label="MATCHING DE CAPACIDAD" value="96%" sub="Aptitud técnica empresa" icon="🎯" color="#f59e0b" />
                    <StatCard label="PLIEGOS DESCARGABLES" value="100%" sub="Formatos oficiales" icon="📄" color="#8b5cf6" />
                </div>

                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="🔍 Buscar por organismo, licitación o provincia..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            flex: 1,
                            minWidth: '280px',
                            padding: '12px 18px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '12px',
                            color: '#f8fafc',
                            fontSize: '0.9rem',
                            outline: 'none'
                        }}
                    />

                    <div style={{ display: 'flex', gap: '6px' }}>
                        {categories.map(c => (
                            <button
                                key={c}
                                onClick={() => setFilterCategory(c)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: filterCategory === c ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: filterCategory === c ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                    color: filterCategory === c ? '#fbbf24' : '#94a3b8',
                                    fontSize: '0.8rem',
                                    fontWeight: filterCategory === c ? 700 : 500,
                                    cursor: 'pointer'
                                }}
                            >
                                {c === 'todas' ? 'Todas' : c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bids List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filtered.map(l => (
                        <GlassCard key={l.id} style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ flex: 1, minWidth: '280px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <Badge color="#3b82f6" variant="filled" size="xs">{l.organismo}</Badge>
                                    <Badge color="#f59e0b" variant="subtle" size="xs">{l.categoria}</Badge>
                                    <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>● {l.status}</span>
                                </div>

                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                                    {l.title}
                                </h3>

                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <span>📍 {l.ubicacion}</span>
                                    <span>📅 Apertura: <strong style={{ color: '#f8fafc' }}>{l.apertura}</strong></span>
                                    <span>🎯 Match Técnico: <strong style={{ color: '#10b981' }}>{l.matchScore}%</strong></span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PRESUPUESTO OFICIAL</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
                                        ${(l.presupuestoOficial / 1000000).toFixed(0)}M ARS
                                    </div>
                                </div>

                                <Button
                                    variant="primary"
                                    size="sm"
                                    icon="📄"
                                    onClick={() => alert(`Descargando Pliego Oficial y Anexos Técnicos para ${l.title}`)}
                                >
                                    Descargar Pliego
                                </Button>
                            </div>
                        </GlassCard>
                    ))}
                </div>

            </main>
        </div>
    );
}
