"use client";

import React from 'react';

export default function PersonalHR({
  state,
  setState,
  activeTab,
  addToast,
  hrBonusAssignee,
  setHrBonusAssignee,
  hrBonusType,
  setHrBonusType,
  hrMedAssignee,
  setHrMedAssignee,
  hrMedDiagnosis,
  setHrMedDiagnosis,
  hrMedDays,
  setHrMedDays,
  hrMedFileName,
  setHrMedFileName,
  handleAwardBonus,
  handleSubmitMedicalCert,
  handleMedicalFileSelected
}) {
  return (
    <section id="sec-personal" className={`content-section animate-fade-in-up ${activeTab === 'sec-personal' ? 'active' : ''}`}>
      <div className="section-header">
        <div className="header-title">
          <h1>Gestión de Personal &amp; Recursos Humanos</h1>
          <p>Estadísticas de presentismo, control de asistencia satelital, bonos de incentivos y licencias de la cuadrilla.</p>
        </div>
        <div className="header-actions">
          <span className="badge badge-success"><i className="fa-solid fa-users"></i> Cuadrilla Activa</span>
        </div>
      </div>

      <div className="grid-3">
        {/* Empleado del Mes */}
        <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-award"></i> Empleado del Mes</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
              Reconocimiento automático de IA basado en presentismo, puntualidad y tareas completadas en Gantt.
            </p>
            
            <div style={{ background: 'rgba(255, 159, 28, 0.05)', border: '1px solid var(--primary)', padding: '20px', borderRadius: '12px', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--primary)', color: 'var(--bg-main)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', boxShadow: '0 0 10px var(--primary-glow)' }}>
                <i className="fa-solid fa-crown" style={{ fontSize: '0.8rem' }}></i>
              </div>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#475569', backgroundImage: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffffff"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>\')', backgroundSize: '40px', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', margin: '0 auto 12px auto', border: '3px solid var(--primary)', boxShadow: '0 0 15px rgba(255, 159, 28, 0.3)' }}></div>
              <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '4px' }}>Juan Gómez</h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Albañilería Principal</span>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Asistencia</span>
                  <strong style={{ color: 'var(--success)', fontSize: '0.9rem' }}>100%</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Tareas</span>
                  <strong style={{ color: '#fff', fontSize: '0.9rem' }}>2 Hechas</strong>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '20px', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
            Premio mensual: Bono de $35.000 ARS y canasta de herramientas.
          </div>
        </div>

        {/* Incentives / Bonuses */}
        <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--success)' }}><i className="fa-solid fa-gift"></i> Premios &amp; Bonos Asignados</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
            Incentivos cargados para motivar el cumplimiento de plazos del cronograma.
          </p>
          
          <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {state.hrBonuses.map((bonus, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', color: '#fff' }}>{bonus.name}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{bonus.type}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 800, display: 'block' }}>{bonus.amount}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{bonus.date}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select value={hrBonusAssignee} onChange={(e) => setHrBonusAssignee(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', flexGrow: 1, width: '50%' }}>
                <option value="Juan Gómez">Juan Gómez</option>
                <option value="Luis Martínez">Luis Martínez</option>
                <option value="Carlos Pérez">Carlos Pérez</option>
              </select>
              <select value={hrBonusType} onChange={(e) => setHrBonusType(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', flexGrow: 1, width: '50%' }}>
                <option value="Bono de Puntualidad">Bono Puntualidad ($15.000)</option>
                <option value="Premio Velocidad Gantt">Premio Velocidad ($20.000)</option>
                <option value="Presentismo Perfecto">Presentismo Perfecto ($25.000)</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleAwardBonus} style={{ width: '100%', padding: '8px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <i className="fa-solid fa-plus"></i> Otorgar Incentivo / Bono
            </button>
          </div>
        </div>

        {/* Medical Licences */}
        <div className="glass-panel-premium dashboard-card-hover">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--info)' }}><i className="fa-solid fa-notes-medical"></i> Licencias &amp; Certificados Médicos</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
            Registra certificados médicos recibidos por WhatsApp para justificar ausencias en presentismo.
          </p>
          
          <form onSubmit={handleSubmitMedicalCert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Seleccionar Operario</label>
              <select value={hrMedAssignee} onChange={(e) => setHrMedAssignee(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }} required>
                <option value="Carlos Pérez">Carlos Pérez (Ausente)</option>
                <option value="Luis Martínez">Luis Martínez</option>
                <option value="Juan Gómez">Juan Gómez</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Diagnóstico</label>
                <input type="text" placeholder="Ej. Gripe / Esguince" value={hrMedDiagnosis} onChange={(e) => setHrMedDiagnosis(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Días</label>
                <select value={hrMedDays} onChange={(e) => setHrMedDays(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }}>
                  <option value="1 día">1 día</option>
                  <option value="2 días">2 días</option>
                  <option value="3 días">3 días</option>
                  <option value="5 días">5 días</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Foto del Certificado (.jpg/.pdf)</label>
              <div style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', cursor: 'pointer' }} onClick={() => document.getElementById('hr-file-input').click()}>
                <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.2rem', color: 'var(--info)', marginBottom: '4px', display: 'block' }}></i>
                <span>{hrMedFileName}</span>
                <input type="file" id="hr-file-input" style={{ display: 'none' }} onChange={handleMedicalFileSelected} />
              </div>
            </div>
            <button type="submit" className="btn btn-secondary" style={{ background: 'var(--info-bg)', border: '1px solid var(--info)', color: 'var(--info)', width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}>
              <i className="fa-solid fa-file-circle-check"></i> Cargar Licencia &amp; Justificar Faltas
            </button>
          </form>
        </div>
      </div>

      {/* Centro de Verificación KYC & Identidad Biometría */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
        <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--primary)' }}>
              <i className="fa-solid fa-id-card-clip"></i> Centro de Verificación KYC &amp; Identidad Biometría
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Auditoría estricta de identidad: validación de DNI mediante OCR, biometría facial (liveness check), geocerca satelital y enrolamiento vocal.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/webview/kyc" target="_blank" className="btn btn-primary btn-sm" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-user-plus"></i> Abrir Portal KYC Móvil
            </a>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Operario / Legajo</th>
                <th style={{ padding: '10px' }}>DNI / CUIL</th>
                <th style={{ padding: '10px' }}>Documento DNI</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Facial Match</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Voz Enrolada</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Geocerca GPS</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado KYC</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(state.kycVerifications || {}).map((kyc, kIndex) => {
                const isVerified = kyc.status === 'VERIFICADO';
                return (
                  <tr key={kyc.workerId || kIndex} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundImage: `url(${kyc.selfieUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'})`, backgroundSize: 'cover', backgroundPosition: 'center', border: `2px solid ${isVerified ? 'var(--success)' : '#64748b'}` }}></div>
                        <div>
                          <strong style={{ display: 'block', color: '#fff' }}>{kyc.workerName}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>{kyc.trade}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontWeight: 700, color: '#fff', display: 'block' }}>{kyc.dni}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{kyc.phone || '+54 9 11 ...'}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {kyc.dniFrontUrl ? (
                        <span style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-file-check"></i> OCR Validado
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                          <i className="fa-solid fa-clock"></i> Pendiente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {kyc.faceMatchScore > 0 ? (
                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          {kyc.faceMatchScore}% ✓
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {kyc.voiceSampleEnrolled ? (
                        <span style={{ color: '#38bdf8' }}><i className="fa-solid fa-microphone-lines"></i> Sí</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {kyc.geofenceRadiusValid ? (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>En Radio (0-100m)</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Sin GPS</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span className={`badge ${isVerified ? 'badge-success' : 'badge-warning'}`}>
                        {kyc.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auditoría de Pólizas ART & IERIC (Ley 22.250 / Res. SRT 299/11) */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
        <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#f59e0b' }}>
              <i className="fa-solid fa-shield-halved"></i> Auditoría de Pólizas ART &amp; IERIC (Ley 22.250 / Res. SRT 299/11)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Control estricto de cobertura de riesgos del trabajo. Bloqueo preventivo automático ante pólizas vencidas o falta de Cláusula de No Repetición.
            </p>
          </div>
          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid #f59e0b' }}>
            <i className="fa-solid fa-file-shield"></i> Exigencia Legal de Ingreso
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Operario</th>
                <th style={{ padding: '10px' }}>Compañía ART</th>
                <th style={{ padding: '10px' }}>N° de Póliza</th>
                <th style={{ padding: '10px' }}>Vencimiento</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Cláusula No Repetición</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(state.artPolicies || {}).map((wName) => {
                const policy = state.artPolicies[wName];
                const isVigente = policy.status === 'VIGENTE';
                return (
                  <tr key={wName} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px' }}><strong style={{ color: '#fff' }}>{wName}</strong></td>
                    <td style={{ padding: '10px', color: '#38bdf8' }}>{policy.company}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>{policy.policyNumber}</td>
                    <td style={{ padding: '10px', color: isVigente ? '#fff' : '#ef4444', fontWeight: isVigente ? 'normal' : 'bold' }}>{policy.expirationDate}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {policy.clausulaNoRepeticion ? (
                        <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓ Incluida</span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>✗ Faltante</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span className={`badge ${isVigente ? 'badge-success' : 'badge-danger'}`}>
                        {policy.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📄 Recibos de Sueldo Digitales UOCRA (CCT 76/75 & Ley 22.250 / Ley 20.744) */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
        <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#38bdf8' }}>
              <i className="fa-solid fa-file-invoice-dollar"></i> Recibos de Sueldo Digitales UOCRA (CCT 76/75 &amp; Ley 22.250)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Distribución automatizada por WhatsApp y firma digital con validez legal bajo Ley 20.744 art. 140 con sellado de tiempo criptográfico SHA-256.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-info" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8' }}>
              1ra Quincena — Agosto 2026
            </span>
            <button
              onClick={() => {
                if (addToast) {
                  addToast('Despachando recibos quincenales por WhatsApp a toda la cuadrilla...', 'info');
                  setTimeout(() => addToast('✅ 5/5 Recibos de Sueldo enviados por WhatsApp con enlace de firma digital.', 'success'), 1200);
                }
              }}
              style={{ padding: '6px 14px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              <i className="fa-brands fa-whatsapp"></i> Despachar Recibos a Cuadrilla
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Operario</th>
                <th style={{ padding: '10px' }}>Categoría UOCRA</th>
                <th style={{ padding: '10px' }}>Horas / Período</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Bruto</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Neto a Cobrar</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Firma Digital</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Juan Zapata', cat: 'Oficial Armador', hs: '88 hs + 8 hs ext.', bruto: '$513.830', neto: '$352.240', status: 'FIRMADO', hash: 'SHA256:7f8a...7b8c', id: 'juan' },
                { name: 'Carlos Gómez', cat: 'Oficial Albañil', hs: '88 hs', bruto: '$461.400', neto: '$318.500', status: 'PENDIENTE', hash: null, id: 'carlos' },
                { name: 'Luis Martínez', cat: 'Medio Oficial', hs: '88 hs + 4 hs ext.', bruto: '$428.200', neto: '$294.750', status: 'PENDIENTE', hash: null, id: 'luis' },
                { name: 'Marcelo Rodríguez', cat: 'Capataz General', hs: '88 hs', bruto: '$620.000', neto: '$428.100', status: 'FIRMADO', hash: 'SHA256:4a2c...9e10', id: 'marcelo' },
                { name: 'Roberto Díaz', cat: 'Ayudante', hs: '80 hs (1 falta just.)', bruto: '$355.000', neto: '$245.300', status: 'PENDIENTE', hash: null, id: 'roberto' }
              ].map((rec) => {
                const isSigned = rec.status === 'FIRMADO';
                return (
                  <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px' }}><strong style={{ color: '#fff' }}>{rec.name}</strong></td>
                    <td style={{ padding: '10px', color: '#38bdf8' }}>{rec.cat}</td>
                    <td style={{ padding: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{rec.hs}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>{rec.bruto}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{rec.neto}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isSigned ? (
                        <span className="badge badge-success" title={rec.hash} style={{ cursor: 'pointer' }}>
                          <i className="fa-solid fa-signature"></i> Firmado ✓
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <i className="fa-solid fa-clock"></i> Pendiente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <a
                          href={`/webview/recibos?worker=${rec.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', textDecoration: 'none', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'inline-block' }}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i> Ver Recibo
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance History */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', color: '#fff' }}><i className="fa-solid fa-calendar-check"></i> Historial de Presentismo &amp; Licencias de la Obra</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Operario</th>
                <th style={{ padding: '10px' }}>Rol</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Asistencias</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Faltas Justificadas</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Faltas Injustificadas</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado Actual</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(state.hrAttendance).map(name => {
                const item = state.hrAttendance[name];
                const currentAtt = state.attendance[name] || {};
                
                let statusBadge = <span className="badge badge-warning">Ausente</span>;
                if (currentAtt.status === 'Presente' || currentAtt.status.includes('GPS')) {
                  statusBadge = <span className="badge badge-success">Presente</span>;
                } else if (currentAtt.status.includes('Justificado')) {
                  statusBadge = <span className="badge badge-info">Licencia</span>;
                }

                return (
                  <tr key={name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px' }}><strong>{name}</strong></td>
                    <td style={{ padding: '10px' }}>{item.role}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.presents}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.excused}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.unexcused}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{statusBadge}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
