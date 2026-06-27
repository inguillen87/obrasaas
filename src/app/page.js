"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [clerkModal, setClerkModal] = useState({ show: false, mode: 'login' });
  const [clerkEmail, setClerkEmail] = useState('');
  const [clerkPassword, setClerkPassword] = useState('');
  const [avatarActive, setAvatarActive] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState('En Línea / Esperando clic');
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadTopic, setLeadTopic] = useState('');

  const audioCtxRef = useRef(null);

  useEffect(() => {
    // Check login state
    const logged = localStorage.getItem('obrasaas_logged_in') === 'true';
    setIsLoggedIn(logged);
  }, []);

  const handleLogout = () => {
    localStorage.setItem('obrasaas_logged_in', 'false');
    setIsLoggedIn(false);
  };

  const playBeep = (type, callback) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'start') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(660, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        setTimeout(callback, 150);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        if (callback) setTimeout(callback, 150);
      }
    } catch(e) {
      if (callback) callback();
    }
  };

  const speakText = (text, callback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find(v => v.lang.startsWith('es-AR') || v.lang.startsWith('es-ES') || v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;
      
      utterance.rate = 0.95;
      utterance.pitch = 1.05; 
      
      utterance.onend = () => { if (callback) callback(); };
      utterance.onerror = () => { if (callback) callback(); };
      
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(callback, 3000);
    }
  };

  const speakAvatarSalesPitch = () => {
    if (avatarActive) return;
    setAvatarActive(true);
    setAvatarStatus('Hablando...');
    
    playBeep('start', () => {
      const pitch = "Hola, soy Sofía, la asistente virtual de ObraSaaS. Nuestra plataforma permite conectar las notas de voz de WhatsApp de tus albañiles con tu cronograma Gantt de manera automática usando inteligencia artificial. Completa el formulario de la derecha para registrarte en el CRM SuperAdmin y probar la demo.";
      speakText(pitch, () => {
        playBeep('end', () => {
          setAvatarActive(false);
          setAvatarStatus('En Línea / Esperando clic');
        });
      });
    });
  };

  const submitLeadForm = async (event) => {
    event.preventDefault();
    try {
      // Fetch current state from DB
      const res = await fetch('/api/state');
      let state = await res.json();
      
      if (!state.crmLeads) state.crmLeads = [];
      
      // Unshift new lead
      state.crmLeads.unshift({
        name: leadName,
        company: leadCompany,
        topic: leadTopic,
        status: "Nuevo Lead"
      });
      
      // Save state to DB
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      
      alert(`¡Excelente! Lead registrado en la base de datos centralizada de ObraSaaS.\nSofía ha enviado los datos de ${leadName} al CRM de la Consola Administrativa.`);
      
      // Clear form
      setLeadName('');
      setLeadCompany('');
      setLeadTopic('');
      
      // Redirect to admin tab in dashboard
      window.location.href = "/dashboard?tab=sec-admin";
    } catch (e) {
      console.error(e);
      alert("Hubo un error registrando el lead. Por favor, intente nuevamente.");
    }
  };

  const simulateClerkAuth = () => {
    setClerkModal({ show: false, mode: 'login' });
    localStorage.setItem('obrasaas_logged_in', 'true');
    setIsLoggedIn(true);
    alert("Autenticación con Clerk completada con éxito. Redirigiendo al Panel de Control...");
    window.location.href = "/dashboard";
  };

  const handleClerkForm = (event) => {
    event.preventDefault();
    simulateClerkAuth();
  };

  return (
    <>
      <div className="landing-container">
        {/* Navigation Header */}
        <header className="landing-nav">
          <Link href="/" className="landing-logo">
            <div className="landing-logo-box">OS</div>
            ObraSaaS
          </Link>
          <div className="nav-actions">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="btn btn-primary btn-sm" style={{ background: '#ff9f1c', color: '#000', fontWeight: 700, textDecoration: 'none', padding: '8px 16px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-chart-line"></i> Ir al Dashboard
                </Link>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  <i className="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setClerkModal({ show: true, mode: 'login' })} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Iniciar Sesión
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setClerkModal({ show: true, mode: 'register' })} style={{ background: '#ff9f1c', color: '#000', fontWeight: 700, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none' }}>
                  Registrarse
                </button>
              </>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge"><i className="fa-solid fa-wand-magic-sparkles"></i> AI Avatar Realtime 2.0</div>
          <h1 className="hero-title">La plataforma de Control de Obra que <span>tu cuadrilla sí usará</span></h1>
          <p className="hero-subtitle">
            Convierte simples notas de voz de WhatsApp en planificación Gantt reactiva y reportes premium. Captura leads comerciales automáticos y lleva el control administrativo total en un solo panel de control.
          </p>
          <div className="hero-ctas" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '30px' }}>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, background: '#ff9f1c', color: '#000', borderRadius: '6px' }}>
              <i className="fa-solid fa-play"></i> Probar Demo del Dashboard
            </Link>
            <button className="btn btn-secondary" onClick={speakAvatarSalesPitch} style={{ padding: '14px 28px', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '6px' }}>
              <i className="fa-solid fa-headphones"></i> Hablar con Sofía AI
            </button>
          </div>

          {/* Dashboard Visual Preview */}
          <div className="dashboard-preview" style={{ margin: '40px auto 20px auto', maxWidth: '900px', background: 'rgba(13, 20, 38, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(10px)' }}>
            {/* Header dots */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', textAlign: 'left' }}>
              {/* Gantt Chart Preview */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                <h5 style={{ marginBottom: '12px', fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
                  <i className="fa-solid fa-chart-gantt" style={{ color: '#ff9f1c', marginRight: '8px' }}></i> Cronograma Gantt Activo
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Task 1 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>
                      <span>Revoque Grueso (Fase 1)</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>100%</span>
                    </div>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#10b981', borderRadius: '6px', boxShadow: '0 0 10px #10b981' }}></div>
                    </div>
                  </div>
                  {/* Task 2 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>
                      <span>Cañería y Descargas (Fase 2)</span>
                      <span style={{ fontWeight: 700, color: '#ff9f1c' }}>80%</span>
                    </div>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: '80%', height: '100%', background: '#ff9f1c', borderRadius: '6px', boxShadow: '0 0 10px rgba(255, 159, 28, 0.4)' }}></div>
                    </div>
                  </div>
                  {/* Task 3 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>
                      <span>Revestimiento Cerámico</span>
                      <span style={{ fontWeight: 700, color: '#475569' }}>En Espera</span>
                    </div>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: '0%', height: '100%', background: '#ff9f1c', borderRadius: '6px' }}></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Real-time Alerts & Map preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Stockpile Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Cemento Loma Negra</span>
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}>Crítico</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Faltan 5 bolsas para stock mínimo</div>
                </div>
                {/* GPS check-in card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Juan Gómez</div>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px' }}>Asistencia verificado por GPS (08:02 AM)</div>
                </div>
              </div>
            </div>
            {/* Glowing mesh background behind the preview */}
            <div style={{ position: 'absolute', right: '-50px', bottom: '-50px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 159, 28, 0.15) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none', zIndex: -1 }}></div>
          </div>
        </section>

        {/* AI Avatar & Leads registration */}
        <section className="avatar-card glass-card" data-aos="fade-up">
          {/* Left: Avatar simulator */}
          <div className="avatar-visual-column">
            <h3 style={{ marginBottom: '16px' }}><i className="fa-solid fa-microphone-lines" style={{ color: '#ff9f1c' }}></i> AI Avatar 2.0: Sofía</h3>
            
            <div className={`avatar-circle ${avatarActive ? 'active' : ''}`} onClick={speakAvatarSalesPitch}>
              <div className="avatar-pulse-ring"></div>
              <div className="avatar-img"></div>
            </div>
            
            <div className="avatar-status-badge">
              <i className="fa-solid fa-circle" style={{ color: avatarActive ? '#3b82f6' : '#10b981', fontSize: '0.5rem', marginRight: '4px' }}></i> {avatarStatus}
            </div>

            {/* pulsating wave visualizer */}
            {avatarActive && (
              <div className="voice-wave-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', height: '36px', marginTop: '20px' }}>
                <div className="voice-bar bar-1"></div>
                <div className="voice-bar bar-2"></div>
                <div className="voice-bar bar-3"></div>
                <div className="voice-bar bar-4"></div>
                <div className="voice-bar bar-5"></div>
              </div>
            )}
            
            <p className="avatar-subtext">
              Haz clic en el avatar o el botón de arriba para escuchar a Sofía AI describir el producto.
            </p>
          </div>

          {/* Right: Contact form (Leads integration) */}
          <div className="lead-form-card">
            <h3 style={{ marginBottom: '8px', color: '#ff9f1c' }}><i className="fa-solid fa-paper-plane"></i> Regístrate y Solicita una Demo</h3>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '20px' }}>
              Cualquier lead que cargues aquí se insertará de manera reactiva en el CRM de la consola del SuperAdmin.
            </p>
            
            <form onSubmit={submitLeadForm}>
              <div className="form-group">
                <label>Nombre y Apellido</label>
                <input type="text" className="form-control" placeholder="Ej. Arq. Carolina Gómez" value={leadName} onChange={(e) => setLeadName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Empresa / Estudio</label>
                <input type="text" className="form-control" placeholder="Ej. Estudio Gómez &amp; Asociados" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Asunto de Interés / Proyecto</label>
                <input type="text" className="form-control" placeholder="Ej. Cotización para 3 obras en Nordelta" value={leadTopic} onChange={(e) => setLeadTopic(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700, background: '#ff9f1c', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                <i className="fa-solid fa-envelope-open-text"></i> Enviar a CRM SuperAdmin
              </button>
            </form>
          </div>
        </section>

        {/* Feature box description */}
        <section style={{ marginTop: '80px' }} data-aos="fade-up">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '12px' }}>Soluciones Robustas de ObraSaaS</h2>
          <p style={{ textAlign: 'center', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px auto', fontSize: '0.9rem' }}>
            Por qué los arquitectos y constructoras en Argentina eligen el ecosistema modular de ObraSaaS.
          </p>
          
          <div className="features-grid">
            <div className="feature-box">
              <div className="feature-icon"><i class="fa-solid fa-volume-high"></i></div>
              <h4>Comandos de Voz a Tareas</h4>
              <p>
                Los operarios envían simples mensajes de voz en WhatsApp. Nuestro motor local de voz interpreta el audio, actualiza el progreso en el Gantt y registra desvíos automáticamente.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i class="fa-solid fa-map-location-dot"></i></div>
              <h4>Geocercas Satelitales</h4>
              <p>
                Validación biométrica e identidad por número de celular único. Marcación de asistencia satelital verificada contra los límites geográficos físicos de la obra en tiempo real.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i class="fa-solid fa-building-columns"></i></div>
              <h4>SuperAdmin CRM Console</h4>
              <p>
                Monitoreo comercial y financiero de licencias activas en Argentina. Administración simplificada de tickets de soporte técnico, facturación y leads del sitio web.
              </p>
            </div>
          </div>
        </section>

        {/* Comparative Matrix Section */}
        <section style={{ marginTop: '80px' }} data-aos="fade-up">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '12px' }}>Comparación vs Métodos Tradicionales</h2>
          <p style={{ textAlign: 'center', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px auto', fontSize: '0.9rem' }}>
            Por qué ObraSaaS es el copiloto indispensable de las constructoras modernas.
          </p>
          <div style={{ background: 'rgba(13, 20, 38, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', color: '#fff' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Características</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ff9f1c' }}>ObraSaaS AI</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#64748b' }}>Planillas Excel / WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Actualización de Gantt</td>
                  <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}><i className="fa-solid fa-circle-check"></i> En segundos vía audios de voz</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444' }}><i className="fa-solid fa-circle-xmark"></i> Manual, lenta y fuera de tiempo</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Control de Asistencia</td>
                  <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}><i className="fa-solid fa-circle-check"></i> Geocercas satelitales automáticas</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444' }}><i className="fa-solid fa-circle-xmark"></i> Mensajes por chat sin verificación</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Alertas logísticas y acopios</td>
                  <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}><i className="fa-solid fa-circle-check"></i> Semáforos dinámicos automáticos</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444' }}><i className="fa-solid fa-circle-xmark"></i> Falta de control preventivo de insumos</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Reporte Ejecutivo PDF</td>
                  <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}><i className="fa-solid fa-circle-check"></i> 1-Clic membretado con Resumen IA</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444' }}><i className="fa-solid fa-circle-xmark"></i> Horas de redacción manual e informes tediosos</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SLA, future growth */}
        <section className="glass-card" style={{ margin: '80px 0', borderLeft: '4px solid #ff9f1c' }} data-aos="fade-up">
          <h3 style={{ color: '#ff9f1c', marginBottom: '16px' }}><i className="fa-solid fa-rocket"></i> Plan de Crecimiento &amp; Expansión de Negocio</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '16px' }}>
            La arquitectura técnica de la plataforma está pensada para escalar a través de módulos complementarios de alto valor:
          </p>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block', marginBottom: '8px' }}><i className="fa-solid fa-truck-moving" style={{ color: '#ff9f1c', marginRight: '6px' }}></i> Compra de Materiales y Acopios</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Módulo integrado para solicitar cotizaciones a corralones locales, coordinar la entrega de camiones de hormigón en obra y llevar la trazabilidad del acopio consumido contra presupuesto.
              </span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block', marginBottom: '8px' }}><i className="fa-solid fa-mobile-screen-button" style={{ color: '#60a5fa', marginRight: '6px' }}></i> Multi-plataforma Nativa</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Expansión hacia aplicativos nativos livianos para los operarios de campo (Android/iOS) con soporte offline en subsuelos y carga automatizada de fotos de avance a Cloudinary.
              </span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block', marginBottom: '8px' }}><i className="fa-solid fa-universal-access" style={{ color: '#34d399', marginRight: '6px' }}></i> Portal del Cliente Final</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Tablero privado con diseño premium simplificado para el dueño de la casa, permitiéndole ver curvas de avance, bitácoras firmadas por el arquitecto y estado del desembolso de fondos.
              </span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <span>© 2026 ObraSaaS por Innovar Latam. Todos los derechos reservados.</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/presupuesto" style={{ color: '#64748b', textDecoration: 'none' }}>Propuesta Económica</Link>
            <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none' }}>Dashboard Obra</Link>
          </div>
        </footer>
      </div>

      {/* Clerk Modal Simulation */}
      {clerkModal.show && (
        <div className="clerk-modal-overlay">
          <div className="clerk-card">
            <div style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer', color: '#64748b' }} onClick={() => setClerkModal({ show: false, mode: 'login' })}>
              <i className="fa-solid fa-xmark" style={{ fontSize: '1.2rem' }}></i>
            </div>
            
            <div className="clerk-header">
              <div className="clerk-badge">Seguridad por Clerk.com</div>
              <h3>{clerkModal.mode === 'login' ? 'Iniciar Sesión en ObraSaaS' : 'Crear Cuenta en ObraSaaS'}</h3>
              <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {clerkModal.mode === 'login' ? 'Accede a tus paneles de control de obra georreferenciados.' : 'Regístrate de forma segura con Clerk para auditar tus obras.'}
              </p>
            </div>

            {/* Social logins */}
            <button className="clerk-social-btn" onClick={simulateClerkAuth}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="16" alt="Google" />
              <span>Continuar con Google</span>
            </button>
            <button className="clerk-social-btn" onClick={simulateClerkAuth}>
              <i className="fa-brands fa-github" style={{ fontSize: '1.1rem' }}></i>
              <span>Continuar con GitHub</span>
            </button>

            <div className="clerk-divider">o mediante correo electrónico</div>

            {/* Custom Form inputs */}
            <form onSubmit={handleClerkForm}>
              <div className="form-group">
                <label style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Dirección de Correo Electrónico</label>
                <input type="email" className="form-control" placeholder="arquitecto@estudio.com" value={clerkEmail} onChange={(e) => setClerkEmail(e.target.value)} required style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', color: '#fff', width: '100%', marginBottom: '16px' }} />
              </div>
              <div className="form-group">
                <label style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Contraseña</label>
                <input type="password" className="form-control" placeholder="••••••••" value={clerkPassword} onChange={(e) => setClerkPassword(e.target.value)} required style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', color: '#fff', width: '100%', marginBottom: '16px' }} />
              </div>
              <button type="submit" className="clerk-btn" style={{ background: '#ff9f1c', border: 'none', color: '#000', padding: '12px', fontWeight: 700, borderRadius: '10px', width: '100%', cursor: 'pointer' }}>
                {clerkModal.mode === 'login' ? 'Ingresar' : 'Crear Cuenta'}
              </button>
            </form>

            <div className="clerk-switch" style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: '20px' }}>
              {clerkModal.mode === 'login' ? (
                <>¿No tienes una cuenta? <span onClick={() => setClerkModal({ show: true, mode: 'register' })} style={{ color: '#ff9f1c', cursor: 'pointer', fontWeight: 600 }}>Regístrate</span></>
              ) : (
                <>¿Ya tienes cuenta? <span onClick={() => setClerkModal({ show: true, mode: 'login' })} style={{ color: '#ff9f1c', cursor: 'pointer', fontWeight: 600 }}>Inicia Sesión</span></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Load Animation Scripts */}
      <Script src="https://unpkg.com/aos@2.3.1/dist/aos.js" strategy="afterInteractive" onLoad={() => {
        if (window.AOS) {
          window.AOS.init({ duration: 800, once: true });
        }
      }} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" strategy="afterInteractive" onLoad={() => {
        if (window.gsap) {
          window.gsap.from(".landing-logo", { y: -20, opacity: 0, duration: 0.8, ease: "power2.out" });
          window.gsap.from(".nav-actions > *", { y: -20, opacity: 0, duration: 0.8, stagger: 0.15, ease: "power2.out" });
          window.gsap.from(".hero-badge", { scale: 0.8, opacity: 0, duration: 1, ease: "back.out(1.7)" });
          window.gsap.from(".hero-title", { y: 30, opacity: 0, duration: 1, delay: 0.2, ease: "power3.out" });
          window.gsap.from(".hero-subtitle", { y: 20, opacity: 0, duration: 1, delay: 0.4, ease: "power3.out" });
          window.gsap.from(".hero-ctas > *", { y: 20, opacity: 0, duration: 1, delay: 0.6, stagger: 0.15, ease: "power3.out" });
          window.gsap.from(".dashboard-preview", { y: 50, opacity: 0, duration: 1.2, delay: 0.8, ease: "power2.out" });
        }
      }} />
    </>
  );
}
