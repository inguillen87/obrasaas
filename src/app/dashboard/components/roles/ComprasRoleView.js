'use client';

import React from 'react';
import Link from 'next/link';

export default function ComprasRoleView({
  state,
  setShowReceiveMaterialModal,
  addToast
}) {
  const stockItems = Object.keys(state.stockpiles || {}).map(k => ({ key: k, ...state.stockpiles[k] }));
  const criticalCount = stockItems.filter(item => item.status === 'Crítico' || (item.current / item.max) < 0.25).length;
  const remitosList = state.remitos || [];
  const cajaChica = state.cajaChica || { saldoActual: 485000, fondoInicial: 1500000 };

  const handleUrgentFreight = (supplierName) => {
    addToast(`🚚 Solicitud de Flete Urgente despachada por WhatsApp a: ${supplierName}`, 'success');
  };

  return (
    <div className="role-view compras-view animate-fade-in-up">
      {/* Role Header Banner */}
      <div className="glass-panel-premium" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderLeft: '4px solid #38bdf8', background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🛒 Abastecimiento, Logística & Corralón
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Responsable: <strong>Socio de Compras / Jefe de Pañol</strong></span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Panel de Suministros, Acopios & Validación AFIP
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
            Trazabilidad de compras de materiales, remitos digitalizados con IA (OCR), control de corralón y fletes en tránsito.
          </p>
        </div>

        {/* Quick Action Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowReceiveMaterialModal(true)}
            className="btn btn-sm"
            style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-truck-loading"></i> Recepcionar Material
          </button>
          <button 
            onClick={() => addToast('📸 Abrí el bot de WhatsApp y enviá la foto del remito para escaneo OCR automático con CAE.', 'info')}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px' }}
          >
            <i className="fa-solid fa-receipt"></i> Escanear Remito AFIP
          </button>
          <Link href="/marketplace" style={{ textDecoration: 'none' }}>
            <button 
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}
            >
              <i className="fa-solid fa-store"></i> Marketplace Corralones
            </button>
          </Link>
        </div>
      </div>

      {/* Compras Specific KPIs */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className={`stat-icon ${criticalCount > 0 ? 'danger fa-fade' : 'success'}`}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{criticalCount}</span>
            <span className="stat-label">Materiales en Nivel Crítico</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon info"><i className="fa-solid fa-truck-fast"></i></div>
          <div className="stat-content">
            <span className="stat-value">1 Flete</span>
            <span className="stat-label">En Tránsito (Loma Negra)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon success"><i className="fa-solid fa-wallet"></i></div>
          <div className="stat-content">
            <span className="stat-value">${(cajaChica.saldoActual || 485000).toLocaleString('es-AR')}</span>
            <span className="stat-label">Saldo Caja Chica (ARS)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon primary"><i className="fa-solid fa-receipt"></i></div>
          <div className="stat-content">
            <span className="stat-value">{remitosList.length}</span>
            <span className="stat-label">Remitos Auditados con CAE</span>
          </div>
        </div>
      </div>

      {/* Visual Stockpiles Grid with Progress Bars */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#38bdf8' }}></i> Niveles de Acopio en Obra & Alertas de Quiebre
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Capacidad máxima y umbrales mínimos según avance quincenal</span>
          </div>
          <button 
            onClick={() => setShowReceiveMaterialModal(true)} 
            className="btn btn-sm btn-primary"
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
          >
            + Registrar Ingreso a Pañol
          </button>
        </div>

        <div className="grid-4">
          {stockItems.map(item => {
            const pct = Math.min(Math.round((item.current / item.max) * 100), 100);
            const isLow = pct <= 25;

            return (
              <div key={item.key} style={{ background: 'rgba(255,255,255,0.02)', border: isLow ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#fff', display: 'block' }}>{item.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.supplier}</span>
                  </div>
                  <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                    {isLow ? 'CRÍTICO' : 'NORMAL'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: isLow ? '#f87171' : '#38bdf8' }}>
                    {item.current} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>{item.unit}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Mín: {item.min} / Máx: {item.max}</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: isLow ? '#ef4444' : '#38bdf8', borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
                </div>

                <button 
                  onClick={() => handleUrgentFreight(item.supplier)}
                  className="btn btn-sm btn-secondary"
                  style={{ width: '100%', fontSize: '0.7rem', padding: '5px', borderRadius: '6px', marginTop: '4px' }}
                >
                  <i className="fa-solid fa-truck"></i> Pedir Flete
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supplier SLAs & OCR Invoices Row */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Supplier Directory with Live SLAs */}
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-handshake" style={{ color: '#22c55e' }}></i> Proveedores & Tiempos de Entrega
            </h3>
            <span className="badge badge-success">4 Activos</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { name: 'Loma Negra Cargas', rubro: 'Hormigón & Cemento', sla: '24 hs hábiles', rating: '4.9 ★', tel: '+54 9 11 4000-1111' },
              { name: 'Acindar S.A.', rubro: 'Hierro A500 & Mallas', sla: '48 hs hábiles', rating: '4.8 ★', tel: '+54 9 11 4000-2222' },
              { name: 'Pinturerías Rex', rubro: 'Impermeabilizantes', sla: '12 hs (Mismo día)', rating: '4.7 ★', tel: '+54 9 11 4000-3333' },
              { name: 'Corralón Central Palermo', rubro: 'Áridos & Ladrillo Hueco', sla: '6 hs (Express)', rating: '4.9 ★', tel: '+54 9 11 4000-4444' },
            ].map((sup, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{sup.name}</strong>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{sup.rubro} • SLA: <strong style={{ color: '#38bdf8' }}>{sup.sla}</strong></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24' }}>{sup.rating}</span>
                  <button 
                    onClick={() => addToast(`📱 Abriendo WhatsApp con ${sup.name}`, 'info')}
                    className="btn btn-sm"
                    style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '4px 8px', fontSize: '0.7rem', borderRadius: '6px' }}
                  >
                    <i className="fa-brands fa-whatsapp"></i> Contactar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OCR Remitos Feed */}
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-receipt" style={{ color: '#fbbf24' }}></i> Remitos Digitalizados (OCR GPT-4o)
            </h3>
            <span className="badge badge-warning">Validación AFIP CAE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
            {remitosList.map((rem, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{rem.proveedor}</strong>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CUIT: {rem.cuit} • Comp: {rem.comprobanteNro}</div>
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#4ade80' }}>
                    ${rem.montoTotal?.toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                  <span>Rendido por: <strong style={{ color: '#cbd5e1' }}>{rem.solicitante}</strong></span>
                  <span style={{ color: '#38bdf8' }}>✓ CAE Electrónico Verificado</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
