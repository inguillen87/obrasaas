'use client';

import React from 'react';
import Link from 'next/link';

export default function ClienteRoleView({
  state,
  setShowForensicCertModal,
  addToast
}) {
  const photosList = state.sitePhotos || [];
  const certsList = state.certifications || [
    { nro: '01/2026', periodo: 'Quincena 1 (Ago)', monto: 18500000, estado: 'Aprobado & Pagado', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { nro: '02/2026', periodo: 'Quincena 2 (Ago)', monto: 24350000, estado: 'En Certificación', hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' },
  ];

  return (
    <div className="role-view cliente-view animate-fade-in-up">
      {/* Role Header Banner */}
      <div className="glass-panel-premium" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderLeft: '4px solid #a855f7', background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🏛️ Portal de Transparencia para Inversores & Municipio
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Acceso: <strong>Comitente / Inversor / Organismo de Control</strong></span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Rendición de Cuentas, Avance Fotográfico & Certificaciones
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
            Visualización auditada de avance físico, fondos invertidos, inspecciones de calidad y modelo 3D del proyecto.
          </p>
        </div>

        {/* Quick Action Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowForensicCertModal(true)}
            className="btn btn-sm"
            style={{ background: '#a855f7', color: '#fff', fontWeight: 800, fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-file-shield"></i> Informe Pericial PDF
          </button>
          <Link href="/bim" style={{ textDecoration: 'none' }}>
            <button 
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
            >
              <i className="fa-solid fa-cube"></i> Explorar en 3D BIM
            </button>
          </Link>
          <Link href="/planos" style={{ textDecoration: 'none' }}>
            <button 
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px' }}
            >
              <i className="fa-solid fa-compass-drafting"></i> Planos CAD
            </button>
          </Link>
        </div>
      </div>

      {/* Cliente Specific KPIs */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon primary"><i className="fa-solid fa-building-circle-check"></i></div>
          <div className="stat-content">
            <span className="stat-value">{state.avancePercentage || 24}%</span>
            <span className="stat-label">Avance Global Auditado</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon success"><i className="fa-solid fa-coins"></i></div>
          <div className="stat-content">
            <span className="stat-value">$42.85M ARS</span>
            <span className="stat-label">Inversión Ejecutada (USD 35.7K)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon info"><i className="fa-solid fa-calendar-check"></i></div>
          <div className="stat-content">
            <span className="stat-value">15 Dic 2026</span>
            <span className="stat-label">Posesión Estimada (+2d gracia)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon warning"><i className="fa-solid fa-medal"></i></div>
          <div className="stat-content">
            <span className="stat-value">A+ (99.4%)</span>
            <span className="stat-label">Calidad & Cumplimiento</span>
          </div>
        </div>
      </div>

      {/* High Resolution Certified Photographic Gallery */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-camera" style={{ color: '#38bdf8' }}></i> Galería de Inspección Fotográfica Auditada con IA
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fotos tomadas en sitio con geolocalización y diagnóstico de IA</span>
          </div>
          <span className="badge badge-success"><i className="fa-solid fa-shield-halved"></i> Sellado SHA-256</span>
        </div>

        <div className="grid-2" style={{ gap: '16px' }}>
          {photosList.map((photo, idx) => (
            <div key={photo.id || idx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ height: '200px', backgroundImage: `url(${photo.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.8)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', border: '1px solid #38bdf8' }}>
                  {photo.phase}
                </div>
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.8)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#fff' }}>
                  {photo.timestamp}
                </div>
              </div>
              <div style={{ padding: '16px' }}>
                <strong style={{ fontSize: '0.9rem', color: '#fff', display: 'block', marginBottom: '6px' }}>{photo.caption}</strong>
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid #38bdf8', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '10px' }}>
                  <i className="fa-solid fa-brain" style={{ color: '#38bdf8', marginRight: '6px' }}></i>
                  <strong>Diagnóstico de Calidad:</strong> {photo.aiAnalysis}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b' }}>
                  <span>Auditor: <strong style={{ color: '#94a3b8' }}>{photo.reporter}</strong></span>
                  <span style={{ color: '#22c55e' }}>✓ Inspección Aprobada</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications Log & BIM Row */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Bank & Payment Certifications */}
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#22c55e' }}></i> Certificados de Medición Quincenal
            </h3>
            <span className="badge badge-success">Validez Jurídica</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {certsList.map((cert, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Acta de Medición #{cert.nro}</strong>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{cert.periodo}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#4ade80', display: 'block' }}>
                      ${cert.monto?.toLocaleString('es-AR')} ARS
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{cert.estado}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontFamily: 'monospace' }}>
                  Hash: {cert.hash?.substring(0, 24)}...
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3D BIM Viewer Card */}
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-cube" style={{ color: '#a855f7' }}></i> Modelo 3D del Edificio (Avance Real)
            </h3>
            <Link href="/bim">
              <button className="btn btn-sm" style={{ background: '#a855f7', color: '#fff', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px' }}>
                Abrir 3D ↗
              </button>
            </Link>
          </div>

          <div style={{ height: '220px', background: 'url(/bim_render.png) center/cover no-repeat', borderRadius: '10px', border: '1px solid var(--border-color)', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.8)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#fff' }}>
              Piso 3 en ejecución • Hormigón H-30 Colado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
