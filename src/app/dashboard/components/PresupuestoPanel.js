"use client";

import React from 'react';

export default function PresupuestoPanel({ state, activeTab, handlePrintProposal }) {
  return (
    <section id="sec-presupuesto" className={`content-section animate-fade-in-up ${activeTab === 'sec-presupuesto' ? 'active' : ''}`}>
      <div className="section-header">
        <div className="header-title">
          <h1>Presupuesto Formal de Desarrollo</h1>
          <p>Propuesta económica oficial emitida por Innovar Latam para el diseño e implementación del MVP.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handlePrintProposal}><i className="fa-solid fa-print"></i> Imprimir / Exportar a PDF</button>
        </div>
      </div>

      {/* Proposal Stationery Sheet */}
      <div className="formal-proposal-document">
        <div className="document-header">
          <div className="logo-section">
            <div className="corp-logo">
              <div className="corp-logo-box">IL</div>
              Innovar Latam
            </div>
            <span className="corp-tagline">Soluciones Tecnológicas &amp; Arquitectura</span>
          </div>
          <div className="doc-info">
            <h2>Propuesta de Servicios</h2>
            <strong>REF:</strong> PRO-2026-0428<br/>
            <strong>FECHA:</strong> 20 de Junio de 2026<br/>
            <strong>VIGENCIA:</strong> 30 días corridos
          </div>
        </div>

        <div className="doc-recipient">
          <div>
            <div className="doc-recipient-title">Preparado Para:</div>
            <div className="doc-recipient-val">Estudio de Arquitectura Asociado</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>MVP Validación de Negocio</div>
          </div>
          <div>
            <div className="doc-recipient-title">Preparado Por:</div>
            <div className="doc-recipient-val">Ing. Marcelo Guillén</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Director de Tecnología - Innovar Latam</div>
          </div>
        </div>

        <div className="doc-intro">
          <p>
            Presentamos la cotización de servicios profesionales para el desarrollo, despliegue y puesta en marcha del <strong>MVP (Producto Mínimo Viable) de la plataforma de control de obras "ObraSaaS"</strong>, integrando comandos de voz con inteligencia artificial y cronogramas dinámicos.
          </p>
        </div>

        <div className="doc-section-title">Desglose de Costos de Desarrollo (MVP a Producción)</div>
        <table className="budget-table">
          <thead>
            <tr>
              <th>Ítem / Concepto</th>
              <th>Horas Est.</th>
              <th>Precio Unitario (ARS)</th>
              <th>Subtotal (ARS)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Diseño UX/UI, Prototipado &amp; Arquitectura de Obra</strong><br/>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Diseño móvil y web adaptado a condiciones en obra. Diagramación de base de datos relacional.</span>
              </td>
              <td>30</td>
              <td>$22.000 ARS</td>
              <td>$660.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Backend Postgres Serverless (Neon/Prisma ORM) &amp; Geofencing Satelital</strong><br/>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Creación de tablas, migración Prisma, validación de coordenadas por satélite y geocercas del predio.</span>
              </td>
              <td>50</td>
              <td>$23.100 ARS</td>
              <td>$1.155.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Webhooks WhatsApp API, Cloudinary Media Setup &amp; Logs</strong><br/>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Configuración de webhooks en la API oficial de WhatsApp, almacenamiento de imágenes y grabaciones en Cloudinary.</span>
              </td>
              <td>40</td>
              <td>$24.625 ARS</td>
              <td>$985.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Módulo de Inferencia de Voz IA &amp; Speech-to-Task (ObraSaaS Engine)</strong><br/>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Procesamiento de lenguaje natural y transcripción inteligente de reportes de obra. Clasificación automatizada de tareas y bloqueos.</span>
              </td>
              <td>55</td>
              <td>$25.000 ARS</td>
              <td>$1.375.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Despliegue de Producción (Vercel/Cloudflare) &amp; Soporte SLA (30 días)</strong><br/>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Setup de CDN Cloudflare, pipelines automatizados de despliegue en Vercel, pruebas reales y soporte post-lanzamiento.</span>
              </td>
              <td>35</td>
              <td>$23.428,57 ARS</td>
              <td>$820.000 ARS</td>
            </tr>
            <tr className="budget-total-row">
              <td colSpan="3" style={{ textAlign: 'right' }}>Total Cotización MVP Listo para Producción (ARS):</td>
              <td>$4.995.000 ARS</td>
            </tr>
          </tbody>
        </table>

        <div className="doc-section-title">Hitos y Plan de Trabajo (Plazo Acotado: 4 Semanas)</div>
        <div className="milestones-timeline">
          <div className="milestone-item">
            <div className="milestone-badge">Hito 1</div>
            <div className="milestone-desc">
              <h4>Semana 1: Arquitectura y Diseño UX/UI (30% del Pago)</h4>
              <p>Aprobación del prototipo visual de pantallas, wireframes optimizados para obra y diagramación inicial de base de datos relacional.</p>
            </div>
          </div>
          <div className="milestone-item">
            <div className="milestone-badge">Hito 2</div>
            <div className="milestone-desc">
              <h4>Semana 2-3: Backend Cloud &amp; Conectividad de WhatsApp con IA (40% del Pago)</h4>
              <p>Montaje de base de datos Neon con Prisma. Conexión de webhooks de la API de WhatsApp, procesamiento de audio-a-texto e inteligencia artificial para alertas críticas.</p>
            </div>
          </div>
          <div className="milestone-item">
            <div className="milestone-badge">Hito 3</div>
            <div className="milestone-desc">
              <h4>Semana 4: Dashboard Gantt Reactivo, PDF &amp; Despliegue en Producción (30% del Pago)</h4>
              <p>Implementación final del cronograma Gantt dinámico en el Dashboard administrativo, compilación de reportes semanales en PDF, despliegue seguro a producción en Vercel con Cloudflare y capacitación final del equipo.</p>
            </div>
          </div>
        </div>

        <div className="doc-section-title">Evolución y Escalabilidad Futura (SaaS Corporativo)</div>
        <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '24px', lineHeight: '1.6' }}>
          El presente prototipo interactivo (MVP) valida y demuestra en tiempo real la Landing Page con el <strong>Avatar Comercial de Ventas</strong>, el control integrado de <strong>Acopios y Suministros</strong> y la <strong>Generación de Reportes Ejecutivos en PDF</strong>. El ecosistema está arquitectónicamente listo para escalar a un SaaS a través de:
          <br/><br/>
          • <strong>Automatización de Compras &amp; Integración IoT</strong>: Enlace directo del módulo de acopios con balanzas digitales de silos de cemento o tags RFID en corralón de obra, disparando órdenes de compra automáticas vía API de WhatsApp a proveedores homologados cuando el stock alcance niveles críticos.
          <br/>
          • <strong>Trazabilidad Satelital de Suministros (GPS)</strong>: Vinculación del mapa de control con localizadores GPS de transportes y camiones de hormigón para auditar hora de salida, paradas intermedias y tiempo exacto estimado de arribo a obra.
          <br/>
          • <strong>Ecosistema Móvil Novedoso Multirubro</strong>: Desarrollo de aplicaciones nativas Android/iOS con soporte offline robusto (mediante bases de datos embebidas tipo SQLite/WatermelonDB) para registrar fichajes e incidencias en subsuelos o zonas sin cobertura móvil.
        </p>

        <div className="doc-section-title">Condiciones de Servicio (SLA) &amp; Garantías</div>
        <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '24px' }}>
          - <strong>Disponibilidad del Sistema (SLA)</strong>: Compromiso de disponibilidad de la base de datos Postgres del 99.9% mensual.<br/>
          - <strong>Soporte Post-Entrega</strong>: Incluye 30 días de soporte técnico gratuito para corregir posibles bugs y dar capacitación a los operarios en obra.<br/>
          - <strong>Propiedad Intelectual</strong>: El código fuente desarrollado del MVP será de propiedad exclusiva del cliente una vez saldada la totalidad de la propuesta.
        </p>

        <div className="signatures-container">
          <div className="signature-block">
            <div className="signature-seal">Ing. Marcelo Guillén</div>
            <div className="signature-line">
              <span className="signature-title">Ing. Marcelo Guillén</span><br/>
              <span className="signature-meta">Innovar Latam</span>
            </div>
          </div>
          <div className="signature-block">
            <div style={{ height: '40px' }}></div>
            <div className="signature-line">
              <span className="signature-title">Firma de Aceptación</span><br/>
              <span className="signature-meta">Socio / Cliente</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
