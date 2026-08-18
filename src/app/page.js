"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, ProgressBar, Modal } from '@/lib/design-system';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [billingCycle, setBillingCycle] = useState('annual'); // 'monthly' | 'annual'
  const [authModal, setAuthModal] = useState({ show: false, mode: 'register' });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Interactive Live Demo Playground State
  const [activeScenario, setActiveScenario] = useState('gantt'); // 'gantt' | 'kyc' | 'expense' | 'incident'
  const [demoProgress, setDemoProgress] = useState(78);
  const [demoStatus, setDemoStatus] = useState('En Ejecución');
  const [demoLastAction, setDemoLastAction] = useState('Revoque grueso completado al 100% por Juan Gómez');
  const [demoHash, setDemoHash] = useState('8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5b');

  // ROI Calculator State
  const [roiProjects, setRoiProjects] = useState(3);
  const [roiWorkers, setRoiWorkers] = useState(25);
  const [roiBudget, setRoiBudget] = useState(120); // Millions ARS

  // Mateo Voice Assistant State
  const [mateoSpeaking, setMateoSpeaking] = useState(false);
  const [mateoStatus, setMateoStatus] = useState('En línea • Haz clic para escuchar');
  const [leadModal, setLeadModal] = useState(false);
  const [leadData, setLeadData] = useState({ name: '', company: '', phone: '', email: '' });
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  useEffect(() => {
    const logged = localStorage.getItem('obrasaas_logged_in') === 'true';
    setIsLoggedIn(logged);
  }, []);

  const handleScenarioChange = (scenario) => {
    setActiveScenario(scenario);
    if (scenario === 'gantt') {
      setDemoProgress(100);
      setDemoStatus('Hito Certificado');
      setDemoLastAction('Juan Gómez certificó 100% Revoque Grueso con firma digital SHA-256');
      setDemoHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    } else if (scenario === 'kyc') {
      setDemoProgress(85);
      setDemoStatus('KYC Validado');
      setDemoLastAction('Luis Martínez validó DNI + Facial. ART La Segunda Vigente (Póliza #88392)');
      setDemoHash('4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945');
    } else if (scenario === 'expense') {
      setDemoProgress(88);
      setDemoStatus('Remito AFIP Aprobado');
      setDemoLastAction('Factura A Ferretería Central por $18.500 ARS validada con CAE Electrónico');
      setDemoHash('7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b');
    } else if (scenario === 'incident') {
      setDemoProgress(75);
      setDemoStatus('Incidencia Asignada');
      setDemoLastAction('Rotura de caño detectada por foto. Tarea de emergencia asignada al Oficial Plomero');
      setDemoHash('9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e');
    }
  };

  const calculateSavings = () => {
    const adminHoursSaved = roiProjects * 18; // 18 hrs/month per project
    const adminMoneySaved = adminHoursSaved * 12500; // $12,500 ARS/hr
    const materialWastePrevented = (roiBudget * 1000000) * 0.04; // 4% waste reduction
    const totalMonthlyARS = adminMoneySaved + (materialWastePrevented / 12);
    const deliveryDaysSaved = roiProjects * 12; // 12 days per project per year

    return {
      adminHoursSaved,
      adminMoneySaved,
      materialWastePrevented,
      totalMonthlyARS,
      deliveryDaysSaved
    };
  };

  const savings = calculateSavings();

  const handleMateoAudio = () => {
    if (mateoSpeaking) return;
    setMateoSpeaking(true);
    setMateoStatus('Mateo explicando ObraSaaS...');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = "Hola. Soy Mateo, copiloto de inteligencia artificial de ObraSaaS. Nuestra plataforma permite que tus directores, arquitectos y albañiles gestionen toda la obra únicamente usando notas de voz y fotos por WhatsApp. Automatizamos el control de presentismo por GPS, el Libro de Obra Digital según Ley 22.250 y la validación fiscal AFIP en tiempo real. Hacé clic en Comenzar Prueba para ver la demo en vivo.";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      utterance.rate = 0.95;

      utterance.onend = () => {
        setMateoSpeaking(false);
        setMateoStatus('En línea • Haz clic para escuchar');
      };
      utterance.onerror = () => {
        setMateoSpeaking(false);
        setMateoStatus('En línea • Haz clic para escuchar');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setMateoSpeaking(false);
        setMateoStatus('En línea • Haz clic para escuchar');
      }, 4000);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/state');
      const state = await res.json();
      if (!state.crmLeads) state.crmLeads = [];
      state.crmLeads.unshift({
        name: leadData.name,
        company: leadData.company,
        phone: leadData.phone,
        email: leadData.email,
        status: 'Nuevo Lead Calificado',
        createdAt: new Date().toISOString()
      });
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      setLeadSubmitted(true);
      setTimeout(() => {
        setLeadModal(false);
        setLeadSubmitted(false);
        window.location.href = '/onboarding';
      }, 1500);
    } catch (err) {
      window.location.href = '/onboarding';
    }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('obrasaas_logged_in', 'true');
    setIsLoggedIn(true);
    setAuthModal({ show: false, mode: 'login' });
    window.location.href = '/dashboard';
  };

  const faqs = [
    {
      q: '¿Por qué ObraSaaS funciona por WhatsApp y no como una app tradicional?',
      a: 'Porque en la construcción en Argentina y LATAM, el 95% de los operarios de obra se niegan a descargar nuevas aplicaciones o no tienen espacio en sus teléfonos. WhatsApp ya está instalado en el 100% de los dispositivos, funciona sin curva de aprendizaje y permite enviar notas de voz, fotos de remitos y ubicaciones GPS de forma natural.'
    },
    {
      q: '¿Cómo valida la plataforma las leyes laborales UOCRA y la cobertura de ART?',
      a: 'A través de nuestro módulo KYC con IA: el operario envía foto de su DNI y una selfie por WhatsApp. La IA valida identidad con RENAPER/AFIP y cruza el CUIT con la base de pólizas activas de ART. Si la póliza está vencida (Res. SRT 319/99), el acceso al predio se bloquea automáticamente y se notifica al Director Técnico.'
    },
    {
      q: '¿Qué es el Libro de Obra Digital con firma SHA-256?',
      a: 'Es la digitalización legal del libro diario de obra exigido por la Ley 22.250. Cada hito, orden de servicio, clima y nómina presente genera un bloque criptográfico SHA-256 inmutable que tiene validez ante peritajes, aseguradoras y comitentes.'
    },
    {
      q: '¿Qué pasa si en el predio de la obra no hay buena señal de internet?',
      a: 'ObraSaaS cuenta con soporte PWA Offline y sincronización en cola. Los partes diarios y fotos se guardan en el dispositivo del supervisor y se suben automáticamente al reconectar señal.'
    },
    {
      q: '¿Se puede integrar con nuestros sistemas contables actuales (Tango, Bejerman, Xubio)?',
      a: 'Sí. Nuestra API REST v1 y sistema de Webhooks en tiempo real permiten sincronizar remitos aprobados, asientos de caja chica y avances certificados con cualquier ERP o sistema administrativo.'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans, overflowX: 'hidden', position: 'relative' }}>
      
      {/* 🌌 Atmospheric Ambient Background Glows */}
      <div style={{ position: 'fixed', top: '-10%', left: '15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '40%', right: '-5%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '30%', width: '800px', height: '600px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* 🧭 Sticky Glassmorphic Navbar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(6, 9, 19, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.05rem',
              color: '#060913',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)'
            }}>
              OS
            </div>
            <div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', fontFamily: tokens.font.heading }}>
                Obra<span style={{ color: '#f59e0b' }}>SaaS</span>
              </span>
              <span style={{ fontSize: '0.62rem', display: 'block', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '-2px' }}>
                Enterprise Platform
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav style={{ display: 'none', alignItems: 'center', gap: '28px', fontSize: '0.86rem', fontWeight: 500, color: '#94a3b8' }} className="desktop-menu">
            <a href="#features" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>Soluciones</a>
            <a href="#simulador" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>Simulador</a>
            <a href="#calculadora" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>Calculadora ROI</a>
            <Link href="/pricing" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>Precios</Link>
            <Link href="/portal" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>Portal Inversor</Link>
            <Link href="/marketplace" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>Proveedores</Link>
            <Link href="/api-docs" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>API</Link>
          </nav>

          {/* Nav Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isLoggedIn ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm" icon="📊">
                  Ir al Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setAuthModal({ show: true, mode: 'login' })}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f8fafc',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                >
                  Iniciar Sesión
                </button>
                <Link href="/onboarding">
                  <Button variant="primary" size="sm" icon="🚀">
                    Prueba Gratis 14 Días
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 🚀 HERO SECTION */}
      <section style={{ maxWidth: '1360px', margin: '0 auto', padding: '64px 28px 48px', position: 'relative', zIndex: 10 }}>
        
        {/* Top Feature Pill */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.15)',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#fbbf24'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span>NUEVO: WhatsApp Meta Cloud API v2.4 + Copiloto IA con Reconocimiento de Voz</span>
            </div>
          </motion.div>
        </div>

        {/* Hero Main Headline */}
        <div style={{ textAlign: 'center', maxWidth: '960px', margin: '0 auto 24px' }}>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1.08,
              margin: 0,
              fontFamily: tokens.font.heading
            }}
          >
            El Sistema Operativo para la{' '}
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>
              Construcción Moderna
            </span>{' '}
            en LATAM
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: '20px auto 32px',
              maxWidth: '780px',
              fontWeight: 400
            }}
          >
            Conectá las <strong>notas de voz y fotos de tus albañiles en WhatsApp</strong> con tu cronograma Gantt,
            control de costos y certificaciones digitales con firma SHA-256. 100% nativo para <strong>UOCRA, ART y AFIP</strong>.
          </motion.p>

          {/* Primary CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}
          >
            <Link href="/onboarding">
              <Button variant="primary" size="lg" icon="🚀">
                Comenzar Prueba Gratis (14 Días)
              </Button>
            </Link>
            <button
              onClick={handleMateoAudio}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
                borderRadius: '16px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '0.96rem',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
            >
              <span style={{ fontSize: '1.2rem' }}>{mateoSpeaking ? '🔊' : '🎙️'}</span>
              <span>{mateoStatus}</span>
            </button>
          </motion.div>

          {/* Micro Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              marginTop: '24px',
              fontSize: '0.78rem',
              color: '#64748b',
              flexWrap: 'wrap'
            }}
          >
            <span>✓ Sin tarjeta de crédito requerida</span>
            <span>✓ Configuración en 3 minutos</span>
            <span>✓ Compatible con celulares de cualquier gama</span>
            <span>✓ Cumplimiento Ley 22.250 & SRT</span>
          </motion.div>
        </div>

        {/* 🎮 LIVE INTERACTIVE PLAYGROUND (HERO PREVIEW) */}
        <div id="simulador" style={{ marginTop: '48px' }}>
          <GlassCard style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)' }}>
            
            {/* Header bar of interactive demo */}
            <div style={{
              padding: '16px 24px',
              background: 'rgba(15, 23, 42, 0.9)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                  Simulador de Integración en Tiempo Real (WhatsApp ↔ Gantt Criptográfico)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'gantt', label: '1️⃣ Certificar Losa', icon: '🏗️' },
                  { id: 'kyc', label: '2️⃣ Fichar Asistencia', icon: '🪪' },
                  { id: 'expense', label: '3️⃣ Remito AFIP', icon: '🧾' },
                  { id: 'incident', label: '4️⃣ Alerta Rotura', icon: '🚨' }
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleScenarioChange(s.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: activeScenario === s.id ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: activeScenario === s.id ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      color: activeScenario === s.id ? '#fbbf24' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Screen Container */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', background: '#0a0f1d' }}>
              
              {/* Left Column: Simulated WhatsApp Terminal */}
              <div style={{ padding: '24px', borderRight: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '380px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem' }}>
                      💬
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>ObraSaaS Copiloto IA</div>
                      <div style={{ fontSize: '0.7rem', color: '#22c55e' }}>● Verificado Meta Cloud API</div>
                    </div>
                  </div>

                  {/* Message Bubble (Worker) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <div style={{ background: '#1e3a29', color: '#f8fafc', padding: '10px 14px', borderRadius: '12px 12px 2px 12px', maxWidth: '85%', fontSize: '0.82rem', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      {activeScenario === 'gantt' && '🎙️ [Audio 0:08s] "Marcelo, soy Juan Gómez. Terminamos de revocar el muro norte al 100%, listo para certificar."'}
                      {activeScenario === 'kyc' && '🪪 [Foto DNI + Selfie] "Hola, soy Luis Martínez. Envío mi DNI para registrar el ingreso a Torre Palermo."'}
                      {activeScenario === 'expense' && '📸 [Foto Ticket] "Gasto de caja chica en Ferretería Central por $18.500 ARS en mechas y tornillos."'}
                      {activeScenario === 'incident' && '🚨 [Foto Cañería] "Se pinchó la bajada de agua en piso 3. Se inunda el pasillo."' }
                      <div style={{ textAlign: 'right', fontSize: '0.65rem', color: '#86efac', marginTop: '4px' }}>Hoy 08:32 AM ✓✓</div>
                    </div>
                  </div>

                  {/* Message Bubble (AI Bot response) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ background: '#1e293b', color: '#f8fafc', padding: '12px 16px', borderRadius: '12px 12px 12px 2px', maxWidth: '90%', fontSize: '0.82rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>🤖 Copiloto ObraSaaS:</div>
                      {activeScenario === 'gantt' && '✅ Revoque Grueso actualizado al 100% en el Gantt. Generado bloque SHA-256 #8849. Notificado Director Técnico.'}
                      {activeScenario === 'kyc' && '✅ Identidad DNI verificada con RENAPER. Cobertura ART La Segunda vigente. Ingreso autorizado al predio.'}
                      {activeScenario === 'expense' && '✅ Factura A validada con AFIP CAE. Gasto imputado a Caja Chica. Saldo restante actualizado en Dashboard.'}
                      {activeScenario === 'incident' && '🚨 Incidencia de Emergencia creada. Tarea asignada automáticamente a Cuadrilla de Plomería.'}
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '6px' }}>Sincronizado vía SSE Serverless</div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px' }}>
                  💡 Haz clic en los botones de arriba para simular diferentes eventos de obra
                </div>
              </div>

              {/* Right Column: Live Telemetry & Gantt Dashboard */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Obra Activa</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>Torre Palermo Soho (CABA)</div>
                    </div>
                    <Badge color={demoStatus.includes('Validado') || demoStatus.includes('Certificado') ? tokens.colors.accent.success : tokens.colors.accent.warning} variant="filled" size="sm">
                      ● {demoStatus}
                    </Badge>
                  </div>

                  {/* Progress Ring / Bar */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
                    <ProgressBar value={demoProgress} max={100} label="Avance Global Físico Certificado" showLabel color="#f59e0b" height={8} />
                  </div>

                  {/* Action feed */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>ÚLTIMO EVENTO REGISTRADO EN DB:</div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>{demoLastAction}</div>
                  </div>

                  {/* Hash verification */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: '#64748b', fontFamily: tokens.font.mono }}>
                    <span>🔐 Hash SHA-256:</span>
                    <span style={{ color: '#94a3b8' }}>{demoHash.slice(0, 18)}...</span>
                    <span style={{ color: '#22c55e' }}>✓ Inmutable</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <Link href="/dashboard" style={{ flex: 1 }}>
                    <Button variant="secondary" size="sm" style={{ width: '100%' }}>
                      Ver Dashboard Completo →
                    </Button>
                  </Link>
                  <Link href="/portal" style={{ flex: 1 }}>
                    <Button variant="ghost" size="sm" style={{ width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
                      Portal Inversor 🏠
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 📊 PLATFORM METRICS TICKER */}
      <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.5)', padding: '36px 28px' }}>
        <div style={{ maxWidth: '1360px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', textAlign: 'center' }}>
          {[
            { value: '500+', label: 'Obras Proyectadas en LATAM', icon: '🏗️', color: '#f59e0b' },
            { value: '100%', label: 'WhatsApp Nativo (0 Descargas)', icon: '📱', color: '#22c55e' },
            { value: '99.4%', label: 'Precisión OCR Fiscal AFIP', icon: '🧾', color: '#3b82f6' },
            { value: '0', label: 'Multas SRT por ART Vencida', icon: '🛡️', color: '#10b981' },
            { value: '18 hrs', label: 'Ahorro Administrativo Semanal', icon: '⚡', color: '#8b5cf6' }
          ].map((stat, i) => (
            <div key={i}>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: stat.color, fontFamily: tokens.font.heading, letterSpacing: '-0.03em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>
                {stat.icon} {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🧩 BENTO GRID — ENTERPRISE FEATURES */}
      <section id="features" style={{ maxWidth: '1360px', margin: '0 auto', padding: '96px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <Badge color={tokens.colors.accent.primary} variant="filled" size="md">
            ARQUITECTURA DE VANGUARDIA
          </Badge>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: '14px 0 8px', fontFamily: tokens.font.heading }}>
            Todo lo que tu constructora necesita para escalar
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '640px', margin: '0 auto' }}>
            Diseñado específicamente para el ecosistema de la construcción argentino y latinoamericano.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
          
          {/* Card 1: WhatsApp First */}
          <GlassCard style={{ gridColumn: 'span 8', padding: '32px' }} hover glow>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '2rem' }}>📱</div>
              <Badge color="#22c55e" variant="filled">Meta Cloud API Oficial</Badge>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
              WhatsApp como Única Interfaz de Campo
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              Tus oficiales albañiles, capataces y subcontratistas no necesitan instalar ninguna app ni recordar contraseñas.
              Envían un audio diciendo <em>"Terminamos el revoque"</em> o una foto del remito, y el motor de IA actualiza
              automáticamente el Gantt, la caja chica y el presentismo con geocerca satelital.
            </p>
          </GlassCard>

          {/* Card 2: KYC & Compliance */}
          <GlassCard style={{ gridColumn: 'span 4', padding: '32px' }} hover>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🪪</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
              KYC Biométrico & ART
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Validación facial y DNI con cruce automático de vigencia de póliza ART. Bloqueo instantáneo ante vencimientos (Res. SRT 319/99).
            </p>
          </GlassCard>

          {/* Card 3: Curva S & Costos */}
          <GlassCard style={{ gridColumn: 'span 4', padding: '32px' }} hover>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📉</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
              Curva S & Costos por Rubro
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Detección predictiva de desvíos presupuestarios. Comparación instantánea entre avance físico certificado y dinero ejecutado.
            </p>
          </GlassCard>

          {/* Card 4: Clima CIRSOC */}
          <GlassCard style={{ gridColumn: 'span 4', padding: '32px' }} hover>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🛰️</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
              Telemetría CIRSOC / IRAM 1666
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Predicción satelital de ventanas óptimas de 72hs sin lluvia para colado de losas y hormigón elaborado.
            </p>
          </GlassCard>

          {/* Card 5: Libro de Obra SHA-256 */}
          <GlassCard style={{ gridColumn: 'span 4', padding: '32px' }} hover>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔐</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
              Libro de Obra Ley 22.250
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Firma digital criptográfica SHA-256 en cada asiento diario. Validez legal ante inspecciones y comitentes.
            </p>
          </GlassCard>

          {/* Card 6: Vecino Digital (Investor Portal) */}
          <GlassCard style={{ gridColumn: 'span 12', padding: '32px' }} hover glow>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <Badge color="#3b82f6" variant="filled">Diferenciador Exclusivo</Badge>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '8px 0', color: '#f8fafc' }}>
                  Vecino Digital: El Portal Público para Inversores Inmobiliarios
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '780px', margin: 0, lineHeight: 1.6 }}>
                  Brindale a los compradores de pozo e inversores un enlace web público con fotos actualizadas,
                  porcentaje de avance certificado, timeline de obra y estado de cuotas sin revelar tus costos internos.
                </p>
              </div>
              <Link href="/portal">
                <Button variant="secondary" size="md" icon="🏠">
                  Explorar Portal Inversor →
                </Button>
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 🧮 INTERACTIVE ROI CALCULATOR */}
      <section id="calculadora" style={{ background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '96px 28px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <Badge color="#10b981" variant="filled" size="md">CALCULADORA DE IMPACTO FINANCIERO</Badge>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 900, margin: '14px 0 8px', fontFamily: tokens.font.heading }}>
              ¿Cuánto dinero y tiempo ahorrará tu empresa?
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              Ajustá los parámetros de tu operación para ver el retorno de inversión mensual estimado.
            </p>
          </div>

          <GlassCard style={{ padding: '36px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '36px' }}>
              
              {/* Sliders Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cantidad de Obras Simultáneas</span>
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>{roiProjects} obras</span>
                  </div>
                  <input
                    type="range" min="1" max="20" value={roiProjects}
                    onChange={e => setRoiProjects(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Operarios Totales en Nómina</span>
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>{roiWorkers} operarios</span>
                  </div>
                  <input
                    type="range" min="5" max="200" step="5" value={roiWorkers}
                    onChange={e => setRoiWorkers(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Presupuesto Anual Total Administrado</span>
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>${roiBudget}M ARS</span>
                  </div>
                  <input
                    type="range" min="20" max="1000" step="10" value={roiBudget}
                    onChange={e => setRoiBudget(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Calculated Outputs */}
              <div style={{ background: 'rgba(6, 9, 19, 0.6)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Ahorro Estimado Mensual
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#10b981', fontFamily: tokens.font.heading, margin: '6px 0 16px' }}>
                    ${(savings.totalMonthlyARS / 1000000).toFixed(2)}M <span style={{ fontSize: '1rem', color: '#94a3b8' }}>ARS/mes</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ color: '#64748b' }}>Horas admin ahorradas:</div>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{savings.adminHoursSaved} hs/mes</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ color: '#64748b' }}>Desperdicio evitado:</div>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>${(savings.materialWastePrevented / 1000000).toFixed(1)}M/año</div>
                    </div>
                  </div>
                </div>

                <Link href="/onboarding" style={{ marginTop: '20px' }}>
                  <Button variant="primary" size="md" style={{ width: '100%' }}>
                    Activar Ahorro con Plan Starter ($29 USD/mes) →
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ⚔️ COMPETITIVE MATRIX */}
      <section style={{ maxWidth: '1360px', margin: '0 auto', padding: '96px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <Badge color="#8b5cf6" variant="filled" size="md">BENCHMARK DE MERCADO</Badge>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 900, margin: '14px 0 8px', fontFamily: tokens.font.heading }}>
            ObraSaaS vs Competidores Tradicionales
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
            Por qué las empresas líderes eligen ObraSaaS frente a software extranjero costoso o soluciones incompletas.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
                <th style={{ padding: '16px', color: '#94a3b8' }}>Característica Clave</th>
                <th style={{ padding: '16px', color: '#f59e0b', fontWeight: 800, background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px 8px 0 0' }}>ObraSaaS Enterprise</th>
                <th style={{ padding: '16px', color: '#64748b' }}>Procore</th>
                <th style={{ padding: '16px', color: '#64748b' }}>Lebane</th>
                <th style={{ padding: '16px', color: '#64748b' }}>Obak / Trowel</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feat: 'WhatsApp Nativo (Sin instalar app)', obra: '✅ Bot IA con voz y fotos', pro: '❌ No', leb: '❌ No', oth: '❌ No' },
                { feat: 'KYC Biométrico DNI + Póliza ART', obra: '✅ Automático 10s', pro: '❌ No', leb: '❌ Parcial', oth: '❌ No' },
                { feat: 'Libro de Obra Ley 22.250 SHA-256', obra: '✅ Firma Digital Inmutable', pro: '❌ No', leb: '❌ No', oth: '❌ No' },
                { feat: 'Telemetría Clima CIRSOC / IRAM 1666', obra: '✅ Satelital en tiempo real', pro: '❌ No', leb: '❌ No', oth: '❌ No' },
                { feat: 'Portal Público para Inversores', obra: '✅ Vecino Digital', pro: '❌ Requiere licencia', leb: '❌ No', oth: '❌ No' },
                { feat: 'Precio Mensual Accesible', obra: '✅ Desde $29 USD/mes', pro: '❌ $500 - $5,000 USD', leb: '❌ $150+ USD', oth: '❌ $60 - $100 USD' }
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#f8fafc' }}>{row.feat}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.04)' }}>{row.obra}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{row.pro}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{row.leb}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{row.oth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 💳 PRICING PREVIEW */}
      <section id="precios" style={{ background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '96px 28px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <Badge color="#f59e0b" variant="filled" size="md">PLANES TRANSPARENTES</Badge>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 900, margin: '14px 0 8px', fontFamily: tokens.font.heading }}>
              Inversión clara sin costos ocultos
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              Comenzá gratis hoy y escalá cuando tu empresa sume más obras.
            </p>

            {/* Billing Toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(6, 9, 19, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '20px' }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: billingCycle === 'monthly' ? '#1e293b' : 'transparent',
                  color: billingCycle === 'monthly' ? '#f8fafc' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: billingCycle === 'annual' ? '#f59e0b' : 'transparent',
                  color: billingCycle === 'annual' ? '#060913' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Anual</span>
                <span style={{ fontSize: '0.65rem', padding: '1px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>20% OFF</span>
              </button>
            </div>
          </div>

          {/* Pricing Tier Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            
            {/* Starter */}
            <GlassCard style={{ padding: '32px' }} hover>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>Starter</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 16px' }}>Para estudios y constructoras medianas</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f8fafc', fontFamily: tokens.font.heading }}>
                ${billingCycle === 'annual' ? '23' : '29'} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>USD/mes</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', margin: '4px 0 20px' }}>1 obra activa • 5 usuarios</div>
              <Link href="/onboarding?plan=starter">
                <Button variant="secondary" size="md" style={{ width: '100%' }}>Comenzar Prueba Gratis</Button>
              </Link>
            </GlassCard>

            {/* Professional (Highlighted) */}
            <GlassCard style={{ padding: '32px', border: '1px solid rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.04)', position: 'relative' }} hover glow>
              <div style={{ position: 'absolute', top: '-12px', right: '20px' }}>
                <Badge color="#f59e0b" variant="solid" size="sm">MÁS POPULAR</Badge>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>Professional</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 16px' }}>Para empresas en crecimiento</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b', fontFamily: tokens.font.heading }}>
                ${billingCycle === 'annual' ? '79' : '99'} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>USD/mes</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', margin: '4px 0 20px' }}>5 obras activas • 20 usuarios • API REST</div>
              <Link href="/onboarding?plan=professional">
                <Button variant="primary" size="md" style={{ width: '100%' }}>Comenzar Prueba Gratis</Button>
              </Link>
            </GlassCard>

            {/* Enterprise */}
            <GlassCard style={{ padding: '32px' }} hover>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>Enterprise</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 16px' }}>Para grandes desarrolladoras y gobiernos</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f8fafc', fontFamily: tokens.font.heading }}>
                ${billingCycle === 'annual' ? '159' : '199'} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>USD/mes</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', margin: '4px 0 20px' }}>Obras ilimitadas • Soporte 24/7 SLA</div>
              <Link href="/onboarding?plan=enterprise">
                <Button variant="secondary" size="md" style={{ width: '100%' }}>Hablar con Ventas</Button>
              </Link>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ❓ FAQs ACCORDION */}
      <section id="faqs" style={{ maxWidth: '900px', margin: '0 auto', padding: '96px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Badge color="#06b6d4" variant="filled" size="md">PREGUNTAS FRECUENTES</Badge>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', fontWeight: 900, margin: '14px 0 8px', fontFamily: tokens.font.heading }}>
            Todo lo que necesitas saber
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <GlassCard
                key={idx}
                style={{ padding: '20px 24px', cursor: 'pointer' }}
                onClick={() => setActiveFaq(isOpen ? null : idx)}
                hover={false}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '0.96rem', fontWeight: 700, color: isOpen ? '#f59e0b' : '#f8fafc' }}>
                    {faq.q}
                  </span>
                  <span style={{ fontSize: '1.2rem', color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    ↓
                  </span>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6, margin: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* 🚀 FINAL CTA BANNER */}
      <section style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 28px 96px' }}>
        <GlassCard style={{ padding: '64px 32px', textAlign: 'center', background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 0 60px rgba(245, 158, 11, 0.15)' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, margin: '0 0 16px', fontFamily: tokens.font.heading }}>
            Modernizá tu constructora hoy mismo
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto 32px' }}>
            Sumate a más de 500 obras en toda la región. 14 días de prueba sin compromiso y con acompañamiento dedicado.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/onboarding">
              <Button variant="primary" size="lg" icon="🚀">
                Crear Mi Primera Obra Gratis
              </Button>
            </Link>
            <button
              onClick={() => setLeadModal(true)}
              style={{
                padding: '14px 28px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '0.98rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Agendar Demo Personalizada
            </button>
          </div>
        </GlassCard>
      </section>

      {/* 🦶 ENTERPRISE FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#04070e', padding: '64px 28px 32px' }}>
        <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '48px' }}>
            
            {/* Col 1 */}
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginBottom: '12px' }}>
                Obra<span style={{ color: '#f59e0b' }}>SaaS</span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6 }}>
                La plataforma de gestión de obra #1 en LATAM impulsada por WhatsApp e Inteligencia Artificial.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '0.75rem', color: '#10b981' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span>Todos los sistemas operativos</span>
              </div>
            </div>

            {/* Col 2 */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>Plataforma</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#94a3b8' }}>
                <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>Dashboard Central</Link>
                <Link href="/costos" style={{ color: 'inherit', textDecoration: 'none' }}>Control de Costos</Link>
                <Link href="/ejecutivo" style={{ color: 'inherit', textDecoration: 'none' }}>Dashboard Ejecutivo CEO</Link>
                <Link href="/portal" style={{ color: 'inherit', textDecoration: 'none' }}>Portal Vecino Digital</Link>
                <Link href="/compliance" style={{ color: 'inherit', textDecoration: 'none' }}>Centro de Compliance</Link>
              </div>
            </div>

            {/* Col 3 */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>Ecosistema</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#94a3b8' }}>
                <Link href="/marketplace" style={{ color: 'inherit', textDecoration: 'none' }}>Marketplace de Proveedores</Link>
                <Link href="/pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Planes y Precios</Link>
                <Link href="/api-docs" style={{ color: 'inherit', textDecoration: 'none' }}>Documentación API REST</Link>
                <Link href="/superadmin" style={{ color: 'inherit', textDecoration: 'none' }}>Super Admin Console</Link>
              </div>
            </div>

            {/* Col 4: Compliance */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>Normativas & Legal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#64748b' }}>
                <span>• Cumplimiento Ley 22.250</span>
                <span>• Resolución SRT 319/99</span>
                <span>• Convenio Colectivo CCT 76/75 (UOCRA)</span>
                <span>• Normas IRAM 1666 & CIRSOC 201</span>
                <span>• Firma Criptográfica SHA-256</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: '#475569' }}>
            <div>© 2026 ObraSaaS Inc. Todos los derechos reservados. Hecho en Argentina para LATAM.</div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span>Términos del Servicio</span>
              <span>Privacidad de Datos</span>
              <span>Seguridad Criptográfica</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 🔐 AUTH / LOGIN MODAL */}
      <Modal
        isOpen={authModal.show}
        onClose={() => setAuthModal({ show: false, mode: 'login' })}
        title={authModal.mode === 'login' ? 'Iniciar Sesión en ObraSaaS' : 'Crear Cuenta Enterprise'}
        subtitle="Accedé al centro de mando de tus obras en tiempo real"
      >
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Email Corporativo</label>
            <input
              type="email"
              required
              placeholder="ejemplo@constructora.com"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.9rem' }}
            />
          </div>
          <Button variant="primary" size="md" style={{ width: '100%', marginTop: '8px' }}>
            {authModal.mode === 'login' ? 'Ingresar al Dashboard' : 'Crear Cuenta y Probar Gratis'}
          </Button>
        </form>
      </Modal>

      {/* 📋 LEAD / DEMO REQUEST MODAL */}
      <Modal
        isOpen={leadModal}
        onClose={() => setLeadModal(false)}
        title="Agendar Demo Personalizada"
        subtitle="Un especialista te mostrará cómo implementar ObraSaaS en tu empresa"
      >
        {leadSubmitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#10b981' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>¡Solicitud Recibida!</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Redirigiendo a tu espacio de trabajo...</p>
          </div>
        ) : (
          <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nombre Completo</label>
              <input
                type="text" required placeholder="Arq. Marcelo Fernández"
                value={leadData.name} onChange={e => setLeadData({ ...leadData, name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Empresa / Estudio</label>
              <input
                type="text" required placeholder="Constructora Cuyo S.A."
                value={leadData.company} onChange={e => setLeadData({ ...leadData, company: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>WhatsApp de Contacto</label>
              <input
                type="tel" required placeholder="+54 9 11 1234-5678"
                value={leadData.phone} onChange={e => setLeadData({ ...leadData, phone: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email</label>
              <input
                type="email" required placeholder="marcelo@constructora.com"
                value={leadData.email} onChange={e => setLeadData({ ...leadData, email: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#060913', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f8fafc' }}
              />
            </div>
            <Button variant="primary" size="md" style={{ width: '100%', marginTop: '6px' }}>
              Confirmar y Enviar Solicitud
            </Button>
          </form>
        )}
      </Modal>

    </div>
  );
}
