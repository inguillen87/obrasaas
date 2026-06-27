"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [faqActive, setFaqActive] = useState(null);
  const [clerkModal, setClerkModal] = useState({ show: false, mode: 'login' });
  const [clerkEmail, setClerkEmail] = useState('');
  const [clerkPassword, setClerkPassword] = useState('');
  const [avatarActive, setAvatarActive] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState('En Línea / Esperando clic');
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadTopic, setLeadTopic] = useState('');

  const [currentDemoStep, setCurrentDemoStep] = useState(0); // 0: init, 1: step1, 2: step2, 3: step3
  const [userInteracted, setUserInteracted] = useState(false);
  const autoPlayTimerRef = useRef(null);

  const [demoTaskProgress, setDemoTaskProgress] = useState(80);
  const [demoCementStock, setDemoCementStock] = useState(35);
  const [demoCementStatus, setDemoCementStatus] = useState('Crítico');
  const [demoCementColor, setDemoCementColor] = useState('#ef4444');
  const [demoWorkerStatus, setDemoWorkerStatus] = useState('Asistencia verificado por GPS (08:02 AM)');
  const [demoMessages, setDemoMessages] = useState([
    { sender: 'Carlos Pérez', text: '🎙️ Carlos: Terminando empalmes de agua caliente.', time: '08:15 AM' },
    { sender: 'IA ObraSaaS', text: '🤖 Entendido. Se actualizó la tarea Cañerías al 80% en el Gantt.', time: '08:16 AM' }
  ]);

  const stopAutoPlay = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setUserInteracted(true);
  };

  const runDemoStep1 = () => {
    setDemoTaskProgress(100);
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages(prev => [
      ...prev,
      { sender: 'Carlos Pérez', text: '🎙️ Carlos: Instalación de cañerías 100% terminada y probada.', time },
      { sender: 'IA ObraSaaS', text: '🤖 Excelente. Hito de Cañerías completado al 100% en el Gantt.', time }
    ]);
  };

  const runDemoStep2 = () => {
    setDemoCementStock(135);
    setDemoCementStatus('Orden Enviada');
    setDemoCementColor('#f59e0b');
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages(prev => [
      ...prev,
      { sender: 'IA ObraSaaS', text: '⚠️ Stock de Cemento Loma Negra bajo mínimo (35 bolsas). Enviando compra automática.', time },
      { sender: 'Corralón Loma Negra', text: '📞 Loma Negra: Recibida orden #OC-2026-901 por 100 bolsas. En viaje.', time }
    ]);
  };

  const runDemoStep3 = () => {
    setDemoWorkerStatus('Presente (GPS) - Palermo Site (08:35 AM)');
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages(prev => [
      ...prev,
      { sender: 'Juan Gómez', text: '📍 Compartiendo ubicación GPS desde la entrada.', time },
      { sender: 'IA ObraSaaS', text: '🤖 Ingreso validado. Juan Gómez dentro del predio de la obra.', time }
    ]);
  };

  const resetDemo = () => {
    setDemoTaskProgress(80);
    setDemoCementStock(35);
    setDemoCementStatus('Crítico');
    setDemoCementColor('#ef4444');
    setDemoWorkerStatus('Asistencia verificado por GPS (08:02 AM)');
    setDemoMessages([
      { sender: 'Carlos Pérez', text: '🎙️ Carlos: Terminando empalmes de agua caliente.', time: '08:15 AM' },
      { sender: 'IA ObraSaaS', text: '🤖 Entendido. Se actualizó la tarea Cañerías al 80% en el Gantt.', time: '08:16 AM' }
    ]);
  };

  const handleManualStep1 = () => {
    stopAutoPlay();
    setCurrentDemoStep(1);
    setDemoTaskProgress(100);
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages([
      { sender: 'Carlos Pérez', text: '🎙️ Carlos: Terminando empalmes de agua caliente.', time: '08:15 AM' },
      { sender: 'IA ObraSaaS', text: '🤖 Entendido. Se actualizó la tarea Cañerías al 80% en el Gantt.', time: '08:16 AM' },
      { sender: 'Carlos Pérez', text: '🎙️ Carlos: Instalación de cañerías 100% terminada y probada.', time },
      { sender: 'IA ObraSaaS', text: '🤖 Excelente. Hito de Cañerías completado al 100% en el Gantt.', time }
    ]);
  };

  const handleManualStep2 = () => {
    stopAutoPlay();
    setCurrentDemoStep(2);
    setDemoTaskProgress(100);
    setDemoCementStock(135);
    setDemoCementStatus('Orden Enviada');
    setDemoCementColor('#f59e0b');
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages([
      { sender: 'Carlos Pérez', text: '🎙️ Carlos: Terminando empalmes de agua caliente.', time: '08:15 AM' },
      { sender: 'IA ObraSaaS', text: '🤖 Entendido. Se actualizó la tarea Cañerías al 80% en el Gantt.', time: '08:16 AM' },
      { sender: 'IA ObraSaaS', text: '⚠️ Stock de Cemento Loma Negra bajo mínimo (35 bolsas). Enviando compra automática.', time },
      { sender: 'Corralón Loma Negra', text: '📞 Loma Negra: Recibida orden #OC-2026-901 por 100 bolsas. En viaje.', time }
    ]);
  };

  const handleManualStep3 = () => {
    stopAutoPlay();
    setCurrentDemoStep(3);
    setDemoWorkerStatus('Presente (GPS) - Palermo Site (08:35 AM)');
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    setDemoMessages([
      { sender: 'Carlos Pérez', text: '🎙️ Carlos: Terminando empalmes de agua caliente.', time: '08:15 AM' },
      { sender: 'IA ObraSaaS', text: '🤖 Entendido. Se actualizó la tarea Cañerías al 80% en el Gantt.', time: '08:16 AM' },
      { sender: 'Juan Gómez', text: '📍 Compartiendo ubicación GPS desde la entrada.', time },
      { sender: 'IA ObraSaaS', text: '🤖 Ingreso validado. Juan Gómez dentro del predio de la obra.', time }
    ]);
  };

  const handleManualReset = () => {
    stopAutoPlay();
    setCurrentDemoStep(0);
    resetDemo();
  };

  useEffect(() => {
    if (userInteracted) return;

    let step = 0;
    autoPlayTimerRef.current = setInterval(() => {
      step = (step + 1) % 4;
      setCurrentDemoStep(step);
      if (step === 0) {
        setDemoTaskProgress(80);
        setDemoCementStock(35);
        setDemoCementStatus('Crítico');
        setDemoCementColor('#ef4444');
        setDemoWorkerStatus('Asistencia verificado por GPS (08:02 AM)');
        setDemoMessages([
          { sender: 'Carlos Pérez', text: '🎙️ Carlos: Terminando empalmes de agua caliente.', time: '08:15 AM' },
          { sender: 'IA ObraSaaS', text: '🤖 Entendido. Se actualizó la tarea Cañerías al 80% en el Gantt.', time: '08:16 AM' }
        ]);
      } else if (step === 1) {
        setDemoTaskProgress(100);
        const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        setDemoMessages(prev => [
          ...prev,
          { sender: 'Carlos Pérez', text: '🎙️ Carlos: Instalación de cañerías 100% terminada y probada.', time },
          { sender: 'IA ObraSaaS', text: '🤖 Excelente. Hito de Cañerías completado al 100% en el Gantt.', time }
        ]);
      } else if (step === 2) {
        setDemoCementStock(135);
        setDemoCementStatus('Orden Enviada');
        setDemoCementColor('#f59e0b');
        const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        setDemoMessages(prev => [
          ...prev,
          { sender: 'IA ObraSaaS', text: '⚠️ Stock de Cemento Loma Negra bajo mínimo (35 bolsas). Enviando compra automática.', time },
          { sender: 'Corralón Loma Negra', text: '📞 Loma Negra: Recibida orden #OC-2026-901 por 100 bolsas. En viaje.', time }
        ]);
      } else if (step === 3) {
        setDemoWorkerStatus('Presente (GPS) - Palermo Site (08:35 AM)');
        const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        setDemoMessages(prev => [
          ...prev,
          { sender: 'Juan Gómez', text: '📍 Compartiendo ubicación GPS desde la entrada.', time },
          { sender: 'IA ObraSaaS', text: '🤖 Ingreso validado. Juan Gómez dentro del predio de la obra.', time }
        ]);
      }
    }, 4500);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [userInteracted]);

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
          
          <nav className="desktop-menu">
            <a href="#que-hacemos">¿Qué Hacemos?</a>
            <a href="#quienes-somos">¿Quiénes Somos?</a>
            <a href="#tecnologias">Tecnologías</a>
            <a href="#faqs">Preguntas Frecuentes</a>
          </nav>

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

          {/* Interactive Live Demo Simulator */}
          <div className="dashboard-preview" style={{ margin: '40px auto 20px auto', maxWidth: '950px', background: 'rgba(13, 20, 38, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '28px', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(16px)' }}>
            
            {/* Header dots */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '20px', background: userInteracted ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.12)', color: userInteracted ? '#94a3b8' : '#10b981', fontWeight: 700, border: userInteracted ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className={`status-dot ${userInteracted ? '' : 'pulse-active'}`} style={{ width: '6px', height: '6px', borderRadius: '50%', background: userInteracted ? '#94a3b8' : '#10b981' }}></span>
                  {userInteracted ? 'Modo Manual' : 'Reproducción Automática'}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <i className="fa-solid fa-circle-play" style={{ marginRight: '6px' }}></i> Simulador de WhatsApp &amp; Gantt
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', textAlign: 'left', minHeight: '340px' }} className="home-preview-grid">
              
              {/* Left Column: Reactive Dashboard Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Gantt Chart Preview */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '18px' }}>
                  <h5 style={{ marginBottom: '16px', fontWeight: 700, color: '#fff', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <i className="fa-solid fa-chart-gantt" style={{ color: '#ff9f1c', marginRight: '8px' }}></i> Estado del Cronograma (Gantt)
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Task 1 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                        <span>Revoque Grueso (Fase 1)</span>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>100%</span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100%', background: '#10b981', borderRadius: '5px', boxShadow: '0 0 10px #10b981' }}></div>
                      </div>
                    </div>
                    {/* Task 2 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                        <span>Cañerías y Descargas (Fase 2)</span>
                        <span style={{ fontWeight: 700, color: demoTaskProgress === 100 ? '#10b981' : '#ff9f1c', transition: 'color 0.5s' }}>{demoTaskProgress}%</span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${demoTaskProgress}%`, height: '100%', background: demoTaskProgress === 100 ? '#10b981' : '#ff9f1c', borderRadius: '5px', boxShadow: `0 0 10px ${demoTaskProgress === 100 ? '#10b981' : 'rgba(255, 159, 28, 0.4)'}`, transition: 'width 0.6s ease-in-out, background 0.6s' }}></div>
                      </div>
                    </div>
                    {/* Task 3 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '6px' }}>
                        <span>Revestimientos y Cerámicos</span>
                        <span style={{ fontWeight: 700 }}>En Espera</span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: '0%', height: '100%', background: '#ff9f1c', borderRadius: '5px' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Stockpile Card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Cemento</span>
                      <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: '6px', background: demoCementStatus === 'Crítico' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: demoCementColor, fontWeight: 700, transition: 'color 0.5s' }}>
                        {demoCementStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '4px', transition: 'color 0.5s' }}>{demoCementStock} Bolsas</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      {demoCementStatus === 'Crítico' ? 'Faltan 5 bolsas para stock' : 'Suministro reabastecido'}
                    </div>
                  </div>

                  {/* GPS Card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Control Satelital</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', lineHeight: '1.4' }}>{demoWorkerStatus}</div>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '4px' }}>Geocerca: Palermo Site</div>
                  </div>
                </div>
              </div>

              {/* Right Column: WhatsApp Live Chat Simulation */}
              <div style={{ background: 'rgba(10, 15, 30, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Chat header */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 800 }}>🤖</div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Copiloto ObraSaaS</div>
                    <div style={{ fontSize: '0.6rem', color: '#10b981' }}><i className="fa-solid fa-circle" style={{ fontSize: '0.4rem', marginRight: '4px' }}></i> En línea</div>
                  </div>
                </div>
                {/* Chat body messages list */}
                <div style={{ flexGrow: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '210px', fontSize: '0.7rem' }}>
                  {demoMessages.map((msg, idx) => {
                    const isBot = msg.sender === 'IA ObraSaaS';
                    const isSupplier = msg.sender.includes('Loma Negra');
                    const bg = isBot ? 'rgba(59, 130, 246, 0.12)' : isSupplier ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.04)';
                    const border = isBot ? '1px solid rgba(59, 130, 246, 0.2)' : isSupplier ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(255,255,255,0.06)';
                    const color = isBot ? '#60a5fa' : isSupplier ? '#f59e0b' : '#ff9f1c';
                    return (
                      <div key={idx} style={{ background: bg, border, padding: '10px 12px', borderRadius: '10px', alignSelf: isBot ? 'flex-start' : 'flex-end', maxWidth: '90%', transition: 'all 0.3s' }}>
                        <div style={{ fontWeight: 700, color: color, marginBottom: '2px' }}>{msg.sender}</div>
                        <div style={{ color: '#cbd5e1' }}>{msg.text}</div>
                        <div style={{ fontSize: '0.55rem', color: '#475569', textAlign: 'right', marginTop: '4px' }}>{msg.time}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom Actions grid with highlight active states */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              
              <button 
                onClick={handleManualStep1} 
                style={{ 
                  padding: '10px', 
                  background: currentDemoStep === 1 ? 'rgba(255, 159, 28, 0.18)' : 'rgba(255, 159, 28, 0.06)', 
                  border: currentDemoStep === 1 ? '1px solid #ff9f1c' : '1px solid rgba(255, 159, 28, 0.2)', 
                  boxShadow: currentDemoStep === 1 ? '0 0 12px rgba(255, 159, 28, 0.4)' : 'none',
                  borderRadius: '8px', 
                  color: currentDemoStep === 1 ? '#fff' : '#ff9f1c', 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px', 
                  transition: 'all 0.4s' 
                }}
              >
                <i className="fa-solid fa-microphone"></i> 1. Reporte de Avance
              </button>

              <button 
                onClick={handleManualStep2} 
                style={{ 
                  padding: '10px', 
                  background: currentDemoStep === 2 ? 'rgba(255, 159, 28, 0.18)' : 'rgba(255, 159, 28, 0.06)', 
                  border: currentDemoStep === 2 ? '1px solid #ff9f1c' : '1px solid rgba(255, 159, 28, 0.2)', 
                  boxShadow: currentDemoStep === 2 ? '0 0 12px rgba(255, 159, 28, 0.4)' : 'none',
                  borderRadius: '8px', 
                  color: currentDemoStep === 2 ? '#fff' : '#ff9f1c', 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px', 
                  transition: 'all 0.4s' 
                }}
              >
                <i className="fa-solid fa-cart-flatbed-suitcases"></i> 2. Compra de Cemento
              </button>

              <button 
                onClick={handleManualStep3} 
                style={{ 
                  padding: '10px', 
                  background: currentDemoStep === 3 ? 'rgba(255, 159, 28, 0.18)' : 'rgba(255, 159, 28, 0.06)', 
                  border: currentDemoStep === 3 ? '1px solid #ff9f1c' : '1px solid rgba(255, 159, 28, 0.2)', 
                  boxShadow: currentDemoStep === 3 ? '0 0 12px rgba(255, 159, 28, 0.4)' : 'none',
                  borderRadius: '8px', 
                  color: currentDemoStep === 3 ? '#fff' : '#ff9f1c', 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px', 
                  transition: 'all 0.4s' 
                }}
              >
                <i className="fa-solid fa-location-crosshairs"></i> 3. Registro GPS
              </button>

              <button 
                onClick={handleManualReset} 
                style={{ 
                  padding: '10px', 
                  background: currentDemoStep === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.06)', 
                  border: currentDemoStep === 0 ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.2)', 
                  borderRadius: '8px', 
                  color: '#ef4444', 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px', 
                  transition: 'all 0.4s' 
                }}
              >
                <i className="fa-solid fa-rotate-left"></i> Reiniciar
              </button>

            </div>

            {/* Glowing mesh background */}
            <div style={{ position: 'absolute', right: '-50px', bottom: '-50px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 159, 28, 0.12) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none', zIndex: -1 }}></div>
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

        {/* ¿Qué Hacemos? Section */}
        <section id="que-hacemos" style={{ marginTop: '100px' }} data-aos="fade-up">
          <h2 style={{ textAlign: 'center', fontSize: '2.2rem', marginBottom: '12px', color: '#fff' }}>¿Qué Hacemos?</h2>
          <p style={{ textAlign: 'center', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px auto', fontSize: '0.95rem', lineHeight: '1.6' }}>
            Simplificamos y blindamos el control de tus proyectos constructivos mediante automatizaciones inteligentes por mensajería.
          </p>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            <div style={{ background: 'rgba(13, 20, 38, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(255,159,28,0.1)', color: '#ff9f1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: '16px' }}>
                <i className="fa-solid fa-microphone"></i>
              </div>
              <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '1.05rem', fontWeight: 700 }}>Asistencia y Reportes por Voz</h4>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Tus operarios no necesitan aprender sistemas complejos. Solo envían un audio por WhatsApp y la IA actualiza la asistencia con geocerca o el avance del Gantt.
              </p>
            </div>
            <div style={{ background: 'rgba(13, 20, 38, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: '16px' }}>
                <i className="fa-solid fa-cart-shopping"></i>
              </div>
              <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '1.05rem', fontWeight: 700 }}>Abastecimiento Automático B2B</h4>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Cuando el stock crítico decae, el sistema emite automáticamente órdenes de compra a distribuidores de insumos y corralones integrados, evitando desabastecimiento.
              </p>
            </div>
            <div style={{ background: 'rgba(13, 20, 38, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: '16px' }}>
                <i className="fa-solid fa-file-pdf"></i>
              </div>
              <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '1.05rem', fontWeight: 700 }}>Reportería Ejecutiva en 1 Clic</h4>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Genera hojas ejecutivas formales optimizadas para impresión en PDF con un resumen automatizado redactado por IA sobre desvíos, asistencia y compras de la semana.
              </p>
            </div>
          </div>
        </section>

        {/* ¿Quiénes Somos? Section */}
        <section id="quienes-somos" style={{ marginTop: '100px' }} data-aos="fade-up">
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '40px', alignItems: 'center' }} className="home-preview-grid">
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '2.2rem', marginBottom: '16px', color: '#fff' }}>¿Quiénes Somos?</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: '16px' }}>
                Somos <strong>Innovar Latam</strong>, una startup enfocada en digitalizar la construcción civil en América Latina. Combinamos metodologías ágiles de desarrollo con las tecnologías de inteligencia artificial más potentes del mercado.
              </p>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.7' }}>
                Nuestra visión es erradicar las planillas de papel, planillas manuales propensas a errores y pérdidas de stock en obras residenciales e industriales, permitiendo a los directores de obra tomar decisiones basadas en datos auditables en tiempo real.
              </p>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(255, 159, 28, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ff9f1c', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>IL</div>
                <div>
                  <strong style={{ color: '#fff', display: 'block' }}>Innovar Latam Studio</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Creadores de ObraSaaS</span>
                </div>
              </div>
              <blockquote style={{ borderLeft: '3px solid #ff9f1c', paddingLeft: '16px', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                "La construcción civil no necesita sistemas más complejos en pantallas gigantes; necesita interfaces sencillas e invisibles en el bolsillo del capataz y operarios."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Tecnologías Section */}
        <section id="tecnologias" style={{ marginTop: '100px' }} data-aos="fade-up">
          <h2 style={{ textAlign: 'center', fontSize: '2.2rem', marginBottom: '12px', color: '#fff' }}>Tecnologías que Usamos</h2>
          <p style={{ textAlign: 'center', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px auto', fontSize: '0.95rem', lineHeight: '1.6' }}>
            Nuestra arquitectura modular está impulsada por herramientas líderes de la industria global.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="grid-3">
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
              <i className="fa-brands fa-react" style={{ fontSize: '2rem', color: '#60a5fa', marginBottom: '12px' }}></i>
              <h5 style={{ color: '#fff', marginBottom: '6px' }}>Next.js 16</h5>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>React 19, Server Actions, App Router para carga veloz.</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
              <i className="fa-solid fa-brain" style={{ fontSize: '2rem', color: '#ff9f1c', marginBottom: '12px' }}></i>
              <h5 style={{ color: '#fff', marginBottom: '6px' }}>OpenAI GPT-4o</h5>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Structured Outputs estrictos para parseo exacto de comandos.</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
              <i className="fa-brands fa-whatsapp" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '12px' }}></i>
              <h5 style={{ color: '#fff', marginBottom: '6px' }}>Twilio API</h5>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Canal de mensajería empresarial encriptado y seguro.</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
              <i className="fa-solid fa-map-location-dot" style={{ fontSize: '2rem', color: '#3b82f6', marginBottom: '12px' }}></i>
              <h5 style={{ color: '#fff', marginBottom: '6px' }}>Leaflet Satelital</h5>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Mapas satelitales y geofencing para auditar presentismo.</span>
            </div>
          </div>
        </section>

        {/* FAQs (Preguntas Frecuentes) Accordion Section */}
        <section id="faqs" style={{ marginTop: '100px', marginBottom: '60px' }} data-aos="fade-up">
          <h2 style={{ textAlign: 'center', fontSize: '2.2rem', marginBottom: '12px', color: '#fff' }}>Preguntas Frecuentes</h2>
          <p style={{ textAlign: 'center', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px auto', fontSize: '0.95rem', lineHeight: '1.6' }}>
            Respuestas a las dudas más comunes sobre la implementación de ObraSaaS en tu constructora.
          </p>
          <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            
            {[
              {
                q: "¿Cómo funciona el control de asistencia por voz?",
                a: "El operario envía una nota de voz por WhatsApp. El sistema procesa el audio usando inteligencia artificial para confirmar quién habla, extrae su intención de entrada/salida y valida su ubicación GPS contra la geocerca de la obra."
              },
              {
                q: "¿Los operarios deben descargar alguna aplicación?",
                a: "No. Los trabajadores de campo utilizan únicamente su aplicación de WhatsApp habitual para enviar audios o compartir su ubicación en tiempo real. Esto elimina barreras de adopción técnica en el obrador."
              },
              {
                q: "¿Qué sucede si no hay señal en el obrador?",
                a: "El operario puede enviar el mensaje de voz igual; WhatsApp encola el mensaje y lo despacha de forma segura apenas detecte conexión de red o datos, registrándose con la marca temporal original."
              },
              {
                q: "¿Cómo se integra el abastecimiento automático de materiales?",
                a: "Estableces un límite de stock mínimo de seguridad en tu panel de control de ObraSaaS. Si el stock cae por debajo de este límite, el sistema emite una orden de compra pre-aprobada por mail/API al corralón (ej. Loma Negra o Acindar) para su despacho."
              },
              {
                q: "¿Qué validez tienen los reportes semanales en PDF?",
                a: "Los reportes se descargan membretados y estructurados formalmente para ser presentados directamente a directores de proyectos, inversores o comitentes como bitácora de obra auditada."
              }
            ].map((faq, idx) => {
              const isOpen = faqActive === idx;
              return (
                <div key={idx} style={{ background: 'rgba(13, 20, 38, 0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden', transition: 'var(--transition-smooth)' }}>
                  <button onClick={() => toggleFaq(idx)} style={{ width: '100%', padding: '18px 24px', background: 'transparent', border: 'none', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: '0.95rem' }}>
                    <span>{faq.q}</span>
                    <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ color: '#ff9f1c', fontSize: '0.8rem', transition: 'transform 0.3s' }}></i>
                  </button>
                  <div style={{ maxHeight: isOpen ? '200px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s ease-in-out, padding 0.4s' }}>
                    <div style={{ padding: '0 24px 18px 24px', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6' }}>
                      {faq.a}
                    </div>
                  </div>
                </div>
              );
            })}

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
