"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/design-system';

export default function SignUpPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('obrasaas_company_name', companyName);
      localStorage.setItem('obrasaas_demo_mode', 'true');
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
        {/* Fast Demo Banner */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(12px)'
        }}>
          <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            ¿Querés ver la demo interactiva primero?
          </span>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '6px 12px',
              background: '#f59e0b',
              color: '#060913',
              fontWeight: 800,
              fontSize: '0.75rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer'
            }}>
              Abrir Demo 🚀
            </button>
          </Link>
        </div>

        {/* SignUp Card */}
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
              Comenzá tu Prueba Gratis
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
              14 días de acceso completo • Sin tarjeta de crédito
            </p>
          </div>

          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Empresa Constructora / Estudio
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Constructora del Plata S.A."
                style={{
                  width: '100%',
                  padding: '11px 14px',
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
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Correo Corporativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="direccion@constructora.com"
                style={{
                  width: '100%',
                  padding: '11px 14px',
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
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Celular / WhatsApp
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 9 11 5555-6666"
                style={{
                  width: '100%',
                  padding: '11px 14px',
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
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                style={{
                  width: '100%',
                  padding: '11px 14px',
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
              {loading ? 'Creando Espacio...' : 'Crear Cuenta Gratis →'}
            </button>
          </form>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
            ¿Ya tenés una cuenta?{' '}
            <Link href="/sign-in" style={{ color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>
              Iniciar Sesión
            </Link>
          </div>
        </div>

        {/* Security badges footer */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.75rem', color: '#64748b' }}>
          <span>🔒 Cifrado SHA-256</span>
          <span>⚖️ Cumplimiento Ley 22.250</span>
        </div>
      </div>
    </div>
  );
}
