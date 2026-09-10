'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';

export default function PosterPage() {
    const [mode, setMode] = useState('acceso'); // 'acceso' | 'municipal'
    const [project, setProject] = useState({
        name: 'Torre Palermo Soho',
        address: 'Honduras 4850, Palermo, CABA',
        director: 'Arq. Marcelo Guillén',
        directorMat: 'CPAU Mat. N° 28.491',
        socia: 'Arq. María Victoria Schiaffino',
        sociaMat: 'CPAU / CAPBA Mat. N° 31.204',
        repTecnico: 'Ing. Civil Fernando Morales (CPIC 19.832)',
        capataz: 'Luis Martínez',
        higieneSeguridad: 'Lic. Roberto Canessa (COPIME 14.882)',
        expediente: 'EX-2026-148293-GCABA-DGROC',
        permisoObra: 'Resolución N° 412/DGROC/2025',
        destino: 'Vivienda Multifamiliar • 12 Pisos y Amenities',
        superficie: '2.840 m²',
        empresa: 'Cimientos Digitales S.A. • CUIT 30-71829384-9',
        artCompany: 'La Segunda ART • Póliza N° 8492048',
        geofenceRadiusMeters: 100,
        phone: '+54 9 261 316-8608'
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

    const whatsappUrl = 'https://wa.me/5492613168608?text=' + encodeURIComponent('Hola, estoy en la obra ' + project.name + ' para registrar mi ingreso.');
    const qrCodeWorkerUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(whatsappUrl) + '&margin=12';
    const portalUrl = typeof window !== 'undefined' ? window.location.origin + '/portal' : 'https://obrasaas.com/portal';
    const qrCodePortalUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(portalUrl) + '&margin=12';

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
                        border: 4px solid #000 !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            {/* Action Bar (Hidden on Print) */}
            <div className="no-print" style={{ maxWidth: '900px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <button
                            onClick={() => setMode('acceso')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: mode === 'acceso' ? '#f59e0b' : 'transparent',
                                color: mode === 'acceso' ? '#060913' : '#94a3b8',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                cursor: 'pointer'
                            }}
                        >
                            📱 Cartel Ingreso WhatsApp
                        </button>
                        <button
                            onClick={() => setMode('municipal')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: mode === 'municipal' ? '#38bdf8' : 'transparent',
                                color: mode === 'municipal' ? '#060913' : '#94a3b8',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                cursor: 'pointer'
                            }}
                        >
                            🏛️ Cartel Reglamentario Municipal
                        </button>
                    </div>
                </div>

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
                    🖨️ Imprimir Cartel (A4 / Plotter)
                </button>
            </div>

            {/* MODE 1: CARTEL DE ACCESO & QR WHATSAPP */}
            {mode === 'acceso' && (
                <div className="poster-container" style={{
                    maxWidth: '900px',
                    margin: '0 auto',
                    background: '#ffffff',
                    color: '#0f172a',
                    borderRadius: '20px',
                    padding: '40px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                    border: '5px solid #f59e0b',
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
                                    Control de Asistencia Satelital • Res. SRT 319/99 & Ley 22.250
                                </p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-block', padding: '6px 12px', background: '#0f172a', color: '#fff', fontSize: '0.74rem', fontWeight: 900, borderRadius: '6px', letterSpacing: '0.5px' }}>
                                PREDIO AUDITADO GPS
                            </span>
                        </div>
                    </div>

                    {/* Project Details Box */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 24px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1.3fr 1.1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Proyecto / Obra:</span>
                            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{project.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{project.address}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Dirección Técnica:</span>
                            <strong style={{ color: '#0f172a' }}>{project.director}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Capataz General: {project.capataz}</span>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Geocerca Satelital:</span>
                            <strong style={{ color: '#10b981' }}>Radio {project.geofenceRadiusMeters}m Verificado</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>GPS Anti-Fraude Activo</span>
                        </div>
                    </div>

                    {/* Main QR Code & Instructions Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '32px', alignItems: 'center', marginBottom: '28px' }}>
                        <div style={{ textAlign: 'center', padding: '16px', background: '#fff', border: '3px dashed #f59e0b', borderRadius: '16px' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={qrCodeWorkerUrl}
                                alt="Código QR de Acceso a Obra"
                                style={{ width: '100%', maxWidth: '230px', height: 'auto', display: 'block', margin: '0 auto' }}
                            />
                            <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 900, color: '#0f172a', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Escanear con WhatsApp
                            </span>
                        </div>

                        <div>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px', fontFamily: tokens.font.heading }}>
                                Protocolo Obligatorio de Ingreso:
                            </h2>
                            <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '0.88rem', lineHeight: 1.8, color: '#334155' }}>
                                <li><strong>Escaneá el código QR</strong> con la cámara de tu celular o WhatsApp.</li>
                                <li>Se abrirá el <strong>Bot Oficial de ObraSaaS</strong> (+54 9 261 316-8608).</li>
                                <li>Enviá tu <strong>Ubicación en Tiempo Real 📍</strong> para certificar presentismo.</li>
                                <li>Si es tu primer día, enviá foto de tu <strong>DNI y Póliza ART</strong>.</li>
                            </ol>

                            <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef3c7', borderLeft: '4px solid #f59e0b', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e', fontWeight: 700 }}>
                                ⚠️ <strong>Seguridad e Higiene:</strong> Prohibido el ingreso sin seguro ART vigente (Res. SRT 299/11) y elementos de protección personal (Casco, calzado de seguridad, antiparras).
                            </div>
                        </div>
                    </div>

                    {/* Footer Security Badges */}
                    <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                        <span>🔒 Cifrado & Sellado Digital SHA-256</span>
                        <span>⚖️ Ley 22.250 • CCT 76/75 UOCRA</span>
                        <span>🌐 ObraSaaS Enterprise • Multi-Tenant</span>
                    </div>
                </div>
            )}

            {/* MODE 2: CARTEL REGLAMENTARIO MUNICIPAL (GCBA / CPAU / DGROC) */}
            {mode === 'municipal' && (
                <div className="poster-container" style={{
                    maxWidth: '900px',
                    margin: '0 auto',
                    background: '#ffffff',
                    color: '#0f172a',
                    borderRadius: '20px',
                    padding: '40px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                    border: '5px solid #0f172a',
                    boxSizing: 'border-box'
                }}>
                    {/* Official Municipal Header */}
                    <div style={{ borderBottom: '4px solid #0f172a', paddingBottom: '16px', marginBottom: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            GOBIERNO DE LA CIUDAD DE BUENOS AIRES • DGROC
                        </div>
                        <h1 style={{ fontSize: '1.9rem', fontWeight: 900, margin: '6px 0', textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#0f172a' }}>
                            CARTEL DE OBRA REGLAMENTARIO
                        </h1>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                            Código de Edificación • Ley N° 6.100 y Modificatorias
                        </div>
                    </div>

                    {/* Regulatory Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        {/* Expediente & Permiso */}
                        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>EXPEDIENTE MUNICIPAL:</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{project.expediente}</div>
                            <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '4px' }}>{project.permisoObra}</div>
                        </div>

                        {/* Destino y Superficie */}
                        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>DESTINO DE LA OBRA & SUPERFICIE:</div>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{project.destino}</div>
                            <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 700, marginTop: '4px' }}>Superficie Autorizada: {project.superficie}</div>
                        </div>
                    </div>

                    {/* Technical Directory Table */}
                    <div style={{ border: '2px solid #0f172a', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
                        <div style={{ background: '#0f172a', color: '#fff', padding: '10px 16px', fontWeight: 900, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            RESPONSABLES TÉCNICOS & PROFESIONALES
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', fontSize: '0.84rem' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>DIRECTOR DE OBRA:</span>
                                <strong style={{ color: '#0f172a' }}>{project.director}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#475569' }}>{project.directorMat}</span>
                            </div>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>PROYECTISTA / DIRECTORA ASOCIADA:</span>
                                <strong style={{ color: '#0f172a' }}>{project.socia}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#475569' }}>{project.sociaMat}</span>
                            </div>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>EMPRESA CONSTRUCTORA:</span>
                                <strong style={{ color: '#0f172a' }}>{project.empresa}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#475569' }}>Representante Técnico: {project.repTecnico}</span>
                            </div>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>HIGIENE & SEGURIDAD EN EL TRABAJO:</span>
                                <strong style={{ color: '#0f172a' }}>{project.higieneSeguridad}</strong>
                                <span style={{ display: 'block', fontSize: '0.74rem', color: '#475569' }}>{project.artCompany}</span>
                            </div>
                        </div>
                    </div>

                    {/* Dual QR Verification Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrCodePortalUrl} alt="QR Vecino Digital" style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a' }}>VECINO DIGITAL & INSPECTORES</div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Escaneá para consultar plano aprobado, libro de obra digital y certificaciones en tiempo real.</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrCodeWorkerUrl} alt="QR Operarios" style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a' }}>ACCESO PERSONAL & ART</div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Fichaje satelital biométrico con validación de seguro de riesgos de trabajo.</div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                        <span>ObraSaaS Enterprise • Expediente Digital Certificado</span>
                        <span>Emisión: {new Date().toLocaleDateString('es-AR')}</span>
                        <span>Código QR de Verificación Pública Activo</span>
                    </div>
                </div>
            )}
        </div>
    );
}
