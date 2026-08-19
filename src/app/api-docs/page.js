"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, PageHeader } from '@/lib/design-system';

export default function ApiDocsPage() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [expandedEndpoint, setExpandedEndpoint] = useState(null);

    const categories = [
        { id: 'all', label: 'Todos' },
        { id: 'core', label: 'Operarios & Obras' },
        { id: 'financial', label: 'Costos & Certificaciones' },
        { id: 'compliance', label: 'Libro de Obra & UOCRA' },
        { id: 'webhooks', label: 'Webhooks & Eventos' }
    ];

    const endpoints = [
        {
            category: 'core',
            method: 'GET',
            path: '/api/v1/workers',
            title: 'Listar Nómina de Operarios',
            desc: 'Obtiene todos los operarios registrados con su estado de KYC biométrico y póliza de ART.',
            params: [{ name: 'status', type: 'string', desc: 'Filtro por estado: Activo, Bloqueado, etc.' }],
            response: `{
  "workers": [
    {
      "id": "w-01",
      "name": "Juan Gómez",
      "trade": "Albañilería",
      "dni": "35892114",
      "kycStatus": "VERIFICADO",
      "artStatus": "VIGENTE",
      "assignedTasks": ["Revoque Grueso"]
    }
  ],
  "total": 1
}`
        },
        {
            category: 'core',
            method: 'GET',
            path: '/api/v1/projects',
            title: 'Listar Proyectos y Geocercas',
            desc: 'Devuelve las obras configuradas con sus coordenadas GPS y radio de presentismo satelital.',
            params: [],
            response: `{
  "projects": [
    {
      "id": "obra-palermo-01",
      "name": "Torre Palermo Soho",
      "city": "CABA",
      "coordinates": { "lat": -34.5889, "lng": -58.4288 },
      "geofenceRadiusMeters": 50
    }
  ],
  "activeProject": "obra-palermo-01"
}`
        },
        {
            category: 'core',
            method: 'GET',
            path: '/api/v1/tasks',
            title: 'Tareas del Cronograma Gantt',
            desc: 'Retorna el listado completo de hitos y tareas con porcentaje de avance y quincena asignada.',
            params: [{ name: 'quincena', type: 'string', desc: 'Filtro: Q1, Q2' }],
            response: `{
  "tasks": [
    { "id": "1", "name": "Revoque Grueso", "progress": 100, "quincena": "Q1", "status": "COMPLETADA" },
    { "id": "2", "name": "Instalación Eléctrica", "progress": 45, "quincena": "Q1", "status": "EN_PROCESO" }
  ],
  "overallProgress": 55
}`
        },
        {
            category: 'financial',
            method: 'GET',
            path: '/api/v1/budget',
            title: 'Presupuesto por Rubro & Curva S',
            desc: 'Devuelve el desglose presupuestario por rubro, dinero ejecutado y cálculo de desvío contra avance físico.',
            params: [],
            response: `{
  "projectName": "Torre Palermo Soho",
  "totalPresupuesto": 4995000,
  "totalEjecutado": 1950000,
  "desvioGlobal": 39.0,
  "avanceFisico": 55.0,
  "curvaS": { "avanceFinanciero": 39.0, "avanceFisico": 55.0, "desvio": -16.0 }
}`
        },
        {
            category: 'financial',
            method: 'POST',
            path: '/api/v1/budget',
            title: 'Registrar Gasto o Remito en Rubro',
            desc: 'Imputa un nuevo gasto o remito fiscal con CAE a un rubro constructivo.',
            params: [{ name: 'rubroId', type: 'string', desc: 'ID del rubro' }, { name: 'monto', type: 'number', desc: 'Importe en ARS' }, { name: 'concepto', type: 'string', desc: 'Detalle del insumo' }],
            response: `{
  "success": true,
  "movimiento": { "id": "mov-99", "rubroId": "r-01", "monto": 18500, "concepto": "Cemento x50 bolsas" },
  "nuevoSaldoEjecutado": 1968500
}`
        },
        {
            category: 'financial',
            method: 'GET',
            path: '/api/v1/export',
            title: 'Exportador Multi-ERP (CSV / Excel UTF-8)',
            desc: 'Exporta libros contables, partes de obra, gastos con CAE y métricas de avance compatibles con Tango, Bejerman y SAP.',
            params: [{ name: 'type', type: 'string', desc: 'Dataset a exportar: expenses | gantt | workers | libro | budget' }, { name: 'format', type: 'string', desc: 'Formato: csv | tsv' }],
            response: `ID,Fecha,Rubro,Concepto,Proveedor,Monto_ARS,Monto_USD,CAE_AFIP\n"exp-01","2026-08-18","Estructura","Hierro Nervado 12mm","Acindar",450000.00,375.00,"27182818284590"`
        },
        {
            category: 'compliance',
            method: 'GET',
            path: '/api/admin/libro-obra',
            title: 'Libro de Obra Digital (Ley 22.250)',
            desc: 'Retorna los partes diarios firmados digitalmente con hash SHA-256 inmutable.',
            params: [{ name: 'limit', type: 'number', desc: 'Cantidad de entradas' }],
            response: `{
  "entries": [
    {
      "date": "2026-08-18",
      "workersPresent": 8,
      "weather": "Soleado 21°C",
      "tasksPerformed": "Hormigonado de losa y revoque fino",
      "signedBy": "Arq. Marcelo",
      "hash": "8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5b"
    }
  ]
}`
        },
        {
            category: 'compliance',
            method: 'GET',
            path: '/api/v1/uocra',
            title: 'Cálculo Salarial y CCT UOCRA',
            desc: 'Calcula jornales diarios, presentismo y cargas sociales según categorías del CCT 76/75.',
            params: [],
            response: `{
  "cct": "CCT 76/75 UOCRA",
  "totals": {
    "jornalDiario": 48500,
    "quincenal": 582000,
    "cargasSociales": 523800,
    "costoTotalMensual": 1687800
  }
}`
        },
        {
            category: 'webhooks',
            method: 'POST',
            path: '/api/v1/webhooks',
            title: 'Suscribir Webhook a Eventos',
            desc: 'Registra un endpoint receptor para recibir alertas en tiempo real (task.completed, incident.created, worker.registered).',
            params: [{ name: 'url', type: 'string', desc: 'URL HTTPS del receptor' }, { name: 'events', type: 'array', desc: 'Lista de eventos' }],
            response: `{
  "webhook": {
    "id": "wh-01",
    "url": "https://erp.tuempresa.com/webhook",
    "secret": "whsec_994a8f...",
    "events": ["task.completed", "incident.created"]
  }
}`
        }
    ];

    const filteredEndpoints = endpoints.filter(e => selectedCategory === 'all' || e.category === selectedCategory);

    const copyCode = (code, index) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans }}>
            
            {/* Header */}
            <PageHeader
                icon="📋"
                title="Documentación de la API REST v1"
                subtitle="Integración programática para ERPs, sistemas contables (Tango, Bejerman) y aplicaciones móviles"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'API Docs' }]}
                actions={
                    <Link href="/onboarding">
                        <Button variant="primary" size="sm" icon="🔑">
                            Obtener API Key
                        </Button>
                    </Link>
                }
            />

            <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '36px 24px 80px' }}>
                
                {/* Auth & Base URL Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '36px' }}>
                    
                    {/* Base URL */}
                    <GlassCard style={{ padding: '24px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                            🌐 Base URL de Producción
                        </div>
                        <div style={{ background: '#060913', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: tokens.font.mono, color: '#10b981', fontSize: '0.92rem' }}>
                            https://obrasaas.vercel.app
                        </div>
                    </GlassCard>

                    {/* Authentication */}
                    <GlassCard style={{ padding: '24px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                            🔐 Autenticación vía Header
                        </div>
                        <div style={{ background: '#060913', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: tokens.font.mono, color: '#f59e0b', fontSize: '0.92rem' }}>
                            x-api-key: tu_api_key_secreta
                        </div>
                    </GlassCard>
                </div>

                {/* Category Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {categories.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedCategory(c.id)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                border: selectedCategory === c.id ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                                background: selectedCategory === c.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                                color: selectedCategory === c.id ? '#fbbf24' : '#94a3b8',
                                fontSize: '0.82rem',
                                fontWeight: selectedCategory === c.id ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>

                {/* Endpoints List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredEndpoints.map((ep, idx) => {
                        const isExpanded = expandedEndpoint === idx;
                        const methodColor = ep.method === 'GET' ? '#10b981' : ep.method === 'POST' ? '#3b82f6' : '#ef4444';

                        return (
                            <GlassCard key={idx} style={{ padding: '24px' }}>
                                
                                {/* Top Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: `${methodColor}20`,
                                            border: `1px solid ${methodColor}40`,
                                            color: methodColor,
                                            fontWeight: 800,
                                            fontFamily: tokens.font.mono,
                                            fontSize: '0.78rem'
                                        }}>
                                            {ep.method}
                                        </span>
                                        <code style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', fontFamily: tokens.font.mono }}>
                                            {ep.path}
                                        </code>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setExpandedEndpoint(isExpanded ? null : idx)}
                                    >
                                        {isExpanded ? 'Ocultar Schema ▲' : 'Ver Schema ▼'}
                                    </Button>
                                </div>

                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                                    {ep.title}
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 14px', lineHeight: 1.5 }}>
                                    {ep.desc}
                                </p>

                                {/* Code Example Snippet */}
                                <div style={{ background: '#04070e', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.72rem', color: '#64748b', fontFamily: tokens.font.mono }}>
                                        <span>cURL Request:</span>
                                        <button
                                            onClick={() => copyCode(`curl -H "x-api-key: tu_api_key" https://obrasaas.vercel.app${ep.path}`, idx)}
                                            style={{ background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                        >
                                            {copiedIndex === idx ? '✓ ¡Copiado!' : 'Copiar cURL'}
                                        </button>
                                    </div>
                                    <pre style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', fontFamily: tokens.font.mono, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                        curl -H &quot;x-api-key: tu_api_key&quot; https://obrasaas.vercel.app{ep.path}
                                    </pre>
                                </div>

                                {/* Expanded JSON Schema Response */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            style={{ overflow: 'hidden', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}
                                        >
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                                                Respuesta JSON (200 OK):
                                            </div>
                                            <pre style={{
                                                background: '#04070e',
                                                padding: '16px',
                                                borderRadius: '10px',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                fontFamily: tokens.font.mono,
                                                fontSize: '0.78rem',
                                                color: '#38bdf8',
                                                margin: 0,
                                                overflowX: 'auto'
                                            }}>
                                                {ep.response}
                                            </pre>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </GlassCard>
                        );
                    })}
                </div>

                {/* Rate Limit Summary */}
                <div style={{ marginTop: '48px' }}>
                    <GlassCard style={{ padding: '28px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px', color: '#f8fafc' }}>
                            ⚡ Cuotas y Rate Limits por Plan
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ padding: '10px', textAlign: 'left', color: '#94a3b8' }}>Plan</th>
                                        <th style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>Requests / min</th>
                                        <th style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>Requests / día</th>
                                        <th style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>Webhooks en Vivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 10px', fontWeight: 700, color: '#10b981' }}>🟢 Starter</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>60</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>10,000</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>1</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 10px', fontWeight: 700, color: '#3b82f6' }}>🔵 Professional</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>180</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>100,000</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>10</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '12px 10px', fontWeight: 700, color: '#8b5cf6' }}>🟣 Enterprise</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>600</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>Ilimitado</td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>Ilimitado</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                </div>

            </main>
        </div>
    );
}
