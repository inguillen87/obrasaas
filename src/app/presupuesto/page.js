"use client";

import Link from 'next/link';

export default function Presupuesto() {
  return (
    <>
      <style jsx global>{`
        :root {
            --primary: #ff9f1c;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --border-color: #e2e8f0;
        }
        
        body {
            background-color: #f1f5f9;
            color: var(--text-primary);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            padding: 40px 20px;
        }

        .controls-container {
            max-width: 900px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #fff;
            padding: 15px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            border: 1px solid var(--border-color);
        }

        .back-link {
            text-decoration: none;
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: color 0.2s;
        }

        .back-link:hover {
            color: var(--primary);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
        }

        .btn:hover {
            background: #e58f16;
            transform: translateY(-1px);
        }

        .formal-proposal-document {
            background: #ffffff;
            border-radius: 12px;
            padding: 50px 60px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            border: 1px solid var(--border-color);
        }

        .formal-proposal-document::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8px;
            background: linear-gradient(90deg, #ff9f1c, #e76f51);
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
        }

        .document-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 30px;
            margin-bottom: 30px;
        }

        .logo-section {
            display: flex;
            flex-direction: column;
        }

        .corp-logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Outfit', sans-serif;
            font-weight: 800;
            font-size: 1.5rem;
            color: #ff9f1c;
            margin-bottom: 4px;
        }

        .corp-logo-box {
            width: 32px;
            height: 32px;
            background: #ff9f1c;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
        }

        .corp-tagline {
            font-size: 0.75rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }

        .doc-info {
            text-align: right;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        .doc-info h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.6rem;
            color: #0f172a;
            font-weight: 700;
            margin-bottom: 6px;
            text-transform: uppercase;
        }

        .doc-recipient {
            margin-bottom: 30px;
            font-size: 0.9rem;
            background: #f8fafc;
            padding: 16px 20px;
            border-radius: 8px;
            border-left: 4px solid #ff9f1c;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .doc-recipient-title {
            font-size: 0.75rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .doc-recipient-val {
            font-weight: 600;
            color: #0f172a;
        }

        .doc-intro {
            font-size: 0.95rem;
            color: #334155;
            margin-bottom: 30px;
        }

        .doc-section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.15rem;
            color: #0f172a;
            font-weight: 700;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 8px;
            margin-top: 40px;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .budget-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 0.85rem;
        }

        .budget-table th {
            background: #f1f5f9;
            color: #334155;
            padding: 12px;
            text-align: left;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
        }

        .budget-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
        }

        .budget-table tr:last-child td {
            border-bottom: none;
        }

        .budget-total-row {
            font-weight: 700;
            font-size: 1rem;
            background: #f8fafc;
        }

        .budget-total-row td {
            border-top: 2px solid #94a3b8;
            color: #0f172a !important;
        }

        .milestones-timeline {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 30px;
        }

        .milestone-item {
            display: flex;
            gap: 20px;
        }

        .milestone-badge {
            width: 70px;
            font-weight: 700;
            font-size: 0.75rem;
            color: #ff9f1c;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 4px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .milestone-desc h4 {
            font-size: 0.95rem;
            color: #0f172a;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .milestone-desc p {
            font-size: 0.85rem;
            color: #64748b;
        }

        .signatures-container {
            display: flex;
            justify-content: space-between;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 1px solid #cbd5e1;
        }

        .signature-block {
            width: 250px;
            text-align: center;
        }

        .signature-line {
            border-top: 1px solid #94a3b8;
            margin-top: 40px;
            padding-top: 8px;
            font-size: 0.8rem;
            color: #64748b;
        }

        .signature-title {
            font-weight: 700;
            color: #0f172a;
            font-size: 0.85rem;
        }

        .signature-meta {
            font-size: 0.75rem;
            color: #94a3b8;
        }

        .signature-seal {
            font-size: 1.4rem;
            color: #0f172a;
            margin-bottom: -15px;
            font-style: italic;
            opacity: 0.8;
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            .controls-container {
                flex-direction: column;
                gap: 12px;
                padding: 12px;
                text-align: center;
            }
            .controls-container .btn {
                width: 100%;
                justify-content: center;
            }
            .formal-proposal-document {
                padding: 24px 16px;
            }
            .document-header {
                flex-direction: column;
                gap: 20px;
                align-items: flex-start;
            }
            .doc-info {
                text-align: left;
            }
            .doc-recipient {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            .signatures-container {
                flex-direction: column;
                gap: 30px;
                margin-top: 30px;
                align-items: center;
            }
            .signature-block {
                width: 100%;
            }
        }

        @media print {
            body {
                background: #fff !important;
                padding: 0 !important;
            }
            .controls-container {
                display: none !important;
            }
            .formal-proposal-document {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                max-width: 100% !important;
            }
            .formal-proposal-document::before {
                display: none !important;
            }
            .doc-recipient {
                background: #f8fafc !important;
                border-left: 4px solid #ff9f1c !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
      `}</style>

      {/* Top Navigation and Print Controls */}
      <div className="controls-container">
        <Link href="/dashboard" className="back-link">
          <i className="fa-solid fa-arrow-left"></i> Volver al MVP Interactivo (Dashboard)
        </Link>
        <button className="btn" onClick={() => window.print()}>
          <i className="fa-solid fa-file-pdf"></i> Imprimir / Guardar como PDF
        </button>
      </div>

      {/* The Formal Stationery Sheet */}
      <div className="formal-proposal-document">
        <div className="document-header">
          <div className="logo-section">
            <div className="corp-logo">
              <div className="corp-logo-box">IL</div>
              ObraSaaS / Innovar Latam
            </div>
            <span className="corp-tagline">Soluciones Tecnológicas &amp; Arquitectura</span>
          </div>
          <div className="doc-info">
            <h2>Propuesta de Servicios</h2>
            <strong>REF:</strong> PRO-2026-0428<br />
            <strong>FECHA:</strong> 20 de Junio de 2026<br />
            <strong>VIGENCIA:</strong> 30 días corridos
          </div>
        </div>

        {/* Client info block */}
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

        {/* Introduction */}
        <div className="doc-intro">
          <p>
            Presentamos la cotización de servicios profesionales para el desarrollo, despliegue y puesta en marcha del <strong>MVP (Producto Mínimo Viable) de la plataforma de control de obras &quot;ObraSaaS&quot;</strong>, integrando comandos de voz con inteligencia artificial y cronogramas dinámicos.
          </p>
        </div>

        {/* Table of Costs */}
        <div className="doc-section-title">Desglose de Costos de Desarrollo (MVP)</div>
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
                <strong>Diseño UX/UI, Prototipado &amp; Arquitectura de Obra</strong><br />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Diseño móvil y web adaptado a condiciones en obra. Diagramación de base de datos relacional.</span>
              </td>
              <td>30</td>
              <td>$22.000 ARS</td>
              <td>$660.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Backend Postgres Serverless (Neon/Prisma ORM) &amp; Geofencing Satelital</strong><br />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Creación de tablas, migración Prisma, validación de coordenadas por satélite y geocercas del predio.</span>
              </td>
              <td>50</td>
              <td>$23.100 ARS</td>
              <td>$1.155.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Webhooks WhatsApp API, Cloudinary Media Setup &amp; Logs</strong><br />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Configuración de webhooks en la API oficial de WhatsApp, almacenamiento de imágenes y grabaciones en Cloudinary.</span>
              </td>
              <td>40</td>
              <td>$24.625 ARS</td>
              <td>$985.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Módulo de Inferencia de Voz IA &amp; Speech-to-Task (ObraSaaS Engine)</strong><br />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Procesamiento de lenguaje natural y transcripción inteligente de reportes de obra. Clasificación automatizada de tareas y bloqueos.</span>
              </td>
              <td>55</td>
              <td>$25.000 ARS</td>
              <td>$1.375.000 ARS</td>
            </tr>
            <tr>
              <td>
                <strong>Despliegue de Producción (Vercel/Cloudflare) &amp; Soporte SLA (30 días)</strong><br />
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

        {/* Hitos / Deliverables */}
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

        {/* SaaS Evolution & Future Growth */}
        <div className="doc-section-title">Evolución y Escalabilidad Futura (SaaS Corporativo)</div>
        <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '24px', lineHeight: '1.6' }}>
          El presente prototipo interactivo (MVP) valida y demuestra en tiempo real la Landing Page con el <strong>Avatar Comercial de Ventas</strong>, el control integrado de <strong>Acopios y Suministros</strong> y la <strong>Generación de Reportes Ejecutivos en PDF</strong>. El ecosistema está arquitectónicamente listo para escalar a un SaaS a través de:
          <br /><br />
          • <strong>Automatización de Compras &amp; Integración IoT</strong>: Enlace directo del módulo de acopios con balanzas digitales de silos de cemento o tags RFID en corralón de obra, disparando órdenes de compra automáticas vía API de WhatsApp a proveedores homologados cuando el stock alcance niveles críticos.
          <br />
          • <strong>Trazabilidad Satelital de Suministros (GPS)</strong>: Vinculación del mapa de control con localizadores GPS de transportes y camiones de hormigón para auditar hora de salida, paradas intermedias y tiempo exacto estimado de arribo a obra.
          <br />
          • <strong>Ecosistema Móvil Nativo Multirubro</strong>: Desarrollo de aplicaciones nativas Android/iOS con soporte offline robusto (mediante bases de datos embebidas tipo SQLite/WatermelonDB) para registrar fichajes e incidencias en subsuelos o zonas sin cobertura móvil.
        </p>

        {/* SLA and Terms */}
        <div className="doc-section-title">Condiciones de Servicio (SLA) &amp; Garantías</div>
        <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '24px' }}>
          - <strong>Disponibilidad del Sistema (SLA)</strong>: Compromiso de disponibilidad de la base de datos Supabase del 99.9% mensual.<br />
          - <strong>Soporte Post-Entrega</strong>: Incluye 30 días de soporte técnico gratuito para corregir posibles bugs y dar capacitación a los operarios en obra.<br />
          - <strong>Propiedad Intelectual</strong>: El código fuente desarrollado del MVP será de propiedad exclusiva del cliente una vez saldada la totalidad de la propuesta.
        </p>

        {/* Signatures */}
        <div className="signatures-container">
          <div className="signature-block">
            <div className="signature-seal">Ing. Marcelo Guillén</div>
            <div className="signature-line">
              <span className="signature-title">Ing. Marcelo Guillén</span><br />
              <span className="signature-meta">Innovar Latam</span>
            </div>
          </div>
          <div className="signature-block">
            <div style={{ height: '40px' }}></div>
            <div className="signature-line">
              <span className="signature-title">Firma de Aceptación</span><br />
              <span className="signature-meta">Socio / Cliente</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
