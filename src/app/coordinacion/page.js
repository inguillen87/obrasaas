"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, Tabs, PageHeader, Modal } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

// Preloaded construction demo photos for quick markup
const SAMPLE_SITE_PHOTOS = [
    {
        id: 'sample-1',
        name: 'Pase de Cañería en Losa',
        url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1000&q=80',
        sector: 'Losa Nivel +2 — Sector Baño'
    },
    {
        id: 'sample-2',
        name: 'Frente & Revoque Grueso',
        url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80',
        sector: 'Planta Baja — Eje Medianero'
    },
    {
        id: 'sample-3',
        name: 'Encofrado & Armadura Columnas',
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80',
        sector: 'Piso 1 — Borde Libre'
    },
    {
        id: 'sample-4',
        name: 'Instalación Sanitaria y Codos',
        url: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1000&q=80',
        sector: 'Subsuelo — Colector General'
    }
];

export default function CoordinacionVisualPage() {
    const { isMobile, isTablet } = useBreakpoint();
    const [activeTab, setActiveTab] = useState('nueva_alerta');
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({ total: 0, pendientes: 0, enCorreccion: 0, resueltos: 0, criticos: 0 });
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sseConnected, setSseConnected] = useState(false);

    // Canvas Markup State
    const canvasRef = useRef(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [currentPhotoUrl, setCurrentPhotoUrl] = useState(SAMPLE_SITE_PHOTOS[0].url);
    const [currentTool, setCurrentTool] = useState('pen'); // 'pen' | 'arrow' | 'circle' | 'rect' | 'text'
    const [strokeColor, setStrokeColor] = useState('#ef4444'); // Red by default
    const [lineWidth, setLineWidth] = useState(4);
    const [textInput, setTextInput] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [history, setHistory] = useState([]);
    const [textPosition, setTextPosition] = useState(null);
    const [isWritingText, setIsWritingText] = useState(false);

    // Form Data State
    const [formData, setFormData] = useState({
        title: 'Falta pase cloacal de 110 antes de colar hormigón',
        sector: 'Losa Nivel +2 — Baño Principal',
        assignedTo: 'Luis Martínez',
        assignedRole: 'Plomero / Gasista',
        assignedPhone: '+54 9 11 8899-7766',
        assignedBy: 'Arq. Victoria (Directora Técnica)',
        urgency: 'CRITICA',
        deadline: 'Mañana, 12:00 hs',
        description: 'Verificar ubicación de caño según plano sanitario ARQ-P03 y sellar con cinta antes del camión de hormigón elaborado.'
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(null);

    // Image Zoom Modal
    const [zoomModal, setZoomModal] = useState({ open: false, alert: null });

    // Load Data
    const loadAlerts = useCallback(async () => {
        try {
            const res = await fetch('/api/v1/coordinacion');
            const data = await res.json();
            if (data.success) {
                setAlerts(data.alerts || []);
                setStats(data.stats || {});
                if (data.workers && data.workers.length > 0) {
                    setWorkers(data.workers);
                }
            }
        } catch (err) {
            console.error('Error loading coordination alerts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAlerts();
    }, [loadAlerts]);

    // SSE Real-Time Sync
    useEffect(() => {
        const es = new EventSource('/api/realtime');
        es.onopen = () => setSseConnected(true);
        es.onerror = () => setSseConnected(false);
        es.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                if (update.type === 'STATE_UPDATE') {
                    loadAlerts();
                }
            } catch (e) {}
        };
        return () => {
            es.close();
            setSseConnected(false);
        };
    }, [loadAlerts]);

    // Initialize Canvas with Image
    const initCanvasWithImage = useCallback((imgSrc) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            // Set canvas dimensions maintaining aspect ratio, capped at max container
            const maxWidth = isMobile ? 340 : 640;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setImageLoaded(true);

            // Save clean baseline snapshot in history
            const baseline = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory([baseline]);
        };
        img.src = imgSrc;
    }, [isMobile]);

    useEffect(() => {
        initCanvasWithImage(currentPhotoUrl);
    }, [currentPhotoUrl, initCanvasWithImage]);

    // Canvas Drawing Helpers
    const getCanvasPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleMouseDown = (e) => {
        if (!imageLoaded) return;
        const pos = getCanvasPos(e);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (currentTool === 'text') {
            setTextPosition(pos);
            setIsWritingText(true);
            return;
        }

        setIsDrawing(true);
        setStartPos(pos);

        if (currentTool === 'pen') {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !imageLoaded) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const currentPos = getCanvasPos(e);

        if (currentTool === 'pen') {
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
        } else if (currentTool === 'arrow' || currentTool === 'circle' || currentTool === 'rect') {
            // Restore previous snapshot for smooth drag-preview
            if (history.length > 0) {
                ctx.putImageData(history[history.length - 1], 0, 0);
            }

            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = strokeColor;
            ctx.lineWidth = lineWidth;

            if (currentTool === 'rect') {
                const w = currentPos.x - startPos.x;
                const h = currentPos.y - startPos.y;
                ctx.strokeRect(startPos.x, startPos.y, w, h);
            } else if (currentTool === 'circle') {
                const radius = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
                ctx.beginPath();
                ctx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (currentTool === 'arrow') {
                drawArrow(ctx, startPos.x, startPos.y, currentPos.x, currentPos.y);
            }
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory(prev => [...prev, snap]);
        }
    };

    const drawArrow = (ctx, fromX, fromY, toX, toY) => {
        const headlen = 16;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(toX, toY);
        ctx.fill();
    };

    const applyTextToCanvas = () => {
        if (!textInput.trim() || !textPosition) {
            setIsWritingText(false);
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.font = 'bold 16px Inter, sans-serif';
        const text = textInput.toUpperCase();
        const metrics = ctx.measureText(text);
        const padding = 6;
        const boxWidth = metrics.width + padding * 2;
        const boxHeight = 26;

        // Draw contrast background box
        ctx.fillStyle = strokeColor;
        ctx.fillRect(textPosition.x, textPosition.y - boxHeight + 4, boxWidth, boxHeight);

        // Draw white text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, textPosition.x + padding, textPosition.y - 4);

        // Save to history
        const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev, snap]);

        setTextInput('');
        setTextPosition(null);
        setIsWritingText(false);
    };

    const handleUndo = () => {
        if (history.length <= 1) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const newHistory = history.slice(0, -1);
        ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        setHistory(newHistory);
    };

    const handleResetCanvas = () => {
        initCanvasWithImage(currentPhotoUrl);
    };

    // Worker Selection Helper
    const handleWorkerSelect = (e) => {
        const selectedName = e.target.value;
        const found = workers.find(w => w.name === selectedName);
        if (found) {
            setFormData(prev => ({
                ...prev,
                assignedTo: found.name,
                assignedRole: found.trade || found.role || 'Cuadrilla',
                assignedPhone: found.phone || ''
            }));
        } else {
            setFormData(prev => ({ ...prev, assignedTo: selectedName }));
        }
    };

    // Form Submit (Create Alert & Dispatch WhatsApp)
    const handleSubmitAlert = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitSuccess(null);

        try {
            // Get marked-up image from canvas as Data URL
            const canvas = canvasRef.current;
            const annotatedDataUrl = canvas ? canvas.toDataURL('image/jpeg', 0.85) : currentPhotoUrl;

            const payload = {
                ...formData,
                originalPhotoUrl: currentPhotoUrl,
                annotatedPhotoUrl: annotatedDataUrl,
                markupData: {
                    toolUsed: currentTool,
                    strokeColor
                }
            };

            const res = await fetch('/api/v1/coordinacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                setSubmitSuccess({
                    alert: data.alert,
                    whatsappSent: data.alert?.whatsappAlertSent
                });
                loadAlerts();
                setTimeout(() => {
                    setActiveTab('tablero');
                }, 2000);
            }
        } catch (err) {
            console.error('Error submitting visual alert:', err);
        } finally {
            setSubmitting(false);
        }
    };

    // Quick Status Transition (e.g., mark as RESOLVED or APPROVED)
    const handleStatusTransition = async (alertId, newStatus) => {
        try {
            const res = await fetch('/api/v1/coordinacion', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: alertId,
                    status: newStatus,
                    signedBy: 'Arq. Victoria & Arq. Marcelo'
                })
            });
            if (res.ok) {
                loadAlerts();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const tabs = [
        { id: 'nueva_alerta', label: '📸 Nueva Alerta con Marcación', icon: '✏️' },
        { id: 'tablero', label: `📋 Tablero de Tareas (${alerts.length})`, icon: '📊' },
        { id: 'matriz', label: '🛡️ Matriz de Responsabilidad', icon: '👷' }
    ];

    return (
        <div style={{ minHeight: '100vh', background: tokens.colors.bg.primary, color: tokens.colors.text.primary, fontFamily: tokens.font.sans }}>
            {/* Page Header */}
            <PageHeader
                title="Coordinación de Tareas & Alertas Visuales"
                subtitle="Detección de vicios de obra con marcación interactiva sobre foto y notificación directa por WhatsApp al responsable"
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Coordinación Visual' }]}
                actions={
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {sseConnected && (
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>🟢</motion.span> En Vivo
                            </motion.div>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setActiveTab('tablero')}>📋 Ver Tablero</Button>
                        <Button variant="primary" size="sm" icon="+" onClick={() => setActiveTab('nueva_alerta')}>Nueva Alerta</Button>
                    </div>
                }
            />

            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 clamp(16px, 4vw, 32px) 60px' }}>
                {/* Stats Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    <StatCard
                        title="Alertas Críticas"
                        value={stats.criticos}
                        icon="🚨"
                        trend="Bloqueantes de colada"
                        variant="danger"
                    />
                    <StatCard
                        title="En Corrección"
                        value={stats.enCorreccion}
                        icon="🔨"
                        trend="Operarios notificados"
                        variant="warning"
                    />
                    <StatCard
                        title="Resueltas en Obra"
                        value={stats.resueltos}
                        icon="✅"
                        trend="Listas para inspección"
                        variant="success"
                    />
                    <StatCard
                        title="Aprobadas Dirección"
                        value={stats.aprobados}
                        icon="🏆"
                        trend="Con firma SHA-256"
                        variant="primary"
                    />
                </div>

                {/* Tabs */}
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} style={{ marginBottom: '28px' }} />

                <AnimatePresence mode="wait">
                    {/* TAB 1: NUEVA ALERTA CON MARCACIÓN VISUAL */}
                    {activeTab === 'nueva_alerta' && (
                        <motion.div key="tab-nueva" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isTablet || isMobile ? '1fr' : '1.2fr 1fr', gap: '28px', alignItems: 'flex-start' }}>
                                
                                {/* Left Column: Photo Markup Editor */}
                                <GlassCard style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div>
                                            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>📸 Editor de Foto-Observación</h3>
                                            <p style={{ fontSize: '13px', color: tokens.colors.text.secondary, margin: '2px 0 0' }}>Marcá el problema directamente sobre la foto antes de despachar</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <Button variant="secondary" size="xs" onClick={handleUndo} disabled={history.length <= 1}>↩️ Deshacer</Button>
                                            <Button variant="secondary" size="xs" onClick={handleResetCanvas}>🧹 Limpiar</Button>
                                        </div>
                                    </div>

                                    {/* Sample Photo Selectors */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: tokens.colors.text.secondary, marginBottom: '6px' }}>Seleccionar Foto de Obra:</div>
                                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                                            {SAMPLE_SITE_PHOTOS.map(sp => (
                                                <div
                                                    key={sp.id}
                                                    onClick={() => {
                                                        setCurrentPhotoUrl(sp.url);
                                                        setFormData(prev => ({ ...prev, sector: sp.sector }));
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        border: currentPhotoUrl === sp.url ? `2px solid ${tokens.colors.accent.primary}` : '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '8px',
                                                        overflow: 'hidden',
                                                        minWidth: '80px',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={sp.url} alt={sp.name} style={{ width: '80px', height: '55px', objectFit: 'cover', display: 'block' }} />
                                                    <div style={{ fontSize: '10px', padding: '2px 4px', background: 'rgba(0,0,0,0.7)', color: '#fff', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sp.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Markup Toolbar */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: tokens.colors.text.secondary, fontWeight: 600 }}>Herramienta:</span>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentTool('pen')}
                                            style={{ background: currentTool === 'pen' ? tokens.colors.accent.primary : 'transparent', color: currentTool === 'pen' ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ✏️ Trazo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentTool('arrow')}
                                            style={{ background: currentTool === 'arrow' ? tokens.colors.accent.primary : 'transparent', color: currentTool === 'arrow' ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ➡️ Flecha
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentTool('circle')}
                                            style={{ background: currentTool === 'circle' ? tokens.colors.accent.primary : 'transparent', color: currentTool === 'circle' ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ⭕ Círculo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentTool('rect')}
                                            style={{ background: currentTool === 'rect' ? tokens.colors.accent.primary : 'transparent', color: currentTool === 'rect' ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            🔲 Caja
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentTool('text')}
                                            style={{ background: currentTool === 'text' ? tokens.colors.accent.primary : 'transparent', color: currentTool === 'text' ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            🔤 Texto
                                        </button>

                                        <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

                                        {/* Color Selector */}
                                        <span style={{ fontSize: '12px', color: tokens.colors.text.secondary, fontWeight: 600 }}>Color:</span>
                                        {[
                                            { color: '#ef4444', label: 'Rojo' },
                                            { color: '#f59e0b', label: 'Amarillo' },
                                            { color: '#10b981', label: 'Verde' },
                                            { color: '#3b82f6', label: 'Azul' }
                                        ].map(c => (
                                            <div
                                                key={c.color}
                                                onClick={() => setStrokeColor(c.color)}
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    background: c.color,
                                                    cursor: 'pointer',
                                                    border: strokeColor === c.color ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.5)',
                                                    boxShadow: strokeColor === c.color ? '0 0 8px ' + c.color : 'none'
                                                }}
                                                title={c.label}
                                            />
                                        ))}

                                        <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

                                        {/* Line Width */}
                                        <select
                                            value={lineWidth}
                                            onChange={(e) => setLineWidth(Number(e.target.value))}
                                            style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '3px 6px', fontSize: '11px' }}
                                        >
                                            <option value="2" style={{ background: '#111' }}>Fino (2px)</option>
                                            <option value="4" style={{ background: '#111' }}>Medio (4px)</option>
                                            <option value="8" style={{ background: '#111' }}>Grueso (8px)</option>
                                        </select>
                                    </div>

                                    {/* Text Overlay Input (when text tool clicked) */}
                                    {isWritingText && (
                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'rgba(0,0,0,0.9)', padding: '12px', borderRadius: '8px', border: `1px solid ${strokeColor}`, marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                placeholder="Escribí el texto para la foto (ej: REPARAR CAÑO 110)..."
                                                value={textInput}
                                                onChange={(e) => setTextInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') applyTextToCanvas(); }}
                                                autoFocus
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                                            />
                                            <Button variant="primary" size="xs" onClick={applyTextToCanvas}>Fijar Texto</Button>
                                            <Button variant="secondary" size="xs" onClick={() => setIsWritingText(false)}>Cancelar</Button>
                                        </motion.div>
                                    )}

                                    {/* Canvas Container */}
                                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#000', display: 'flex', justifyContent: 'center' }}>
                                        <canvas
                                            ref={canvasRef}
                                            onMouseDown={handleMouseDown}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                            onTouchStart={handleMouseDown}
                                            onTouchMove={handleMouseMove}
                                            onTouchEnd={handleMouseUp}
                                            style={{
                                                cursor: currentTool === 'text' ? 'text' : 'crosshair',
                                                display: 'block',
                                                maxWidth: '100%',
                                                height: 'auto'
                                            }}
                                        />
                                        {!imageLoaded && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', color: '#fff' }}>
                                                Cargando imagen para marcación...
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: tokens.colors.text.secondary, textAlign: 'center' }}>
                                        💡 Hacé clic y arrastrá sobre la foto para dibujar flechas, círculos o colocar texto con fondo legible.
                                    </div>
                                </GlassCard>

                                {/* Right Column: Task Coordination & WhatsApp Dispatch Form */}
                                <GlassCard style={{ padding: '24px' }}>
                                    <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>👷 Coordinación & Despacho WhatsApp</h3>
                                    <p style={{ fontSize: '13px', color: tokens.colors.text.secondary, margin: '0 0 20px' }}>
                                        El responsable recibirá un WhatsApp instantáneo con la foto marcada y el plazo límite.
                                    </p>

                                    <form onSubmit={handleSubmitAlert} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Título */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Título del Problema / Vicio *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="Ej: Falta pase cloacal de 110mm en losa PB"
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '14px', outline: 'none' }}
                                            />
                                        </div>

                                        {/* Sector y Urgencia */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Sector en Obra</label>
                                                <input
                                                    type="text"
                                                    value={formData.sector}
                                                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                                    placeholder="Ej: Losa Nivel +2 - Baño"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Urgencia</label>
                                                <select
                                                    value={formData.urgency}
                                                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
                                                >
                                                    <option value="CRITICA" style={{ background: '#111' }}>🚨 Crítica (Bloqueante)</option>
                                                    <option value="ALTA" style={{ background: '#111' }}>⚠️ Alta (24 hs)</option>
                                                    <option value="MEDIA" style={{ background: '#111' }}>ℹ️ Media (48 hs)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Responsable Asignado */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Responsable Asignado *</label>
                                                <select
                                                    value={formData.assignedTo}
                                                    onChange={handleWorkerSelect}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
                                                >
                                                    <option value="Luis Martínez" style={{ background: '#111' }}>Luis Martínez (Plomero)</option>
                                                    <option value="Juan Gómez" style={{ background: '#111' }}>Juan Gómez (Albañil Principal)</option>
                                                    <option value="Carlos Pérez" style={{ background: '#111' }}>Carlos Pérez (Pintor)</option>
                                                    <option value="Juan Zapata" style={{ background: '#111' }}>Juan Zapata (Armador)</option>
                                                    <option value="Aberturas López" style={{ background: '#111' }}>Aberturas López (Proveedor)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>WhatsApp Móvil</label>
                                                <input
                                                    type="text"
                                                    value={formData.assignedPhone}
                                                    onChange={(e) => setFormData({ ...formData, assignedPhone: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Plazo Límite & Asignado Por */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Plazo Límite (Deadline)</label>
                                                <input
                                                    type="text"
                                                    value={formData.deadline}
                                                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                                    placeholder="Ej: Mañana 12:00 hs"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Emitido Por</label>
                                                <input
                                                    type="text"
                                                    value={formData.assignedBy}
                                                    onChange={(e) => setFormData({ ...formData, assignedBy: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Instrucción Técnica Detallada */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: tokens.colors.text.secondary }}>Instrucción Técnica / Detalle de Acción</label>
                                            <textarea
                                                rows={3}
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Describí exactamente qué debe solucionar el operario antes de dar por terminada la tarea..."
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                                            />
                                        </div>

                                        {/* WhatsApp Preview Box */}
                                        <div style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.25)', borderRadius: '10px', padding: '14px', fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#25D366', fontWeight: 700, marginBottom: '6px' }}>
                                                <span>📱 Preview Mensaje WhatsApp:</span>
                                            </div>
                                            <div>🚨 *ALERTA DE TAREA PENDIENTE — ObraSaaS*</div>
                                            <div>👤 Hola *{formData.assignedTo}*, se te asignó:</div>
                                            <div>📍 Sector: *{formData.sector}* | Plazo: *{formData.deadline}*</div>
                                            <div>📋 *{formData.title}*</div>
                                            <div style={{ color: '#94a3b8', marginTop: '4px' }}>📸 [Foto con Marcaciones Visuales Adjunta]</div>
                                        </div>

                                        {/* Feedback message */}
                                        {submitSuccess && (
                                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
                                                ✅ ¡Alerta creada exitosamente! {submitSuccess.whatsappSent ? '📲 Mensaje enviado por WhatsApp al responsable.' : '📋 Registrada en el tablero de obra.'}
                                            </motion.div>
                                        )}

                                        {/* Submit Button */}
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="md"
                                            disabled={submitting}
                                            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700, justifyContent: 'center' }}
                                        >
                                            {submitting ? '⏳ Despachando por WhatsApp...' : '🚀 Emitir Alerta & Despachar por WhatsApp'}
                                        </Button>
                                    </form>
                                </GlassCard>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 2: TABLERO DE SEGUIMIENTO (KANBAN / CARDS) */}
                    {activeTab === 'tablero' && (
                        <motion.div key="tab-tablero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                                {alerts.map(alert => {
                                    const isCritical = alert.urgency === 'CRITICA';
                                    const isResolved = alert.status === 'RESUELTO';
                                    const isApproved = alert.status === 'APROBADO_DIRECCION';
                                    const isEnCorreccion = alert.status === 'EN_CORRECCION';

                                    const statusBadge = isApproved ? { label: 'APROBADO CON SELLO SHA-256', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
                                        : isResolved ? { label: 'RESUELTO — PENDIENTE REVISIÓN', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }
                                        : isEnCorreccion ? { label: 'EN CORRECCIÓN EN PREDIO', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
                                        : { label: 'PENDIENTE DE ATENCIÓN', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };

                                    const cleanPhone = (alert.assignedPhone || '').replace(/\D/g, '');
                                    const waChatUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${alert.assignedTo}, te escribo por la alerta de obra: "${alert.title}" en ${alert.sector}.`)}` : '#';

                                    return (
                                        <GlassCard key={alert.id} hover style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${isCritical ? '#ef4444' : '#f59e0b'}` }}>
                                            {/* Top Status & Urgency */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: statusBadge.bg, color: statusBadge.color }}>
                                                    {statusBadge.label}
                                                </span>
                                                {isCritical && (
                                                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        🚨 BLOQUEANTE
                                                    </span>
                                                )}
                                            </div>

                                            {/* Photo with Markup (Click to zoom) */}
                                            {alert.annotatedPhotoUrl && (
                                                <div
                                                    onClick={() => setZoomModal({ open: true, alert })}
                                                    style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', height: '180px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={alert.annotatedPhotoUrl}
                                                        alt={alert.title}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        🔍 Ver Marcación
                                                    </div>
                                                </div>
                                            )}

                                            {/* Title & Description */}
                                            <div>
                                                <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', lineHeight: 1.3 }}>{alert.title}</h4>
                                                <p style={{ fontSize: '13px', color: tokens.colors.text.secondary, margin: 0, lineHeight: 1.4 }}>{alert.description}</p>
                                            </div>

                                            {/* Sector & Assignee Meta */}
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div>📍 <strong>Sector:</strong> {alert.sector}</div>
                                                <div>👤 <strong>Asignado a:</strong> {alert.assignedTo} ({alert.assignedRole})</div>
                                                <div>⏰ <strong>Plazo Límite:</strong> {alert.deadline}</div>
                                                <div>✍️ <strong>Emitido por:</strong> {alert.assignedBy}</div>
                                            </div>

                                            {/* WhatsApp Dispatch Confirmation Badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#25D366', fontWeight: 600 }}>
                                                    <span>📲 WhatsApp Enviado</span>
                                                </div>
                                                <a
                                                    href={waChatUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ textDecoration: 'none', color: tokens.colors.accent.primary, fontWeight: 600, fontSize: '12px' }}
                                                >
                                                    💬 Abrir Chat
                                                </a>
                                            </div>

                                            {/* Action Buttons */}
                                            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                                                {!isResolved && !isApproved && (
                                                    <>
                                                        {!isEnCorreccion && (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                style={{ flex: 1 }}
                                                                onClick={() => handleStatusTransition(alert.id, 'EN_CORRECCION')}
                                                            >
                                                                🔨 En Curso
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            style={{ flex: 1 }}
                                                            onClick={() => handleStatusTransition(alert.id, 'RESUELTO')}
                                                        >
                                                            ✅ Marcar Resuelto
                                                        </Button>
                                                    </>
                                                )}
                                                {isResolved && !isApproved && (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        style={{ width: '100%', background: '#10b981', borderColor: '#10b981' }}
                                                        onClick={() => handleStatusTransition(alert.id, 'APROBADO_DIRECCION')}
                                                    >
                                                        🏆 Aprobar & Sello SHA-256
                                                    </Button>
                                                )}
                                                {isApproved && (
                                                    <div style={{ width: '100%', textAlign: 'center', fontSize: '12px', color: '#10b981', fontWeight: 700, padding: '6px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                                                        🔐 Certificado con Hash: {alert.hash?.substring(0, 12)}...
                                                    </div>
                                                )}
                                            </div>
                                        </GlassCard>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 3: MATRIZ DE RESPONSABILIDAD */}
                    {activeTab === 'matriz' && (
                        <motion.div key="tab-matriz" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <GlassCard style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>🛡️ Trazabilidad de Responsabilidades & Tareas Inter-Gremio</h3>
                                <p style={{ fontSize: '13px', color: tokens.colors.text.secondary, marginBottom: '20px' }}>
                                    Registro inmutable de alertas visuales emitidas por la Dirección Técnica (Arq. Victoria) y Dirección General (Marcelo Guillén).
                                </p>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', color: tokens.colors.text.secondary }}>
                                                <th style={{ padding: '12px 8px' }}>Ticket ID</th>
                                                <th style={{ padding: '12px 8px' }}>Vicio / Tarea</th>
                                                <th style={{ padding: '12px 8px' }}>Sector</th>
                                                <th style={{ padding: '12px 8px' }}>Responsable</th>
                                                <th style={{ padding: '12px 8px' }}>Urgencia</th>
                                                <th style={{ padding: '12px 8px' }}>Estado</th>
                                                <th style={{ padding: '12px 8px' }}>Hash SHA-256</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {alerts.map(a => (
                                                <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: tokens.colors.accent.primary }}>{a.id}</td>
                                                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{a.title}</td>
                                                    <td style={{ padding: '12px 8px', color: tokens.colors.text.secondary }}>{a.sector}</td>
                                                    <td style={{ padding: '12px 8px' }}>{a.assignedTo}</td>
                                                    <td style={{ padding: '12px 8px' }}>
                                                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: a.urgency === 'CRITICA' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: a.urgency === 'CRITICA' ? '#ef4444' : '#f59e0b' }}>
                                                            {a.urgency}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{a.status}</td>
                                                    <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{a.hash?.substring(0, 16)}...</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Photo Zoom Modal */}
            <Modal
                isOpen={zoomModal.open}
                onClose={() => setZoomModal({ open: false, alert: null })}
                title={`Marcación Técnica: ${zoomModal.alert?.title || ''}`}
            >
                {zoomModal.alert && (
                    <div style={{ textAlign: 'center' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={zoomModal.alert.annotatedPhotoUrl}
                            alt={zoomModal.alert.title}
                            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }}
                        />
                        <div style={{ marginTop: '14px', fontSize: '13px', color: tokens.colors.text.secondary, textAlign: 'left', background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px' }}>
                            <div>📍 <strong>Sector:</strong> {zoomModal.alert.sector}</div>
                            <div>👤 <strong>Responsable:</strong> {zoomModal.alert.assignedTo} ({zoomModal.alert.assignedPhone})</div>
                            <div>📝 <strong>Instrucción:</strong> {zoomModal.alert.description}</div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
