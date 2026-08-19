'use client';

import React from 'react';
import Link from 'next/link';

export default function DirectorRoleView({
  state,
  progressChartRef,
  tasksChartRef,
  mapContainerRef,
  mapMode,
  setMapMode,
  copilotMessages,
  copilotInput,
  setCopilotInput,
  sendCopilotUserMessage,
  copilotMessagesEndRef,
  handleAgenticAction,
  setShowForensicCertModal,
  setShowWeeklyReportModal,
  addToast
}) {
  return (
    <div className="role-view director-view animate-fade-in-up">
      {/* Role Header Banner */}
      <div className="glass-panel-premium" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderLeft: '4px solid #f59e0b', background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👑 Dirección Ejecutiva & Técnica
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Responsable: <strong>Arq. Marcelo Guillén / Arq. Victoria</strong></span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Panel de Dirección Técnica & Certificaciones Oficiales
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
            Control de hitos críticos, Curva S financiera, Libro de Obra (Ley 22.250) y firma digital con sellado SHA-256.
          </p>
        </div>

        {/* Quick Action Toolbar for Director */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowForensicCertModal(true)}
            className="btn btn-sm"
            style={{ background: '#f59e0b', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-signature"></i> Firmar Certificado SHA-256
          </button>
          <button 
            onClick={() => setShowWeeklyReportModal(true)}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px' }}
          >
            <i className="fa-solid fa-file-pdf"></i> Acta Semanal
          </button>
          <Link href="/bim" style={{ textDecoration: 'none' }}>
            <button 
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
            >
              <i className="fa-solid fa-cube"></i> Visor 3D BIM
            </button>
          </Link>
        </div>
      </div>

      {/* Quick Access Grid — Enterprise Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px', marginBottom: '20px' }}>
        <Link href="/libro-obra" style={{ textDecoration: 'none' }}>
          <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px 16px', cursor: 'pointer', borderLeft: '3px solid #a855f7', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📖</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Libro de Obra</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Ley 22.250 + CPAU</div>
          </div>
        </Link>
        <Link href="/cronograma" style={{ textDecoration: 'none' }}>
          <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px 16px', cursor: 'pointer', borderLeft: '3px solid #3b82f6', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📅</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Cronograma Studio</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Gantt CPM + Lookahead</div>
          </div>
        </Link>
        <Link href="/inspecciones" style={{ textDecoration: 'none' }}>
          <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px 16px', cursor: 'pointer', borderLeft: '3px solid #10b981', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📋</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Inspecciones QA/QC</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>SRT 911/96 + CIRSOC</div>
          </div>
        </Link>
        <Link href="/documentos" style={{ textDecoration: 'none' }}>
          <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px 16px', cursor: 'pointer', borderLeft: '3px solid #f59e0b', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📁</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Documentos</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Submittals & Aprobaciones</div>
          </div>
        </Link>
        <Link href="/planos" style={{ textDecoration: 'none' }}>
          <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px 16px', cursor: 'pointer', borderLeft: '3px solid #ef4444', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📐</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Planos & Punch List</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>QA/QC + RFIs</div>
          </div>
        </Link>
        <Link href="/costos" style={{ textDecoration: 'none' }}>
          <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px 16px', cursor: 'pointer', borderLeft: '3px solid #06b6d4', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>💰</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Costos & Adicionales</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Change Orders CAC</div>
          </div>
        </Link>
      </div>

      {/* Director Specific KPIs */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon primary"><i className="fa-solid fa-chart-line"></i></div>
          <div className="stat-content">
            <span className="stat-value">{state.avancePercentage || 24}%</span>
            <span className="stat-label">Avance Físico Global</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon success"><i className="fa-solid fa-sack-dollar"></i></div>
          <div className="stat-content">
            <span className="stat-value">${((state.cajaChica?.fondoInicial || 120000000) / 1000000).toFixed(1)}M</span>
            <span className="stat-label">Presupuesto Ejecutado</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon info"><i className="fa-solid fa-shield-halved"></i></div>
          <div className="stat-content">
            <span className="stat-value">{(state.certifications || []).length || 3}</span>
            <span className="stat-label">Certificados SHA-256</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className={`stat-icon ${state.alertsCount > 0 ? 'danger fa-fade' : 'success'}`}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{state.alertsCount || 0}</span>
            <span className="stat-label">Desvíos & Alertas</span>
          </div>
        </div>
      </div>

      {/* Charts Row: Curva S & Tareas */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Curva S: Avance Real vs. Planificado</h3>
            <span className="badge badge-success">+4.2% Ajuste CAC</span>
          </div>
          <div className="chart-container" style={{ height: '220px', position: 'relative' }}>
            <canvas ref={progressChartRef}></canvas>
          </div>
        </div>

        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Distribución de Tareas por Estado</h3>
            <span className="badge badge-info">{Object.keys(state.tasks || {}).length} Tareas Activas</span>
          </div>
          <div className="chart-container" style={{ height: '220px', position: 'relative' }}>
            <canvas ref={tasksChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* BIM 3D & AI Supervisor Row */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* BIM Preview Card */}
        <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-cube" style={{ color: '#38bdf8' }}></i> Gemelo Digital BIM 3D
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Modelo federado IFC • 10 Niveles</span>
            </div>
            <Link href="/bim">
              <button className="btn btn-sm btn-primary" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                Pantalla Completa ↗
              </button>
            </Link>
          </div>
          <div style={{ height: '260px', width: '100%', borderRadius: '12px', background: 'url(/bim_render.png) center/cover no-repeat', border: '1px solid var(--border-color)', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Clash Detection & Estructura</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-success"><i className="fa-solid fa-check"></i> CIRSOC 201 OK</span>
                <span style={{ fontSize: '0.75rem', color: '#fff' }}>Losa Nivel 3 Colada</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Supervisor */}
        <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', color: 'var(--primary)' }}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> Copiloto Técnico IA (Director Mode)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '10px' }}>
            Consultá desvíos, cálculo de materiales, redeterminación CAC y avance quincenal.
          </p>
          
          <div className="copilot-chat-box">
            <div className="copilot-chat-messages" style={{ overflowY: 'auto' }}>
              {copilotMessages.map((msg, i) => (
                <div key={i} style={{ 
                  background: msg.sender === 'user' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)', 
                  padding: '10px 14px', 
                  borderRadius: '12px', 
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', 
                  maxWidth: '90%',
                  fontSize: '0.8rem',
                  color: '#fff',
                  border: msg.sender === 'bot' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                  {msg.text}
                </div>
              ))}
              <div ref={copilotMessagesEndRef}></div>
            </div>
            <div className="copilot-chat-input-container">
              <input 
                type="text" 
                className="copilot-chat-input" 
                placeholder="Preguntá sobre avance, CAC o certificaciones..." 
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCopilotUserMessage()}
              />
              <button className="copilot-chat-btn" onClick={sendCopilotUserMessage}>Consultar</button>
            </div>
          </div>
        </div>
      </div>

      {/* Forensic Audit Blockchain Ledger */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
        <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#a855f7' }}>
              <i className="fa-solid fa-link"></i> Libro de Obra Digital & Cadena SHA-256 (Ley 22.250)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Trazabilidad jurídica inmutable de cada avance certificado por la Dirección Técnica.
            </p>
          </div>
          <button 
            onClick={() => setShowForensicCertModal(true)} 
            className="btn btn-sm"
            style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid #a855f7', color: '#c084fc', fontSize: '0.78rem', fontWeight: 800, padding: '6px 12px', borderRadius: '8px' }}
          >
            <i className="fa-solid fa-file-shield"></i> Emitir Acta Pericial
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px' }}>Bloque #</th>
                <th style={{ padding: '8px' }}>Hora</th>
                <th style={{ padding: '8px' }}>Evento Registrado</th>
                <th style={{ padding: '8px' }}>Actor</th>
                <th style={{ padding: '8px' }}>Hash Criptográfico SHA-256</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Sello</th>
              </tr>
            </thead>
            <tbody>
              {(state.auditLedger || []).slice(0, 5).map((block, bIdx) => (
                <tr key={block.hash || bIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px', fontWeight: 800, color: '#a855f7' }}>#{block.index}</td>
                  <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{block.formattedTime || 'Reciente'}</td>
                  <td style={{ padding: '8px', color: '#fff', fontWeight: 600 }}>{block.action}</td>
                  <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{block.actor}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>
                    {block.hash?.substring(0, 16)}...{block.hash?.substring(block.hash?.length - 8)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontWeight: 'bold' }}>
                      ✓ FIRMADO
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
