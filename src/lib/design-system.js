// ObraSaaS Design System — Shared UI primitives with Framer Motion & Lucide Icons
"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { forwardRef, useState } from 'react';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════
// TOKENS & PALETTE
// ═══════════════════════════════════════════════════════════════

export const tokens = {
  colors: {
    bg: { 
      primary: '#060913',      // Deep obsidian void
      secondary: '#0b1120',    // Slate dark foundation
      card: 'rgba(15, 23, 42, 0.75)',       // Translucent card base
      cardHover: 'rgba(30, 41, 59, 0.85)',
      elevated: '#1e293b',
      glass: 'rgba(15, 23, 42, 0.7)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
    },
    accent: {
      primary: '#f59e0b',      // Construction Amber / Safety Gold
      primaryHover: '#fbbf24',
      primaryGlow: 'rgba(245, 158, 11, 0.25)',
      secondary: '#3b82f6',    // Electric Blue
      success: '#10b981',      // Emerald Green
      danger: '#ef4444',       // Crimson Red
      warning: '#f97316',      // Orange
      info: '#06b6d4',         // Cyan
      purple: '#8b5cf6',       // Violet
      whatsapp: '#22c55e',     // WhatsApp Green
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
      inverse: '#060913',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.07)',
      default: 'rgba(255, 255, 255, 0.12)',
      strong: 'rgba(255, 255, 255, 0.2)',
      glow: 'rgba(245, 158, 11, 0.3)',
    }
  },
  radius: { 
    xs: '4px',
    sm: '8px', 
    md: '12px', 
    lg: '16px', 
    xl: '22px', 
    full: '9999px' 
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.4)',
    md: '0 4px 16px rgba(0,0,0,0.35)',
    lg: '0 12px 36px rgba(0,0,0,0.5)',
    glow: (color = '#f59e0b') => `0 0 24px ${color}33, 0 0 48px ${color}15`,
  },
  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "'Outfit', 'Inter', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  }
};

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════

export const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 }
  }
};

