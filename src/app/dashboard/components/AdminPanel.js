"use client";

export default function AdminPanel({
  state,
  setState,
  activeTab,
  addToast,
  simulateBillingCycle,
  billingCycleRunning,
  mrrChartRef,
  crmMessages,
  crmMessagesEndRef,
  crmInput,
  setCrmInput,
  sendCrmUserMessage,
  handleApproveProposal,
  handleNotifySupplier,
  handleConfirmSupplier,
  setShowReceiveMaterialModal,
  handleCertifyQuincena,
  showBillingLogs,
  billingLogs
}) {
  return (
          <section id="sec-admin" className={`content-section animate-fade-in-up ${activeTab === 'sec-admin' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Consola Multitenant de Super Admin</h1>
                <p>Gestión global de licencias, CRM comercial, tickets de soporte y métricas analíticas del negocio en Argentina.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={simulateBillingCycle} disabled={billingCycleRunning}>
                  {billingCycleRunning ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</> : <><i className="fa-solid fa-credit-card"></i> Ejecutar Facturación Mensual</>}
                </button>
              </div>
            </div>

            {/* Admin CRM Stats Grid */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon primary"><i className="fa-solid fa-hotel"></i></div>
                <div className="stat-content">
                  <span className="stat-value">28</span>
                  <span className="stat-label">Suscripciones</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon success"><i className="fa-solid fa-money-bill-trend-up"></i></div>
                <div className="stat-content">
                  <span className="stat-value" id="val-mrr">{state.subscription?.plan === 'Enterprise' ? "$5.030.000 ARS" : "$4.850.000 ARS"}</span>
                  <span className="stat-label">MRR Recurrente</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon info"><i className="fa-solid fa-user-tag"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.crmLeads.length}</span>
                  <span className="stat-label">Leads Activos</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon danger" style={{ background: state.crmTickets.length > 3 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.02)' }}><i className="fa-solid fa-ticket"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.crmTickets.length}</span>
                  <span className="stat-label">Tickets Abiertos</span>
                </div>
              </div>
            </div>

            {/* MRR & KPIs Row */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-chart-line"></i> Evolución de Ingresos Recurrentes (MRR)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Facturación mensual acumulada de licencias de estudios y constructoras en Argentina.
                </p>
                <div className="chart-container" style={{ height: '200px', position: 'relative' }}>
                  <canvas ref={mrrChartRef}></canvas>
                </div>
              </div>

              <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--success)' }}><i className="fa-solid fa-chart-pie"></i> KPIs de Negocio &amp; Retención</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                    Indicadores clave de performance de la plataforma comercial.
                  </p>
                </div>
                <div className="grid-2" style={{ gap: '16px', marginBottom: 0, gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Retención (SLA)</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>100%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--success)' }}>Churn Rate: 0%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--info)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Conversión Leads</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>24%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--info)' }}>+4.2% este mes</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tck. Resueltos</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>92.5%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--warning)' }}>SLA &lt; 2hs</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Crecimiento MRR</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>+15.4%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>Proyección Q3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CRM Chat and Subscriptions */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              {/* AI CRM Chatbot */}
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-chart-pie"></i> Consultor Financiero &amp; Leads (AI CRM)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Hazle consultas directas a la IA del negocio para auditar métricas financieras y conversiones.
                </p>

                <div className="crm-chat-box">
                  <div className="crm-chat-messages" style={{ overflowY: 'auto' }}>
                    {crmMessages.map((msg, i) => (
                      <div key={i} style={{ 
                        background: msg.sender === 'user' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)', 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', 
                        maxWidth: '90%',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        color: '#fff'
                      }}>
                        {msg.text.replace(/\*\*/g, '')}
                      </div>
                    ))}
                    <div ref={crmMessagesEndRef}></div>
                  </div>
                  <div className="crm-chat-input-container">
                    <input 
                      type="text" 
                      className="crm-chat-input" 
                      placeholder="Pregunta sobre MRR, leads o tickets..." 
                      value={crmInput}
                      onChange={(e) => setCrmInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendCrmUserMessage()}
                    />
                    <button className="crm-chat-btn" onClick={sendCrmUserMessage}>Consultar</button>
                  </div>
                </div>

                <div className="crm-suggestions">
                  <span className="crm-suggest-tag" onClick={() => { setCrmInput("Suscripciones de este mes"); setTimeout(sendCrmUserMessage, 50); }}>Suscripciones de este mes</span>
                  <span className="crm-suggest-tag" onClick={() => { setCrmInput("Leads y consultas comerciales"); setTimeout(sendCrmUserMessage, 50); }}>Leads y consultas comerciales</span>
                  <span className="crm-suggest-tag" onClick={() => { setCrmInput("Tickets de soporte abiertos"); setTimeout(sendCrmUserMessage, 50); }}>Tickets de soporte abiertos</span>
                </div>
              </div>

              {/* Active Subscriptions list */}
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Suscripciones de Estudios</h3>
                <table className="billing-table">
                  <thead>
                    <tr>
                      <th>Estudio / Constructora</th>
                      <th>Plan</th>
                      <th>Costo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Estudio BMA</strong></td>
                      <td><span className="badge badge-info">Enterprise</span></td>
                      <td>$350.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>MSGSSV</strong></td>
                      <td><span className="badge badge-info">Enterprise</span></td>
                      <td>$350.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>Estudio Clorindo Testa</strong></td>
                      <td><span className="badge badge-warning">Pro</span></td>
                      <td>$180.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>Constructora Innovar</strong></td>
                      <td><span className="badge badge-info">Enterprise</span></td>
                      <td>$350.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>Estudio MRA+A</strong></td>
                      <td><span className="badge badge-warning">Pro</span></td>
                      <td>$180.000</td>
                      <td>
                        <span className={`badge ${state.subscription?.plan === 'Enterprise' ? 'badge-success' : 'badge-danger'}`}>
                          {state.subscription?.plan === 'Enterprise' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* CRM Second Row: Leads and Tickets Lists */}
            <div className="grid-2">
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users-rectangle" style={{ color: 'var(--info)' }}></i> Leads de la Web (Consultas Recientes)
                </h3>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Contacto / Empresa</th>
                      <th>Asunto de Interés</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.crmLeads.map((lead, i) => (
                      <tr key={i}>
                        <td><strong>{lead.name}</strong><br/><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{lead.company}</span></td>
                        <td>{lead.topic}</td>
                        <td><span className={`badge ${lead.status === 'En Contacto' ? 'badge-warning' : 'badge-info'}`}>{lead.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--warning)' }}></i> Tickets de Soporte Activos
                </h3>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Usuario / Empresa</th>
                      <th>Problema Reportado</th>
                      <th>Gravedad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.crmTickets.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.client}</strong></td>
                        <td>{t.issue}</td>
                        <td><span className={`badge ${t.severity === 'Alta' ? 'badge-danger' : t.severity === 'Media' ? 'badge-warning' : 'badge-success'}`}>{t.severity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operational Proposals Inbox (Maker-Checker Workflow) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px', borderLeft: '4px solid var(--info)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-inbox" style={{ color: 'var(--info)' }}></i> Bandeja de Propuestas Operativas (Maker-Checker)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Reportes capturados por audio en WhatsApp que requieren validación y firma de la Directora de Obra para impactar el cronograma.
                  </p>
                </div>
                <span className="badge badge-info">{state.operationalProposals?.length || 0} Propuestas</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(state.operationalProposals || []).map((prop, idx) => (
                  <div key={prop.id || idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`badge ${prop.status === 'APROBADO' ? 'badge-success' : 'badge-warning'}`}>{prop.status}</span>
                        <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{prop.summary}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span><i className="fa-solid fa-user" style={{ marginRight: '4px' }}></i>{prop.proposedBy} ({prop.role})</span> • 
                        <span style={{ marginLeft: '6px' }}><i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>{prop.timestamp}</span> • 
                        <span style={{ marginLeft: '6px', color: 'var(--primary)' }}><i className="fa-solid fa-code-branch" style={{ marginRight: '4px' }}></i>Impacto: {prop.taskImpact}</span>
                      </div>
                    </div>

                    {prop.status !== 'APROBADO' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-sm btn-success" 
                          onClick={() => handleApproveProposal(prop.id)}
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        >
                          <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Aprobar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Módulo 2B: Catálogo de Proveedores & Notificaciones (7d / 2d) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-truck-field" style={{ color: 'var(--primary)' }}></i> Módulo 2B: Notificaciones &amp; Confirmaciones a Proveedores
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Avisos automáticos 7 días antes de la tarea asignada y confirmación obligatoria 2 días antes para evitar bloqueos en el Gantt.
                  </p>
                </div>
                <span className="badge badge-success"><i className="fa-solid fa-shield-check"></i> Sincronización Automática</span>
              </div>

              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Proveedor / Corralón</th>
                    <th>Categoría</th>
                    <th>Próxima Tarea Programada</th>
                    <th>Aviso Automático (7d antes)</th>
                    <th>Confirmación (2d antes)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(state.suppliers || []).map(prov => (
                    <tr key={prov.id}>
                      <td>
                        <strong>{prov.name}</strong><br/>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{prov.email}</span>
                      </td>
                      <td><span className="badge badge-info">{prov.category}</span></td>
                      <td><strong style={{ color: 'var(--primary)' }}>{prov.nextTaskDate}</strong></td>
                      <td>
                        <span className="badge badge-success">
                          <i className="fa-solid fa-paper-plane" style={{ marginRight: '4px' }}></i> {prov.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${prov.confirmationStatus?.includes('Confirmado') ? 'badge-success' : prov.confirmationStatus?.includes('Riesgo') ? 'badge-danger' : 'badge-warning'}`}>
                          {prov.confirmationStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-sm btn-secondary" 
                            onClick={() => handleNotifySupplier(prov.id)}
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                            title="Enviar notificación por Email y WhatsApp 7 días antes"
                          >
                            <i className="fa-solid fa-envelope"></i> Aviso 7d
                          </button>
                          <button 
                            className="btn btn-sm btn-success" 
                            onClick={() => handleConfirmSupplier(prov.id)}
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                            title="Confirmar recepción y compromiso de entrega 2 días antes"
                          >
                            <i className="fa-solid fa-check-double"></i> Confirmar 2d
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Módulo 4B: Control de Acopios & Fechas Comprometidas de Entrega */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-cubes-stacked" style={{ color: 'var(--warning)' }}></i> Módulo 4B: Acopios &amp; Fecha de Entrega Comprometida
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Fechas comprometidas por el proveedor visibles para todo el equipo. Bloqueo automático de tareas dependientes en caso de rotura de stock.
                  </p>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => setShowReceiveMaterialModal(true)}>
                  <i className="fa-solid fa-dolly"></i> Recibir Material
                </button>
              </div>

              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Material / Insumo</th>
                    <th>Stock Actual / Mínimo</th>
                    <th>Proveedor Responsable</th>
                    <th>Fecha Comprometida</th>
                    <th>Estado de Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(state.stockpiles || {}).map(key => {
                    const mat = state.stockpiles[key];
                    const isLow = mat.current < mat.min;
                    return (
                      <tr key={key}>
                        <td><strong>{mat.name}</strong></td>
                        <td>
                          <span style={{ fontWeight: 700, color: isLow ? 'var(--danger)' : '#fff' }}>
                            {mat.current} {mat.unit}
                          </span> / {mat.min} {mat.unit}
                        </td>
                        <td>{mat.supplier}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{mat.confirmedDeliveryDate || '16/08/2026'}</strong></td>
                        <td>
                          <span className={`badge ${mat.status === 'Crítico' ? 'badge-danger' : mat.status === 'Demorado' ? 'badge-warning' : 'badge-success'}`}>
                            {mat.onTimeStatus || mat.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Módulo 8 & 10: Certificaciones Quincenales de Obra */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-file-signature" style={{ color: 'var(--primary)' }}></i> Módulos 8 &amp; 10: Certificaciones Quincenales de Avance
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Actas de medición física y financiera quincenales para facturación transparente a propietarios o entes públicos.
                  </p>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                {(state.certifications || []).map(cert => (
                  <div key={cert.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: cert.approvedByDirector ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{cert.period}</strong>
                      <span className={`badge ${cert.approvedByDirector ? 'badge-success' : 'badge-warning'}`}>{cert.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avance Físico Medido:</span>
                      <strong>{cert.physicalProgress}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Valor Financiero:</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>{cert.financialValue}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <span>Firma Directora: <strong>{cert.directorName}</strong> {cert.approvedByDirector ? '✍️ (Firmado)' : '⏳ (Pendiente)'}</span>
                      {!cert.approvedByDirector && (
                        <button 
                          className="btn btn-sm btn-primary" 
                          onClick={() => handleCertifyQuincena(cert.id)}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          <i className="fa-solid fa-pen-nib" style={{ marginRight: '4px' }}></i> Certificar Quincena
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Módulo 7: Caja Chica & OCR de Comprobantes */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-receipt" style={{ color: 'var(--info)' }}></i> Módulo 7: Caja Chica &amp; Rendiciones con OCR
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Control de fondos para compras de ferretería y fletes menores con lectura automática de tickets por visión artificial.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-info">Saldo Actual: ${(state.cajaChica?.saldoActual || 84500).toLocaleString('es-AR')} ARS</span>
                </div>
              </div>

              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Descripción del Gasto</th>
                    <th>Monto</th>
                    <th>Solicitante</th>
                    <th>Fecha</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {(state.cajaChica?.movimientos || []).map(mov => (
                    <tr key={mov.id}>
                      <td><strong>{mov.descripcion}</strong></td>
                      <td><strong style={{ color: 'var(--danger)' }}>-${mov.monto.toLocaleString('es-AR')} ARS</strong></td>
                      <td>{mov.solicitante}</td>
                      <td>{mov.fecha}</td>
                      <td>
                        <span className="badge badge-success" style={{ cursor: 'pointer' }}>
                          <i className="fa-solid fa-file-image" style={{ marginRight: '4px' }}></i> Ticket OCR Validado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Simulation Log */}
            {showBillingLogs && (
              <div className="glass-panel-premium dashboard-card-hover" style={{ borderLeft: '4px solid var(--success)', animation: 'fadeIn 0.3s ease', marginTop: '24px' }}>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)', marginBottom: '10px' }}><i className="fa-solid fa-cash-register"></i> Logs de Procesamiento de Pago (Simulado)</h4>
                <pre style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', color: '#a3e635', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {billingLogs}
                </pre>
              </div>
            )}
          </section>
  );
}
