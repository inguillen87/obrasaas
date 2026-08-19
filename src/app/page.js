"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView, useSpring, AnimatePresence } from 'framer-motion';
import { tokens, Button, GlassCard, Modal } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

/* ─── Scroll-triggered reveal wrapper ─── */
function Reveal({ children, delay = 0, direction = 'up', once = true, className, style }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-60px' });

  const dirs = {
    up: { hidden: { y: 40, opacity: 0 }, visible: { y: 0, opacity: 1 } },
    down: { hidden: { y: -40, opacity: 0 }, visible: { y: 0, opacity: 1 } },
    left: { hidden: { x: -50, opacity: 0 }, visible: { x: 0, opacity: 1 } },
    right: { hidden: { x: 50, opacity: 0 }, visible: { x: 0, opacity: 1 } },
    scale: { hidden: { scale: 0.9, opacity: 0 }, visible: { scale: 1, opacity: 1 } },
    none: { hidden: { opacity: 0 }, visible: { opacity: 1 } }
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={dirs[direction] || dirs.up}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ─── Magnetic hover effect wrapper ─── */
function Magnetic({ children, strength = 0.3 }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const springX = useSpring(0, { stiffness: 150, damping: 15 });
  const springY = useSpring(0, { stiffness: 150, damping: 15 });

  useEffect(() => { springX.set(pos.x); springY.set(pos.y); }, [pos, springX, springY]);

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY, display: 'inline-block' }}
      onMouseMove={e => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({
          x: (e.clientX - rect.left - rect.width / 2) * strength,
          y: (e.clientY - rect.top - rect.height / 2) * strength
        });
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
    >
      {children}
    </motion.div>
  );
}

