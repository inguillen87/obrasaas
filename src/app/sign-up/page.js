"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { tokens } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', company: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = (role = 'director') => {
    setLoading(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('obrasaas_user_role', role);
      localStorage.setItem('obrasaas_demo_mode', 'true');
      localStorage.setItem('obrasaas_logged_in', 'true');
    }
    setTimeout(() => router.push('/dashboard'), 300);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('obrasaas_logged_in', 'true');
      localStorage.setItem('obrasaas_user_name', formData.name);
      localStorage.setItem('obrasaas_company', formData.company);
    }
    setTimeout(() => router.push('/onboarding'), 400);
  };

  const update = (key, val) => setFormData({ ...formData, [key]: val });
  const { isMobile } = useBreakpoint();

  const inputStyle = {
    width: '100%', padding: '13px 16px',
    background: 'rgba(5, 8, 16, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', color: '#f1f5f9', fontSize: '0.9rem',
    outline: 'none', transition: 'border-color 0.2s',
    fontFamily: tokens.font.sans
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050810', color: '#f1f5f9',
      fontFamily: tokens.font.sans, display: 'flex', flexDirection: isMobile ? 'column' : 'row', position: 'relative', overflow: 'hidden'
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '20%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(34, 197, 94, 0.05) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* Left panel — branding (hidden on mobile) */}
      {!isMobile && (
      <div style={{
        flex: '1 1 50%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '64px 56px', position: 'relative', zIndex: 1,
        borderRight: '1px solid rgba(255,255,255,0.04)'
      }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '48px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem', color: '#050810' }}>OS</div>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: tokens.font.heading }}>
            Obra<span style={{ color: '#f59e0b' }}>SaaS</span>
          </span>
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 16px', fontFamily: tokens.font.heading, maxWidth: '400px' }}
        >
          Digitalizá tu constructora{' '}
          <span style={{ color: '#f59e0b' }}>en minutos</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          style={{ fontSize: '1.05rem', color: '#64748b', lineHeight: 1.6, maxWidth: '380px', margin: 0 }}
        >
          14 días gratis. Sin tarjeta de crédito. Cancelá cuando quieras.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.16 }}
          style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {[
            { num: '01', title: 'Creá tu espacio de trabajo', desc: 'Configuración guiada en 3 minutos' },
            { num: '02', title: 'Sumá a tu equipo', desc: 'Invitá directores, capataces y proveedores' },
            { num: '03', title: 'Empezá a operar', desc: 'Tu equipo envía audios por WhatsApp y la plataforma hace el resto' }
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 900, color: '#f59e0b', fontFamily: tokens.font.mono
              }}>{step.num}</div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>{step.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
      )}

      {/* Right panel — registration form */}
      <div style={{
        flex: isMobile ? '1 1 100%' : '1 1 50%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: isMobile ? '40px 20px' : '64px 48px', position: 'relative', zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ width: '100%', maxWidth: '400px' }}
        >
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 6px', fontFamily: tokens.font.heading }}>Crear cuenta</h2>
          <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '0 0 28px' }}>Completá tus datos para comenzar tu prueba gratuita</p>

          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Nombre completo</label>
              <input required placeholder="Ej: Marcelo González" value={formData.name} onChange={e => update('name', e.target.value)}
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Empresa / Estudio</label>
              <input required placeholder="Ej: Constructora del Plata S.A." value={formData.company} onChange={e => update('company', e.target.value)}
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Email corporativo</label>
              <input type="email" required placeholder="marcelo@constructora.com" value={formData.email} onChange={e => update('email', e.target.value)}
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Contraseña</label>
              <input type="password" required placeholder="Mínimo 8 caracteres" value={formData.password} onChange={e => update('password', e.target.value)}
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
              style={{
                padding: '14px', borderRadius: '12px', background: '#f59e0b', color: '#050810',
                fontWeight: 800, fontSize: '0.92rem', border: 'none', cursor: 'pointer', marginTop: '6px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.2)'
              }}>
              {loading ? 'Creando cuenta...' : 'Comenzar prueba gratuita'}
            </motion.button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>o probá la demo</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleDemoLogin('director')} disabled={loading}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer'
            }}>
            Explorar demo sin registro
          </motion.button>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.82rem', color: '#64748b' }}>
            ¿Ya tenés cuenta?{' '}
            <Link href="/sign-in" style={{ color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>Iniciar sesión</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
