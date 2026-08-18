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
      
      // Filter for Spanish voices
      const esVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'));
      
      // Prioritize male names/identifiers in Spanish voices (matching Mateo)
      const maleKeywords = ['david', 'jorge', 'carlos', 'male', 'hombre', 'julio', 'miguel', 'hector', 'default', 'pablo'];
      let selectedVoice = esVoices.find(v => {
        const nameLower = v.name.toLowerCase();
        return maleKeywords.some(keyword => nameLower.includes(keyword));
      });
      
      // Fallback 1: Any Spanish voice
      if (!selectedVoice) {
        selectedVoice = esVoices.find(v => v.lang.startsWith('es-AR') || v.lang.startsWith('es-ES') || v.lang.startsWith('es'));
      }
      
      // Fallback 2: Any male voice globally
      if (!selectedVoice) {
        selectedVoice = voices.find(v => {
          const nameLower = v.name.toLowerCase();
          return maleKeywords.some(keyword => nameLower.includes(keyword));
        });
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = 0.95;
      utterance.pitch = 0.95; // Lower pitch for masculine/natural tone
      
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
      const pitch = "Hola, soy Mateo, el asistente virtual de ObraSaaS. Nuestra plataforma permite conectar las notas de voz de WhatsApp de tus albañiles con tu cronograma Gantt de manera automática usando inteligencia artificial. Completa el formulario de la derecha para registrarte en el CRM SuperAdmin y probar la demo.";
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
      
      alert(`¡Excelente! Lead registrado en la base de datos centralizada de ObraSaaS.\nMateo ha enviado los datos de ${leadName} al CRM de la Consola Administrativa.`);
      
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
            <Link href="/pricing" style={{ textDecoration: 'none', color: 'inherit' }}>Precios</Link>
            <Link href="/portal" style={{ textDecoration: 'none', color: 'inherit' }}>Portal Inversor</Link>
            <Link href="/api-docs" style={{ textDecoration: 'none', color: 'inherit' }}>API</Link>
            <a href="#faqs">FAQ</a>
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
          <h1 className="hero-title">La plataforma de Control de Obra que <span>tu cuadrilla sí usará</span></h1>
          <p className="hero-subtitle">
            Convierte simples notas de voz de WhatsApp en planificación Gantt reactiva y reportes premium. Captura leads comerciales automáticos y lleva el control administrativo total en un solo panel de control.
          </p>
          <div className="hero-ctas" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '30px' }}>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, background: '#ff9f1c', color: '#000', borderRadius: '6px' }}>
              <i className="fa-solid fa-play"></i> Probar Demo del Dashboard
            </Link>
            <button className="btn btn-secondary" onClick={speakAvatarSalesPitch} style={{ padding: '14px 28px', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '6px' }}>
              <i className="fa-solid fa-headphones"></i> Hablar con Mateo AI
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


            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '30px', textAlign: 'left', minHeight: '610px', alignItems: 'stretch' }} className="home-preview-grid">
              
              {/* Left Column: Reactive Dashboard Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between' }}>
                {/* Gantt Chart Preview */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h5 style={{ marginBottom: '4px', fontWeight: 700, color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <i className="fa-solid fa-chart-gantt" style={{ color: '#ff9f1c', marginRight: '8px' }}></i> Estado del Cronograma (Gantt)
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>
                        <span>Revestimientos y Cerámicos (Fase 3)</span>
                        <span style={{ fontWeight: 700, color: '#64748b' }}>En Espera</span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: '0%', height: '100%', background: '#ff9f1c', borderRadius: '5px' }}></div>
                      </div>
                    </div>
                    {/* Task 4 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>
                        <span>Carpinterías y Aberturas (Fase 4)</span>
                        <span style={{ fontWeight: 700, color: '#64748b' }}>En Espera</span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: '0%', height: '100%', background: '#ff9f1c', borderRadius: '5px' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stockpiles and GPS Info Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Cemento stockpile card */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}><i className="fa-solid fa-cubes" style={{ marginRight: '6px', color: '#ff9f1c' }}></i> Cemento</span>
                        <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: '6px', background: demoCementStatus === 'Crítico' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: demoCementColor, fontWeight: 700, transition: 'color 0.5s' }}>
                          {demoCementStatus}
                        </span>
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '4px', transition: 'color 0.5s' }}>{demoCementStock} Bolsas</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        {demoCementStatus === 'Crítico' ? 'Abastecimiento automático en curso' : 'Suministro óptimo'}
                      </div>
                    </div>

                    {/* Acero stockpile card */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}><i className="fa-solid fa-bars" style={{ marginRight: '6px', color: '#3b82f6', transform: 'rotate(90deg)' }}></i> Hierro/Acero</span>
                        <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                          Óptimo
                        </span>
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>42 Varillas</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        Consumo estable de acero
                      </div>
                    </div>
                  </div>

                  {/* Satellite Control card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '1.2rem', boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)' }}>
                      <i className="fa-solid fa-map-location-dot"></i>
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Geocerca de Obra Activa</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>{demoWorkerStatus}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Smartphone Container Mockup */}
              <div style={{
                background: '#090d16', 
                border: '12px solid #0f172a', 
                borderRadius: '44px', 
                boxShadow: '0 0 0 2px #334155, 0 25px 60px -12px rgba(0, 0, 0, 0.8), inset 0 0 12px rgba(0,0,0,0.9)',
                padding: '12px 6px 12px 6px',
                width: '300px',
                height: '610px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                margin: '0 auto'
              }}>
                {/* Dynamic Island */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '90px',
                  height: '24px',
                  background: '#000',
                  borderRadius: '12px',
                  zIndex: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 4px rgba(255,255,255,0.2)'
                }}>
                  {/* Micro camera lens glow */}
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#040b14',
                    border: '1px solid #111827',
                    position: 'absolute',
                    right: '12px'
                  }}></div>
                </div>

                {/* WhatsApp Chat App Interface */}
                <div style={{ 
                  background: '#0b141a', // WhatsApp dark background
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)', // Simulates texturized wallpaper
                  backgroundSize: '16px 16px',
                  borderRadius: '34px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  height: '100%', 
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {/* WhatsApp status bar */}
                  <div style={{ background: '#111b21', padding: '16px 20px 4px 20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#8696a0', fontWeight: 600 }}>
                    <span>08:15 AM</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <i className="fa-solid fa-signal"></i>
                      <i className="fa-solid fa-wifi"></i>
                      <i className="fa-solid fa-battery-three-quarters"></i>
                    </div>
                  </div>

                  {/* WhatsApp chat header */}
                  <div style={{ background: '#202c33', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #075e54, #128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>
                      <i className="fa-brands fa-whatsapp" style={{ color: '#fff', fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>WhatsApp Copiloto</div>
                      <div style={{ fontSize: '0.55rem', color: '#00a884' }}><i className="fa-solid fa-circle" style={{ fontSize: '0.35rem', marginRight: '4px', color: '#00a884' }}></i> En línea</div>
                    </div>
                  </div>

                  {/* Chat body messages list */}
                  <div style={{ flexGrow: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '460px', fontSize: '0.65rem' }}>
                    {demoMessages.map((msg, idx) => {
                      const isBot = msg.sender === 'IA ObraSaaS';
                      const isSupplier = msg.sender.includes('Loma Negra');
                      // Outgoing bubbles (Workers/Supplier) vs Incoming (Bot)
                      const isOutgoing = !isBot;
                      const bg = isOutgoing 
                        ? (isSupplier ? '#025141' : '#005c4b') // WhatsApp dark outgoing green
                        : '#202c33'; // WhatsApp dark incoming gray
                      const align = isOutgoing ? 'flex-end' : 'flex-start';
                      const color = isOutgoing 
                        ? (isSupplier ? '#ffc107' : '#ffd166') 
                        : '#60a5fa';
                      return (
                        <div key={idx} style={{ 
                          background: bg, 
                          padding: '8px 10px', 
                          borderRadius: '8px', 
                          alignSelf: align, 
                          maxWidth: '85%', 
                          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          position: 'relative',
                          transition: 'all 0.3s'
                        }}>
                          <div style={{ fontWeight: 700, color: color, marginBottom: '2px', fontSize: '0.6rem' }}>{msg.sender}</div>
                          <div style={{ color: '#e9edef', wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.text}</div>
                          <div style={{ fontSize: '0.55rem', color: '#8696a0', textAlign: 'right', marginTop: '3px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                            <span>{msg.time}</span>
                            {isOutgoing && <i className="fa-solid fa-check-double" style={{ color: '#53bdeb', fontSize: '0.55rem' }}></i>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* WhatsApp Text Input Bar Mockup */}
                  <div style={{ background: '#1f2c34', padding: '6px 10px 10px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ background: '#2a3942', borderRadius: '20px', padding: '6px 12px', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#8696a0', fontSize: '0.65rem' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <i className="fa-regular fa-face-smile" style={{ fontSize: '0.9rem' }}></i>
                        <span>Mensaje...</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <i className="fa-solid fa-paperclip" style={{ fontSize: '0.8rem' }}></i>
                        <i className="fa-solid fa-camera" style={{ fontSize: '0.8rem' }}></i>
                      </div>
                    </div>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem' }}>
                      <i className="fa-solid fa-microphone"></i>
                    </div>
                  </div>

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
            <h3 style={{ marginBottom: '16px' }}><i className="fa-solid fa-microphone-lines" style={{ color: '#ff9f1c' }}></i> AI Avatar 2.0: Mateo</h3>
            
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
              Haz clic en el avatar o el botón de arriba para escuchar a Mateo AI describir el producto.
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
          
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div className="feature-box">
              <div className="feature-icon"><i className="fa-solid fa-volume-high"></i></div>
              <h4>Comandos de Voz a Tareas</h4>
              <p>
                Los operarios envían simples mensajes de voz en WhatsApp. Nuestro motor de IA transcribe el audio, actualiza el progreso en el Gantt y registra desvíos automáticamente.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i className="fa-solid fa-map-location-dot"></i></div>
              <h4>Geocercas Satelitales</h4>
              <p>
                Validación de identidad por número de celular único. Marcación de asistencia satelital verificada contra los límites geográficos físicos de la obra en tiempo real.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i className="fa-solid fa-calendar-week"></i></div>
              <h4>Gantt por Quincenas (Módulo 2B)</h4>
              <p>
                Planificación dividida en períodos de 15 días con bloqueo visual automático si el proveedor no confirmó la entrega del material requerido.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i className="fa-solid fa-truck-ramp-box"></i></div>
              <h4>Avisos y Confirmación Proveedores</h4>
              <p>
                Notificación automática por email y WhatsApp 7 días antes de la tarea, y solicitud de confirmación obligatoria 2 días antes de la descarga en obra.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i className="fa-solid fa-file-signature"></i></div>
              <h4>Certificaciones Quincenales</h4>
              <p>
                Actas digitales de avance físico y financiero con firma de la Directora de Obra para facturación inmediata y transparente al cliente o municipio.
              </p>
            </div>
            <div className="feature-box">
              <div className="feature-icon"><i className="fa-solid fa-building-columns"></i></div>
              <h4>Consola SuperAdmin &amp; CRM</h4>
              <p>
                Monitoreo comercial y financiero de licencias activas en Argentina. Administración simplificada de tickets de soporte técnico, facturación y caja chica con OCR.
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
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <span style={{ color: '#ff9f1c', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>El Equipo Detrás del Software</span>
            <h2 style={{ fontSize: '2.2rem', color: '#fff', marginTop: '8px' }}>¿Quiénes Somos?</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', alignItems: 'stretch' }} className="home-preview-grid">
            {/* Left Card: Company Profile */}
            <div style={{ background: 'rgba(13, 20, 38, 0.45)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', backdropFilter: 'blur(12px)' }}>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,159,28,0.12)', color: '#ff9f1c', border: '1px solid rgba(255,159,28,0.2)', textTransform: 'uppercase', marginBottom: '16px' }}>
                  <i className="fa-solid fa-circle-check"></i> Digitalizando LATAM
                </span>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: '16px' }}>
                  Somos <strong>Innovar Latam</strong>, una software factory especializada en la digitalización integral de la construcción civil en América Latina. Combinamos metodologías de desarrollo ágiles con modelos avanzados de inteligencia artificial.
                </p>
                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: '1.7', marginBottom: '24px' }}>
                  Nuestra meta es erradicar el uso ineficiente de planillas físicas en obra, automatizando el flujo de reportes diarios, el presentismo de cuadrillas y el control preventivo de stock.
                </p>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ff9f1c' }}>12+</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Apps Activas</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>5+</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Años de Trayectoria</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>200+</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Obras Auditadas</div>
                </div>
              </div>
            </div>

            {/* Right Card: Studio Profile & Contact */}
            <div style={{ background: 'linear-gradient(135deg, rgba(255, 159, 28, 0.04) 0%, rgba(59, 130, 246, 0.04) 100%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #ff9f1c, #d97706)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(255, 159, 28, 0.25)' }}>IL</div>
                  <div>
                    <strong style={{ color: '#fff', display: 'block', fontSize: '1rem' }}>Innovar Latam Studio</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Creadores y Desarrolladores de ObraSaaS</span>
                  </div>
                </div>
                
                <blockquote style={{ borderLeft: '3px solid #ff9f1c', paddingLeft: '16px', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', margin: 0, lineHeight: '1.6' }}>
                  "La construcción civil no necesita sistemas más complejos en pantallas gigantes; necesita interfaces sencillas e invisibles en el bolsillo del capataz y operarios."
                </blockquote>
              </div>

              {/* Styled Contact Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
                <a href="mailto:hola@inmov.ar" style={{ color: '#e2e8f0', textDecoration: 'none', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.3s', fontWeight: 600 }} className="contact-btn-email">
                  <i className="fa-solid fa-envelope" style={{ color: '#ff9f1c' }}></i> hola@inmov.ar
                </a>
                <a href="https://wa.me/5491132145678" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none', background: 'rgba(16,185,129,0.08)', padding: '12px 20px', borderRadius: '12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid rgba(16,185,129,0.2)', transition: 'all 0.3s', fontWeight: 600 }} className="contact-btn-wa">
                  <i className="fa-brands fa-whatsapp" style={{ color: '#10b981', fontSize: '1rem' }}></i> Contactar por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Tecnologías Section Deleted */}

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
        <footer className="landing-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 0 20px 0', marginTop: '100px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>ObraSaaS por Innovar Latam</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>© 2026 Todos los derechos reservados.</span>
            <span style={{ fontSize: '0.7rem', color: '#475569' }}>Buenos Aires, Argentina | inmov.ar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
              <Link href="/presupuesto" style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.3s' }}>Propuesta Económica</Link>
              <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.3s' }}>Dashboard Obra</Link>
            </div>
            {/* AFIP QR Code */}
            <a href="https://servicios1.afip.gob.ar/clavefiscal/qr/registrar.aspx" target="_F960HV" rel="noopener noreferrer" style={{ display: 'inline-block', transition: 'opacity 0.3s' }}>
              <img src="https://www.afip.gob.ar/images/f960/DATAWEB.jpg" border="0" width="38" height="52" alt="Data Fiscal AFIP" style={{ borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
            </a>
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