/* ─── Animated counter ─── */
function AnimatedNumber({ value, suffix = '', prefix = '', duration = 1.5 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = value / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  return <span ref={ref}>{prefix}{display.toLocaleString('es-AR')}{suffix}</span>;
}

export default function Home() {
  const [leadModal, setLeadModal] = useState(false);
  const [leadData, setLeadData] = useState({ name: '', company: '', phone: '', email: '' });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();

  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);
  const headerBlur = useTransform(scrollYProgress, [0, 0.03], [0, 16]);

  /* ─── ROI Calculator ─── */
  const [roiProjects, setRoiProjects] = useState(3);
  const [roiWorkers, setRoiWorkers] = useState(25);

  const savings = {
    hoursMonth: roiProjects * 18,
    moneyMonth: roiProjects * 18 * 12500,
    deliveryDays: roiProjects * 12
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/state');
      const state = await res.json();
      if (!state.crmLeads) state.crmLeads = [];
      state.crmLeads.unshift({ ...leadData, status: 'Nuevo Lead', createdAt: new Date().toISOString() });
      await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
      setLeadSubmitted(true);
      setTimeout(() => { setLeadModal(false); setLeadSubmitted(false); window.location.href = '/onboarding'; }, 1500);
    } catch { window.location.href = '/onboarding'; }
  };

  const capabilities = [
    { title: 'Control de Obra por WhatsApp', desc: 'Notas de voz, fotos de remitos y ubicaciones GPS procesadas por IA. Sin apps que descargar.', accent: '#22c55e' },
    { title: 'Libro de Obra Digital', desc: 'Cumplimiento nativo de Ley 22.250 con firma criptográfica SHA-256 inmutable.', accent: '#f59e0b' },
    { title: 'KYC Biométrico en Campo', desc: 'Validación de DNI + reconocimiento facial + cruce automático con pólizas ART vigentes.', accent: '#3b82f6' },
    { title: 'Geocerca GPS Anti-Fraude', desc: 'Presentismo satelital con radio configurable por predio. Sin posibilidad de adulteración.', accent: '#8b5cf6' },
    { title: 'Certificaciones & Curva S', desc: 'Avance físico vs. financiero en tiempo real con exportación a Tango, Bejerman y SAP.', accent: '#06b6d4' },
    { title: 'IA Predictiva CIRSOC 201', desc: 'Predicción de retrasos por clima, faltantes de acopio y riesgos de seguridad con 72hs de anticipación.', accent: '#f97316' }
  ];

  const faqs = [
    { q: '¿Por qué funciona por WhatsApp y no como una app?', a: 'En la construcción en Argentina, el 95% de los operarios no descargan apps nuevas. WhatsApp ya está instalado en todos los dispositivos y permite enviar fotos, audios y ubicaciones sin curva de aprendizaje.' },
    { q: '¿Cómo se valida el cumplimiento de ART y UOCRA?', a: 'El operario envía foto de DNI + selfie por WhatsApp. La IA valida identidad y cruza el CUIT con pólizas ART activas. Si la cobertura está vencida, el acceso se bloquea automáticamente.' },
    { q: '¿Qué es la firma digital SHA-256?', a: 'Cada hito y asiento genera un bloque criptográfico inmutable con validez ante peritajes, aseguradoras y comitentes. Funciona como un notario digital incorruptible.' },
    { q: '¿Se integra con sistemas contables existentes?', a: 'Sí. La API REST v1 permite sincronizar datos con Tango Gestión, Bejerman, Xubio y SAP. También exporta CSV con codificación UTF-8 BOM compatible con Excel.' },
    { q: '¿Funciona sin internet en la obra?', a: 'Sí. ObraSaaS es una PWA con soporte offline. Los partes y fotos se guardan en el dispositivo y se sincronizan automáticamente al recuperar señal.' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#050810', color: '#f1f5f9', fontFamily: tokens.font.sans, overflowX: 'hidden' }}>

      {/* ═══ AMBIENT GLOW LAYER ═══ */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '10%', width: '50vw', height: '50vw', maxWidth: '800px', maxHeight: '800px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: '35%', right: '-8%', width: '45vw', height: '45vw', maxWidth: '700px', maxHeight: '700px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* ═══ NAVBAR ═══ */}
      <motion.header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(5, 8, 16, 0.8)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', color: '#050810' }}>OS</div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9', fontFamily: tokens.font.heading }}>
              Obra<span style={{ color: '#f59e0b' }}>SaaS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          {!isMobile && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '32px', fontSize: '0.84rem', color: '#94a3b8' }}>
              {['Soluciones', 'Plataforma', 'Precios'].map((item, i) => (
                <a key={i} href={item === 'Precios' ? '/pricing' : `#${item.toLowerCase()}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#f1f5f9'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                  {item}
                </a>
              ))}
              <Link href="/api-docs" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = '#f1f5f9'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                API Docs
              </Link>
            </nav>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isMobile && <Link href="/sign-in" style={{ textDecoration: 'none', color: '#cbd5e1', fontSize: '0.84rem', fontWeight: 600 }}>Acceder</Link>}
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '9px 20px', borderRadius: '10px', background: '#f59e0b', color: '#050810', fontWeight: 800, fontSize: '0.84rem', border: 'none', cursor: 'pointer' }}
              >
                Demo
              </motion.button>
            </Link>
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: '#f1f5f9', fontSize: '1.4rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>
                {mobileMenuOpen ? '✕' : '☰'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {isMobile && mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5, 8, 16, 0.95)' }}
            >
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Soluciones', 'Plataforma', 'Precios'].map((item, i) => (
                  <a key={i} href={item === 'Precios' ? '/pricing' : `#${item.toLowerCase()}`}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.92rem', fontWeight: 600, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {item}
                  </a>
                ))}
                <Link href="/api-docs" onClick={() => setMobileMenuOpen(false)} style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.92rem', fontWeight: 600, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>API Docs</Link>
                <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)} style={{ color: '#f59e0b', textDecoration: 'none', fontSize: '0.92rem', fontWeight: 700, padding: '8px 0' }}>Acceder</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ═══ HERO ═══ */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '100px 20px 48px' : '140px 32px 80px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Reveal delay={0}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '9999px', border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.06)', fontSize: '0.78rem', fontWeight: 600, color: '#fbbf24', marginBottom: '28px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            Plataforma activa — 5 obras en producción
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 4.4rem)', fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 1.05, margin: '0 0 24px', fontFamily: tokens.font.heading }}>
            El sistema operativo{' '}
            <br />
            <span style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #f97316 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              para la construcción
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p style={{ fontSize: 'clamp(1.05rem, 2vw, 1.28rem)', color: '#8896ab', lineHeight: 1.65, maxWidth: '680px', margin: '0 auto 40px', fontWeight: 400 }}>
            Conectá las notas de voz y fotos de tu equipo en WhatsApp con tu cronograma Gantt,
            control de costos y certificaciones digitales con firma SHA-256.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Magnetic>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{
                  padding: '15px 32px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#050810', fontWeight: 800, fontSize: '1rem', border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}>
                  Explorar demo en vivo
                </motion.button>
              </Link>
            </Magnetic>
            <Magnetic>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setLeadModal(true)}
                style={{
                  padding: '15px 28px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontWeight: 700,
                  fontSize: '1rem', cursor: 'pointer', backdropFilter: 'blur(8px)'
                }}
              >
                Solicitar acceso
              </motion.button>
            </Magnetic>
          </div>
        </Reveal>

        <Reveal delay={0.32}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '12px' : '28px', marginTop: '32px', fontSize: '0.8rem', color: '#5a6579', flexWrap: 'wrap' }}>
            <span>Sin tarjeta de crédito</span>
            <span>·</span>
            <span>Setup en 3 minutos</span>
            <span>·</span>
            <span>Cumple Ley 22.250</span>
          </div>
        </Reveal>
      </section>

      {/* ═══ METRICS STRIP ═══ */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 32px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '16px' : '32px', textAlign: 'center' }}>
          {[
            { value: 5, suffix: '', label: 'Obras en producción' },
            { value: 27, suffix: '', label: 'Endpoints API' },
            { value: 100, suffix: '%', label: 'Compliance normativo' },
            { value: 4, suffix: '', label: 'Roles RBAC activos' }
          ].map((m, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: tokens.font.heading, color: '#f59e0b', letterSpacing: '-0.03em' }}>
                  <AnimatedNumber value={m.value} suffix={m.suffix} />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500, marginTop: '4px' }}>{m.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ CAPABILITIES GRID ═══ */}
      <section id="soluciones" style={{ maxWidth: '1100px', margin: '0 auto', padding: '100px 32px 80px', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.04em', fontFamily: tokens.font.heading, margin: '0 0 12px' }}>
              Diseñado para la{' '}
              <span style={{ color: '#f59e0b' }}>realidad del terreno</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '560px', margin: '0 auto' }}>
              Cada módulo resuelve un problema concreto de la construcción en Argentina y LATAM.
            </p>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 300px), 1fr))`, gap: '16px' }}>
          {capabilities.map((cap, i) => (
            <Reveal key={i} delay={i * 0.06} direction="scale">
              <motion.div
                whileHover={{ y: -6, borderColor: cap.accent + '50' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  padding: '32px 28px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(13, 17, 30, 0.5)',
                  backdropFilter: 'blur(8px)',
                  cursor: 'default',
                  transition: 'border-color 0.3s'
                }}
              >
                <div style={{ width: '4px', height: '28px', borderRadius: '2px', background: cap.accent, marginBottom: '18px', boxShadow: `0 0 12px ${cap.accent}40` }} />
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: '0 0 8px', color: '#f1f5f9', fontFamily: tokens.font.heading }}>{cap.title}</h3>
                <p style={{ fontSize: '0.88rem', color: '#7a8599', lineHeight: 1.55, margin: 0 }}>{cap.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ PLATFORM PREVIEW (INTERACTIVE DEMO) ═══ */}
      <section id="plataforma" style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 32px 100px', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.04em', fontFamily: tokens.font.heading, margin: '0 0 12px' }}>
              WhatsApp como interfaz,{' '}
              <span style={{ color: '#22c55e' }}>inteligencia como motor</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '580px', margin: '0 auto' }}>
              Tu equipo envía un audio. La plataforma actualiza el Gantt, certifica el avance y notifica al director.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} direction="scale">
          <div style={{
            borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(10, 14, 26, 0.7)', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
          }}>
            {/* Terminal header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <span style={{ fontSize: '0.76rem', color: '#475569', fontFamily: tokens.font.mono, marginLeft: '12px' }}>obrasaas.app/dashboard — Integración WhatsApp ↔ Gantt</span>
            </div>

            {/* Content */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', minHeight: isMobile ? 'auto' : '400px' }}>
              {/* WhatsApp simulation */}
              <div style={{ padding: '28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem', fontWeight: 800 }}>W</div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>ObraSaaS Bot</div>
                    <div style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>en línea</div>
                  </div>
                </div>

                {/* Outgoing message */}
                <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
                  style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                  <div style={{ background: 'rgba(22, 101, 52, 0.4)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '12px 16px', borderRadius: '14px 14px 4px 14px', maxWidth: '85%', fontSize: '0.84rem', color: '#d1fae5' }}>
                    <div style={{ fontSize: '0.72rem', color: '#86efac', marginBottom: '4px', fontWeight: 600 }}>Juan Gómez — Oficial Albañil</div>
                    [Audio 0:08s] "Marcelo, terminamos de revocar el muro norte. Listo para certificar."
                    <div style={{ textAlign: 'right', fontSize: '0.64rem', color: '#6ee7b7', marginTop: '6px' }}>08:32 ✓✓</div>
                  </div>
                </motion.div>

                {/* Incoming message */}
                <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }}
                  style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: '14px 14px 14px 4px', maxWidth: '90%', fontSize: '0.84rem', color: '#cbd5e1' }}>
                    <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginBottom: '6px', fontWeight: 700 }}>Copiloto ObraSaaS</div>
                    Revoque Grueso actualizado al 100% en el Gantt. Bloque SHA-256 generado. Director técnico notificado.
                    <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', fontSize: '0.72rem', fontFamily: tokens.font.mono, color: '#fbbf24' }}>
                      hash: e3b0c442...b7852b855
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Dashboard simulation */}
              <div style={{ padding: '28px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                  Actualización en tiempo real
                </div>

                {[
                  { task: 'Revoque Grueso — Muro Norte', progress: 100, status: 'Certificado', color: '#22c55e' },
                  { task: 'Contrapiso Nivel 3', progress: 75, status: 'En Ejecución', color: '#f59e0b' },
                  { task: 'Instalación Sanitaria Piso 2', progress: 40, status: 'Programada', color: '#3b82f6' },
                  { task: 'Losa de Hormigón Nivel 4', progress: 0, status: 'Pendiente', color: '#475569' }
                ].map((t, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }}
                    style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>{t.task}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: t.color, padding: '2px 8px', borderRadius: '6px', background: t.color + '15' }}>{t.status}</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${t.progress}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', borderRadius: '2px', background: t.color }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ ROI CALCULATOR ═══ */}
      <section id="calculadora" style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 32px 100px', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{
            padding: '48px 40px', borderRadius: '20px',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(10, 14, 26, 0.7) 100%)',
            backdropFilter: 'blur(12px)'
          }}>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 6px', fontFamily: tokens.font.heading, textAlign: 'center' }}>Calculadora de ROI</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 32px', textAlign: 'center' }}>Estimá el ahorro mensual según tu escala operativa</p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '28px', marginBottom: '32px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Obras en simultáneo: <strong style={{ color: '#f59e0b' }}>{roiProjects}</strong></label>
                <input type="range" min="1" max="20" value={roiProjects} onChange={e => setRoiProjects(+e.target.value)}
                  style={{ width: '100%', accentColor: '#f59e0b' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Operarios por obra: <strong style={{ color: '#f59e0b' }}>{roiWorkers}</strong></label>
                <input type="range" min="5" max="100" value={roiWorkers} onChange={e => setRoiWorkers(+e.target.value)}
                  style={{ width: '100%', accentColor: '#f59e0b' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
              {[
                { label: 'Horas admin. ahorradas/mes', value: savings.hoursMonth, suffix: 'hs' },
                { label: 'Ahorro mensual estimado', value: savings.moneyMonth, prefix: '$', suffix: '' },
                { label: 'Días de entrega adelantados/año', value: savings.deliveryDays, suffix: '' }
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '20px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', fontFamily: tokens.font.heading }}>
                    {s.prefix || ''}{s.value.toLocaleString('es-AR')}{s.suffix}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 32px 100px', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em', fontFamily: tokens.font.heading, textAlign: 'center', marginBottom: '40px' }}>
            Preguntas frecuentes
          </h2>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <div style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', background: activeFaq === i ? 'rgba(245, 158, 11, 0.03)' : 'rgba(13, 17, 30, 0.4)' }}>
                <button onClick={() => setActiveFaq(activeFaq === i ? null : i)} style={{
                  width: '100%', padding: '18px 22px', background: 'none', border: 'none', color: '#e2e8f0',
                  fontSize: '0.92rem', fontWeight: 700, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>{faq.q}</span>
                  <motion.span animate={{ rotate: activeFaq === i ? 45 : 0 }} transition={{ duration: 0.2 }}
                    style={{ fontSize: '1.2rem', color: '#f59e0b', flexShrink: 0, marginLeft: '16px' }}>+</motion.span>
                </button>
                <AnimatePresence>
                  {activeFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                      <div style={{ padding: '0 22px 18px', fontSize: '0.86rem', color: '#8896ab', lineHeight: 1.6 }}>{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 32px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Reveal>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.04em', fontFamily: tokens.font.heading, margin: '0 0 16px' }}>
            Tu próxima obra, digitalizada{' '}
            <span style={{ color: '#f59e0b' }}>desde el primer día</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto 32px' }}>
            Comenzá con la demo en vivo. Sin tarjeta de crédito, sin reuniones de ventas.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Magnetic>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{
                  padding: '16px 36px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#050810', fontWeight: 800, fontSize: '1.05rem', border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 30px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}>
                  Explorar demo en vivo
                </motion.button>
              </Link>
            </Magnetic>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{
                padding: '16px 28px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontWeight: 700,
                fontSize: '1.05rem', cursor: 'pointer'
              }}>
                Ver planes y precios
              </motion.button>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.72rem', color: '#050810' }}>OS</div>
            <span style={{ fontSize: '0.82rem', color: '#475569' }}>ObraSaaS — Buenos Aires, Argentina</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem', color: '#475569' }}>
            <Link href="/pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Precios</Link>
            <Link href="/api-docs" style={{ color: 'inherit', textDecoration: 'none' }}>API</Link>
            <Link href="/portal" style={{ color: 'inherit', textDecoration: 'none' }}>Portal Inversor</Link>
            <Link href="/marketplace" style={{ color: 'inherit', textDecoration: 'none' }}>Proveedores</Link>
          </div>
        </div>
      </footer>

      {/* ═══ LEAD CAPTURE MODAL ═══ */}
      <Modal isOpen={leadModal} onClose={() => setLeadModal(false)} title="Solicitar acceso a ObraSaaS" subtitle="Completá tus datos y te contactamos en 24hs">
        {leadSubmitted ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} style={{ fontSize: '3rem', marginBottom: '12px' }}>✓</motion.div>
            <div style={{ fontWeight: 800, color: '#22c55e', fontSize: '1.1rem' }}>Solicitud recibida</div>
          </div>
        ) : (
          <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'name', label: 'Nombre completo', placeholder: 'Ej: Marcelo González' },
              { key: 'company', label: 'Empresa / Estudio', placeholder: 'Ej: Constructora del Plata S.A.' },
              { key: 'phone', label: 'WhatsApp', placeholder: 'Ej: +54 9 261 316-8608' },
              { key: 'email', label: 'Email corporativo', placeholder: 'marcelo@empresa.com' }
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input required placeholder={f.placeholder} value={leadData[f.key]} onChange={e => setLeadData({ ...leadData, [f.key]: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', background: '#050810', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#f1f5f9', fontSize: '0.88rem' }} />
              </div>
            ))}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" style={{
              padding: '13px', borderRadius: '12px', background: '#f59e0b', color: '#050810', fontWeight: 800,
              fontSize: '0.92rem', border: 'none', cursor: 'pointer', marginTop: '4px'
            }}>
              Enviar solicitud
            </motion.button>
          </form>
        )}
      </Modal>
    </div>
  );
}
