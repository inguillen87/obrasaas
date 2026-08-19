'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';

export default function PosterPage() {
    const [project, setProject] = useState({
        name: 'Torre Palermo Soho',
        address: 'Honduras 4850, Palermo, CABA',
        director: 'Arq. Marcelo',
        capataz: 'Luis Martínez',
        geofenceRadiusMeters: 100,
        phone: '+1 (555) 153-3706'
    });

    useEffect(() => {
        fetch('/api/state')
            .then(res => res.json())
            .then(data => {
                if (data.projectConfig) {
                    setProject(prev => ({
                        ...prev,
                        name: data.projectConfig.name || prev.name,
                        address: data.projectConfig.address || prev.address,
                        director: data.projectConfig.director?.name || prev.director,
                        capataz: data.projectConfig.capataz?.name || prev.capataz,
                        geofenceRadiusMeters: data.projectConfig.geofenceRadiusMeters || prev.geofenceRadiusMeters
                    }));
                }
            })
            .catch(() => {});
    }, []);

    const whatsappUrl = `https://wa.me/15551533706?text=${encodeURIComponent('Hola, estoy en la obra ' + project.name + ' para registrar mi ingreso.')}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(whatsappUrl)}&margin=15`;

    return (
        <div style={{
            minHeight: '100vh',
            background: '#060913',
            color: '#f8fafc',
            fontFamily: tokens.font.sans,
            padding: '32px 16px'
        }}>
            <style jsx global>{`
                @media print {
                    body {
                        background: #fff !important;
                        color: #000 !important;
                        padding: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .poster-container {
                        box-shadow: none !important;
                        border: 3px solid #000 !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                    }
                }
            `}</style>

            {/* Action Bar (Hidden on Print) */}
            <div className="no-print" style={{ maxWidth: '850px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Link href="/dashboard" style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    ← Volver al Dashboard
                </Link>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#060913',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)'
                    }}
                >
                    🖨️ Imprimir Cartel de Entrada (A4 / Plotter)
                </button>
            </div>

            {/* Printable Official Jobsite Poster */}
            <div className="poster-container" style={{
                maxWidth: '850px',
                margin: '0 auto',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '20px',
                padding: '40px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                border: '4px solid #f59e0b',
                boxSizing: 'border-box'
            }}>
                {/* Header Banner */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #0f172a', paddingBottom: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#f59e0b',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>
                            🏗️
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, textTransform: 'uppercase', fontFamily: tokens.font.heading, color: '#0f172a' }}>
                                Cartel Oficial de Acceso a Obra
                            </h1>
                            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Sistema de Control de Acceso Digital • Res. SRT 319/99 & Ley 22.250
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '4px 10px', background: '#0f172a', color: '#fff', fontSize: '0.72rem', fontWeight: 900, borderRadius: '6px', letterSpacing: '0.5px' }}>
                            OBRA AUDITADA
                        </span>
                    </div>
                </div>

                {/* Project Details Box */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
                    <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Proyecto / Obra:</span>
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{project.name}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{project.address}</span>
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Dirección Técnica:</span>
                        <strong style={{ color: '#0f172a' }}>{project.director}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Capataz: {project.capataz}</span>
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Geocerca Satelital:</span>
                        <strong style={{ color: '#10b981' }}>Radio {project.geofenceRadiusMeters}m Verificado</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>GPS Anti-Fraude Activo</span>
                    </div>
                </div>

                {/* Main QR Code & Instructions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'center', marginBottom: '28px' }}>
                    <div style={{ textAlign: 'center', padding: '16px', background: '#fff', border: '2px dashed #f59e0b', borderRadius: '16px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={qrCodeUrl}
                            alt="Código QR de Acceso a Obra"
                            style={{ width: '100%', maxWidth: '220px', height: 'auto', display: 'block', margin: '0 auto' }}
                        />
                        <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Escanear con Cámara o WhatsApp
                        </span>
                    </div>

                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px', fontFamily: tokens.font.heading }}>
                            Instrucciones para Ingresar a Obra:
                        </h2>
                        <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '0.88rem', lineHeight: 1.7, color: '#334155' }}>
                            <li><strong>Escaneá el código QR</strong> con la cámara de tu celular.</li>
                            <li>Se abrirá el <strong>Bot Oficial de WhatsApp</strong> de ObraSaaS.</li>
                            <li>Enviá tu <strong>Ubicación en Tiempo Real</strong> para validar presentismo.</li>
                            <li>Si es tu primer día, el bot te solicitará foto de <strong>DNI y Póliza ART</strong>.</li>
                        </ol>

                        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef3c7', borderLeft: '4px solid #f59e0b', borderRadius: '6px', fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                            ⚠️ <strong>Ingreso Obligatorio:</strong> Todo el personal debe registrarse antes de ingresar a zona de obra. Prohibido el ingreso sin seguro ART vigente.
                        </div>
                    </div>
                </div>

                {/* Footer Security Badges */}
                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                    <span>🔒 Cifrado & Sellado Digital SHA-256</span>
                    <span>⚖️ Ley 22.250 • CCT 76/75 UOCRA</span>
                    <span>🌐 powered by ObraSaaS Enterprise</span>
                </div>
            </div>
        </div>
    );
}
