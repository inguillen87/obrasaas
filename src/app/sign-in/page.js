"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/design-system';

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
    setTimeout(() => {
      router.push('/dashboard');
    }, 300);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('obrasaas_logged_in', 'true');
    }
    setTimeout(() => {
      router.push('/dashboard');
    }, 400);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060913',
      color: '#f8fafc',
      fontFamily: tokens.font.sans,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glows */}
      <div style={{ position: 'fixed', top: '-15%', left: '10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-15%', right: '10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Top Logo */}
      <div style={{ marginBottom: '32px', zIndex: 10, textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.2rem',
            color: '#060913',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.35)'
          }}>
            OS
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', fontFamily: tokens.font.heading, display: 'block', lineHeight: 1.1 }}>
              Obra<span style={{ color: '#f59e0b' }}>SaaS</span>
            </span>
            <span style={{ fontSize: '0.68rem', display: 'block', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Enterprise Platform
            </span>
          </div>
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
        {/* 1-Click Fast Demo Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ⚡ Acceso Inmediato
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sin Contraseña</span>
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: '0 0 4px', fontFamily: tokens.font.heading }}>
            ¿Querés explorar la plataforma en vivo?
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '0 0 14px', lineHeight: 1.5 }}>
            Entrá directo al Dashboard con datos precargados de obra real (Gantt, Curva S, Bot de WhatsApp, KYC y 3D BIM).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleDemoLogin('director')}
              disabled={loading}
              style={{
                padding: '10px 14px',
                background: '#f59e0b',
                color: '#060913',
                fontWeight: 800,
                fontSize: '0.8rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fbbf24'}
              onMouseLeave={e => e.currentTarget.style.background = '#f59e0b'}
            >
              👑 Modo Director
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('socia')}
              disabled={loading}
              style={{
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#f8fafc',
                fontWeight: 700,
                fontSize: '0.8rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#38bdf8'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
            >
              📐 Dir. Técnica
            </button>
          </div>
        </div>

        {/* Standard Login Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '28px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: '0 0 6px', fontFamily: tokens.font.heading }}>
              Iniciar Sesión
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
              Ingresá a tu cuenta corporativa de constructora
            </p>
          </div>

          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marcelo@tuconstructora.com"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(6, 9, 19, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Contraseña
                </label>
                <a href="#" style={{ fontSize: '0.72rem', color: '#f59e0b', textDecoration: 'none' }}>¿Olvidaste tu clave?</a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(6, 9, 19, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#060913',
                fontWeight: 800,
                fontSize: '0.9rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                marginTop: '6px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.92'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {loading ? 'Ingresando...' : 'Ingresar a la Plataforma →'}
            </button>
          </form>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
            ¿No tenés una cuenta todavía?{' '}
            <Link href="/sign-up" style={{ color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>
              Registrar mi Constructora
            </Link>
          </div>
        </div>

        {/* Security badges footer */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.75rem', color: '#64748b' }}>
          <span>🔒 Cifrado SHA-256</span>
          <span>⚖️ Cumplimiento UOCRA / Ley 22.250</span>
        </div>
      </div>
    </div>
  );
}
