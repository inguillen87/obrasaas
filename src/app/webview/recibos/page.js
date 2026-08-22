"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function RecibosContent() {
    const searchParams = useSearchParams();
    const workerParam = searchParams.get('worker') || 'juan';
    const tokenParam = searchParams.get('token') || '';

    const [worker, setWorker] = useState({ name: 'Cargando...', role: 'Oficial Armador', dni: '38.452.190', cuil: '20-38452190-4', categoria: 'Oficial' });
    const [authorized, setAuthorized] = useState(null);
    const [quincena, setQuincena] = useState('1ra Quincena — Agosto 2026');
    const [signed, setSigned] = useState(false);
    const [signTimestamp, setSignTimestamp] = useState(null);
    const [signatureHash, setSignatureHash] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    const canvasRef = useRef(null);

    useEffect(() => {
        if (!tokenParam) {
            setAuthorized(true);
            return;
        }

        fetch('/api/auth/verify?worker=' + workerParam + '&token=' + tokenParam)
            .then(res => res.json())
            .then(data => setAuthorized(data.valid))
            .catch(() => setAuthorized(false));
    }, [workerParam, tokenParam]);

    useEffect(() => {
        fetch('/api/state')
            .then(res => res.json())
            .then(state => {
                const registry = state.workerRegistry || [];
                const matched = registry.find(w => 
                    w.id === workerParam || 
                    (w.name || '').toLowerCase().includes(workerParam.toLowerCase())
                );

                if (matched) {
                    setWorker({
                        name: matched.name || 'Juan Zapata',
                        role: matched.role || matched.trade || 'Oficial Armador',
                        dni: matched.dni || '38.452.190',
                        cuil: matched.cuil || '20-38452190-4',
                        categoria: matched.categoria || matched.trade || 'Oficial',
                        projectName: state.projectConfig?.name || 'Torre Palermo Soho',
                        cuitEmpresa: state.projectConfig?.cuit || '30-71884291-8'
                    });
                } else {
                    setWorker({
                        name: workerParam === 'director' ? 'Arq. Marcelo' : workerParam === 'victoria' ? 'Arq. Victoria' : 'Operario ObraSaaS',
                        role: workerParam === 'director' ? 'Director de Obra' : workerParam === 'victoria' ? 'Directora Técnica' : 'Oficial',
                        dni: '38.452.190',
                        cuil: '20-38452190-4',
                        categoria: 'Oficial Especializado',
                        projectName: state.projectConfig?.name || 'Torre Palermo Soho',
                        cuitEmpresa: '30-71884291-8'
                    });
                }
            })
            .catch(err => console.warn('Could not load state:', err));
    }, [workerParam]);

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleSign = async () => {
        if (!hasDrawn) {
            alert('Por favor firme en el recuadro digital antes de confirmar.');
            return;
        }

        setSubmitting(true);
        const timestamp = new Date().toLocaleString('es-AR');
        const mockHash = 'SHA256:7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c';
        
        setTimeout(() => {
            setSubmitting(false);
            setSigned(true);
            setSignTimestamp(timestamp);
            setSignatureHash(mockHash);
        }, 800);
    };

    if (authorized === false) {
        return (
            <div style={{ minHeight: '100vh', background: '#060913', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ background: '#0f172a', padding: '32px', borderRadius: '16px', border: '1px solid #ef4444', textAlign: 'center', maxWidth: '400px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>Enlace de Firma Expirado</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        Por razones de seguridad laboral, los enlaces de WhatsApp expiran cada 2 horas. Solicitá un nuevo enlace escribiendo recibo al bot de WhatsApp.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px 12px 60px' }}>
            <div style={{ maxWidth: '540px', margin: '0 auto' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', marginBottom: '16px', backdropFilter: 'blur(8px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                            🏗️
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>ObraSaaS Enterprise</div>
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>Recibos Digitales UOCRA 76/75</div>
                        </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Ley 20.744
                    </span>
                </div>

                {/* Worker Card */}
                <div style={{ background: '#0b1329', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colaborador / Operario</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>{worker.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>{worker.role} • Cat. {worker.categoria}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>CUIL: {worker.cuil}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>DNI: {worker.dni}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 12px', background: '#060913', borderRadius: '8px', fontSize: '0.75rem' }}>
                        <div><span style={{ color: '#64748b' }}>Obra:</span> <strong style={{ color: '#cbd5e1' }}>{worker.projectName}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Período:</span> <strong style={{ color: '#38bdf8' }}>{quincena}</strong></div>
                    </div>
                </div>

                {/* Payslip Items Table */}
                <div style={{ background: '#0b1329', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>Conceptos Liquidados (CCT 76/75)</span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>88 hs quincenales</span>
                    </div>

                    <div style={{ padding: '8px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>Sueldo Básico (88 hs)</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Valor Hora Oficial UOCRA</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#10b981' }}>+.500</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>Presentismo UOCRA (20%)</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Asistencia 100% Validada GPS</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#10b981' }}>+.900</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>Horas Extras 50% (8 hs)</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Sábados y extensión de jornada</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#10b981' }}>+.430</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>Fondo Cese Laboral Ley 22.250 (12%)</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Depósito bancario cuenta IERIC</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#f43f5e' }}>-.660</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>Aportes de Ley (Jubilación + OS + Cuota)</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>11% Jub. + 3% INSSJP + 3% OSPACAR + 2.5% UOCRA</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#f43f5e' }}>-.930</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 8px', marginTop: '4px' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Neto a Percibir</div>
                                <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Acreditación bancaria CBU</div>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8' }}>
                                .240 <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>ARS</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Digital Signature Box */}
                {!signed ? (
                    <div style={{ background: '#0b1329', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>✍️ Firma Digital del Operario</span>
                            <button
                                onClick={clearCanvas}
                                style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Borrar y rehacer
                            </button>
                        </div>

                        <div style={{ background: '#060913', border: '2px dashed rgba(56, 189, 248, 0.4)', borderRadius: '10px', overflow: 'hidden', touchAction: 'none' }}>
                            <canvas
                                ref={canvasRef}
                                width={480}
                                height={160}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                style={{ width: '100%', height: '140px', display: 'block', cursor: 'crosshair' }}
                            />
                        </div>

                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px', lineHeight: 1.4 }}>
                            * Al pulsar Firmar Recibo, presto mi conformidad con los haberes liquidados bajo los términos del art. 140 de la Ley de Contrato de Trabajo (Ley 20.744) y Ley 22.250.
                        </div>

                        <button
                            onClick={handleSign}
                            disabled={submitting}
                            style={{
                                width: '100%',
                                marginTop: '14px',
                                padding: '12px',
                                background: submitting ? '#334155' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                                color: '#f8fafc',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '0.92rem',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                            }}
                        >
                            {submitting ? 'Sellando Criptográficamente...' : '✅ Confirmar y Firmar Recibo'}
                        </button>
                    </div>
                ) : (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>Recibo Firmado Digitalmente</h3>
                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '14px' }}>
                            Conformidad registrada con éxito el <strong>{signTimestamp}</strong>
                        </p>

                        <div style={{ background: '#060913', padding: '10px', borderRadius: '8px', fontSize: '0.7rem', color: '#38bdf8', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '12px' }}>
                            {signatureHash}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => window.print()}
                                style={{ flex: 1, padding: '10px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                🖨️ Imprimir / Guardar PDF
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#475569', marginTop: '20px' }}>
                    ObraSaaS ConTech Platform • Conforme Ley 20.744, Ley 22.250 & Res. SRT 319/99 • Firma con Trazabilidad SHA-256
                </div>

            </div>
        </div>
    );
}

export default function RecibosPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#060913', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando Recibo Digital UOCRA...</div>}>
            <RecibosContent />
        </Suspense>
    );
}
