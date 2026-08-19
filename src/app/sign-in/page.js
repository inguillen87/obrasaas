"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { tokens } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    }
    setTimeout(() => router.push('/dashboard'), 400);
  };

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
        <div style={{ position: 'absolute', top: '-20%', right: '5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%)', filter: 'blur(100px)' }} />
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
          style={{ fontSize: '2.6rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 16px', fontFamily: tokens.font.heading, maxWidth: '420px' }}
        >
          Gestioná tu obra desde{' '}
          <span style={{ color: '#f59e0b' }}>cualquier lugar</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          style={{ fontSize: '1.05rem', color: '#64748b', lineHeight: 1.6, maxWidth: '400px', margin: 0 }}
        >
          WhatsApp como interfaz, inteligencia artificial como motor, y cumplimiento normativo argentino nativo.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.16 }}
          style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          {[
            { label: 'Control de avance en tiempo real', detail: 'Gantt, Curva S, certificaciones SHA-256' },
            { label: 'Compliance normativo', detail: 'Ley 22.250, CCT 76/75, ART, AFIP' },
            { label: 'Multi-tenant aislado', detail: 'Cada empresa con datos 100% independientes' }
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', marginTop: '7px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>{item.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
      )}

      {/* Right panel — login form */}
      <div style={{
        flex: isMobile ? '1 1 100%' : '1 1 50%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: isMobile ? '40px 20px' : '64px 48px', position: 'relative', zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ width: '100%', maxWidth: '400px' }}
        >
          {/* Quick access demo card */}
          <div style={{
            padding: '24px', borderRadius: '16px', marginBottom: '20px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            background: 'rgba(245, 158, 11, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', fontFamily: tokens.font.heading }}>Acceso rápido a la demo</span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Sin contraseña</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#8896ab', margin: '0 0 14px', lineHeight: 1.5 }}>
              Explorá el Dashboard con datos reales de obra: Gantt, Curva S, WhatsApp Bot, KYC biométrico y BIM 3D.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => handleDemoLogin('director')} disabled={loading}
                style={{
                  padding: '11px 14px', background: '#f59e0b', color: '#050810', fontWeight: 800,
                  fontSize: '0.82rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
                }}>
                Director de Obra
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => handleDemoLogin('socia')} disabled={loading}
                style={{
                  padding: '11px 14px', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
                  fontWeight: 700, fontSize: '0.82rem', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer'
                }}>
                Dir. Técnica
              </motion.button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>o accedé con tu cuenta</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Login form */}
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Email corporativo</label>
              <input type="email" required placeholder="nombre@constructora.com" value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Contraseña</label>
              <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
              style={{
                padding: '14px', borderRadius: '12px', background: '#f59e0b', color: '#050810',
                fontWeight: 800, fontSize: '0.92rem', border: 'none', cursor: 'pointer', marginTop: '4px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.2)'
              }}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </motion.button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.82rem', color: '#64748b' }}>
            ¿No tenés cuenta?{' '}
            <Link href="/sign-up" style={{ color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>Crear cuenta gratis</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