export const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
};

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Glass Card with subtle border reflection & hover glow
export function GlassCard({ children, style, hover = true, glow = false, delay = 0, className = '', onClick, ...props }) {
  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      onClick={onClick}
      whileHover={hover ? { y: -2, borderColor: glow ? tokens.colors.border.glow : tokens.colors.border.strong } : undefined}
      style={{
        background: tokens.colors.bg.card,
        border: `1px solid ${tokens.colors.border.subtle}`,
        borderRadius: tokens.radius.lg,
        padding: '24px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: glow ? tokens.shadow.glow() : tokens.shadow.md,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// KPI Metric Stat Card with accent glow line
export function StatCard({ label, value, sub, icon, color = tokens.colors.accent.primary, trend, delay = 0, onClick }) {
  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      onClick={onClick}
      whileHover={{ y: -3, borderColor: `${color}44`, boxShadow: `0 10px 30px -10px ${color}22` }}
      style={{
        background: tokens.colors.bg.card,
        border: `1px solid ${tokens.colors.border.subtle}`,
        borderRadius: tokens.radius.lg,
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Top accent gradient line */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: '2px', 
          background: `linear-gradient(90deg, ${color}, transparent 80%)` 
        }} 
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={{ color: tokens.colors.text.muted, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {icon && (
          <span style={{ 
            fontSize: '1rem', 
            padding: '6px', 
            borderRadius: tokens.radius.sm, 
            background: `${color}15`, 
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </span>
        )}
      </div>

      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: tokens.font.heading }}>
        {value}
      </div>

      {(sub || trend !== undefined) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.72rem' }}>
          {sub && <span style={{ color: tokens.colors.text.secondary }}>{sub}</span>}
          {trend !== undefined && (
            <span style={{ 
              fontWeight: 700,
              color: trend >= 0 ? tokens.colors.accent.success : tokens.colors.accent.danger,
              background: trend >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              padding: '2px 8px', 
              borderRadius: tokens.radius.full,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              {trend >= 0 ? '↗ +' : '↘ '}{trend}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Progress Bar with animated fill and optional glow
export function ProgressBar({ value = 0, max = 100, color = tokens.colors.accent.primary, height = 6, showLabel = false, label, glow = false }) {
  const pct = Math.max(0, Math.min((value / max) * 100, 100));
  return (
    <div style={{ width: '100%' }}>
      {(showLabel || label) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.75rem' }}>
          <span style={{ color: tokens.colors.text.secondary, fontWeight: 500 }}>{label}</span>
          <span style={{ color, fontWeight: 700, fontFamily: tokens.font.mono }}>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div style={{ width: '100%', height, background: 'rgba(255,255,255,0.06)', borderRadius: tokens.radius.full, overflow: 'hidden', position: 'relative' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ 
            height: '100%', 
            background: `linear-gradient(90deg, ${color}dd, ${color})`, 
            borderRadius: tokens.radius.full,
            boxShadow: glow ? `0 0 10px ${color}88` : 'none'
          }}
        />
      </div>
    </div>
  );
}

// Status & Category Badges
export function Badge({ children, color = tokens.colors.accent.primary, variant = 'filled', size = 'sm', icon }) {
  const styles = {
    filled: { background: `${color}18`, color, border: `1px solid ${color}33` },
    outline: { background: 'transparent', color, border: `1px solid ${color}55` },
    solid: { background: color, color: tokens.colors.text.inverse, border: 'none' },
    subtle: { background: 'rgba(255, 255, 255, 0.05)', color: tokens.colors.text.secondary, border: `1px solid ${tokens.colors.border.subtle}` }
  };
  const sizes = {
    xs: { padding: '2px 6px', fontSize: '0.65rem' },
    sm: { padding: '3px 9px', fontSize: '0.72rem' },
    md: { padding: '5px 13px', fontSize: '0.82rem' }
  };
  return (
    <span style={{ 
      ...styles[variant], 
      ...sizes[size], 
      borderRadius: tokens.radius.full, 
      fontWeight: 600, 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '5px',
      letterSpacing: '0.01em',
      lineHeight: 1
    }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </span>
  );
}

// Premium Button with micro-interaction feedback
export const Button = forwardRef(function Button({ children, variant = 'primary', size = 'md', icon, loading, disabled, style: customStyle, ...props }, ref) {
  const variants = {
    primary: { 
      background: `linear-gradient(135deg, ${tokens.colors.accent.primary}, ${tokens.colors.accent.primaryHover})`, 
      color: '#060913', 
      border: 'none', 
      fontWeight: 700,
      boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
    },
    secondary: { 
      background: 'rgba(30, 41, 59, 0.7)', 
      color: tokens.colors.text.primary, 
      border: `1px solid ${tokens.colors.border.default}`, 
      fontWeight: 600,
      backdropFilter: 'blur(8px)'
    },
    ghost: { 
      background: 'transparent', 
      color: tokens.colors.text.secondary, 
      border: '1px solid transparent', 
      fontWeight: 500 
    },
    danger: { 
      background: `linear-gradient(135deg, ${tokens.colors.accent.danger}, #dc2626)`, 
      color: '#fff', 
      border: 'none', 
      fontWeight: 700,
      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
    },
    whatsapp: {
      background: `linear-gradient(135deg, #22c55e, #16a34a)`,
      color: '#fff',
      border: 'none',
      fontWeight: 700,
      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)'
    }
  };
  const sizes = {
    sm: { padding: '7px 14px', fontSize: '0.8rem', borderRadius: tokens.radius.sm },
    md: { padding: '10px 20px', fontSize: '0.88rem', borderRadius: tokens.radius.md },
    lg: { padding: '14px 28px', fontSize: '0.98rem', borderRadius: tokens.radius.lg },
  };

  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: disabled || loading ? 1 : 1.02, filter: 'brightness(1.08)' }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        ...sizes[size],
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '8px',
        opacity: disabled ? 0.5 : 1,
        fontFamily: tokens.font.sans,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        ...customStyle,
      }}
      {...props}
    >
      {loading && (
        <motion.span 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{ display: 'inline-flex', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }}
        />
      )}
      {icon && !loading && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </motion.button>
  );
});

// Interactive Tab Switcher with sliding pill highlight
// Interactive Tab Switcher with sliding pill highlight and responsive scroll
export function Tabs({ tabs, activeTab, onChange, color = tokens.colors.accent.primary }) {
  return (
    <div style={{
      display: 'inline-flex',
      maxWidth: '100%',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      background: 'rgba(15, 23, 42, 0.6)', 
      border: `1px solid ${tokens.colors.border.subtle}`, 
      borderRadius: tokens.radius.md, 
      padding: '4px',
      gap: '4px',
      backdropFilter: 'blur(10px)',
      whiteSpace: 'nowrap'
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
              fontSize: '0.82rem',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              borderRadius: tokens.radius.sm,
              transition: 'color 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabPill"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: tokens.radius.sm,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  zIndex: 0
                }}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
              {tab.badge !== undefined && (
                <span style={{ 
                  fontSize: '0.68rem', 
                  padding: '1px 6px', 
                  background: isActive ? `${color}25` : 'rgba(255,255,255,0.06)', 
                  color: isActive ? color : tokens.colors.text.muted, 
                  borderRadius: tokens.radius.full 
                }}>
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Universal Page Header with breadcrumbs & actions
export function PageHeader({ title, subtitle, icon, actions, breadcrumbs }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        padding: '20px clamp(16px, 4vw, 32px)',
        background: `linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(6, 9, 19, 0.6) 100%)`,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}
    >
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        {breadcrumbs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.74rem', color: tokens.colors.text.muted }}>
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
                {b.href ? (
                  <Link href={b.href} style={{ color: tokens.colors.text.secondary, textDecoration: 'none', transition: 'color 0.2s' }}>
                    {b.label}
                  </Link>
                ) : (
                  <span style={{ color: tokens.colors.accent.primary, fontWeight: 600 }}>{b.label}</span>
                )}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.45rem)', fontWeight: 800, margin: 0, color: tokens.colors.text.primary, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.03em', fontFamily: tokens.font.heading }}>
              {icon && <span style={{ fontSize: '1.3rem' }}>{icon}</span>}
              {title}
            </h1>
            {subtitle && <p style={{ color: tokens.colors.text.muted, fontSize: '0.82rem', margin: '4px 0 0', fontWeight: 400 }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </motion.header>
  );
}

// Modal with backdrop blur and spring animation
export function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = '540px' }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              borderRadius: tokens.radius.xl,
              padding: '24px clamp(16px, 4vw, 32px)',
              width: '100%',
              maxWidth,
              border: `1px solid ${tokens.colors.border.default}`,
              boxShadow: tokens.shadow.lg,
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                {title && <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: tokens.colors.text.primary, letterSpacing: '-0.02em' }}>{title}</h2>}
                {subtitle && <p style={{ color: tokens.colors.text.muted, fontSize: '0.8rem', margin: '4px 0 0' }}>{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: tokens.colors.text.muted,
                  width: '28px',
                  height: '28px',
                  borderRadius: tokens.radius.full,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem'
                }}
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Empty State Component
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        textAlign: 'center',
        padding: '36px 16px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: tokens.radius.lg,
        border: `1px dashed ${tokens.colors.border.default}`
      }}
    >
      <div style={{ fontSize: '2.8rem', marginBottom: '14px' }}>{icon}</div>
      <h3 style={{ color: tokens.colors.text.primary, fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px' }}>{title}</h3>
      {description && <p style={{ color: tokens.colors.text.muted, fontSize: '0.82rem', maxWidth: '380px', margin: '0 auto 20px', lineHeight: 1.5 }}>{description}</p>}
      {action}
    </motion.div>
  );
}
