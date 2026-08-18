"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MedicalContent() {
    const searchParams = useSearchParams();
    const workerParam = searchParams.get('worker') || '';
    const tokenParam = searchParams.get('token') || '';

    const [name, setName] = useState('');
    const [authorized, setAuthorized] = useState(null); 
    const [diagnosis, setDiagnosis] = useState('Gripe / Cuadro Febril');
    const [days, setDays] = useState(2);
    const [docPhoto, setDocPhoto] = useState(null);
    const [fileName, setFileName] = useState('certificado_medico.jpg');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Fetch worker profile from state API (dynamic, no hardcoding)
    useEffect(() => {
        if (workerParam) {
            fetch('/api/state')
                .then(res => res.json())
                .then(state => {
                    const registry = state.workerRegistry || [];
                    const worker = registry.find(w =>
                        w.id === workerParam ||
                        (w.name || '').toLowerCase().includes(workerParam.toLowerCase())
                    );
                    if (worker) {
                        setName(worker.name || workerParam);
                    } else {
                        setName(workerParam);
                    }
                })
                .catch(err => console.warn('Could not load worker profile from state:', err));
        }
    }, [workerParam]);

    // Check token authenticity
    useEffect(() => {
        const verifyAccess = async () => {
            if (!workerParam || !tokenParam) {
                setAuthorized(false);
                return;
            }
            try {
                const res = await fetch(`/api/auth/verify?worker=${workerParam}&token=${tokenParam}`);
                const data = await res.json();
                setAuthorized(data.valid);
            } catch (e) {
                setAuthorized(false);
            }
        };
        verifyAccess();
    }, [workerParam, tokenParam]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (event) => {
                setDocPhoto(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

            // Post incident via WhatsApp API to trigger blockchain ledger & feed
            await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: workerParam,
                    message: `[Certificado Médico] ${name} presentó justificativo por ${diagnosis} (${days} días de reposo). Doc: ${fileName}`
                })
            });

            setSubmitted(true);
        } catch (error) {
            console.error(error);
            alert("Error al cargar la licencia médica.");
        } finally {
            setLoading(false);
        }
    };

    if (authorized === null) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#ff9f1c', marginBottom: '16px' }}></i>
                    <div>Verificando firma criptográfica...</div>
                </div>
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff', padding: '24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: '24px' }}>
                    <i className="fa-solid fa-shield-halved"></i>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>Acceso No Autorizado</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '320px', lineHeight: '1.5', marginBottom: '32px' }}>
                    El enlace utilizado no es válido o ha expirado.
                </p>
                <p style={{ color: '#ff9f1c', fontSize: '0.85rem', fontWeight: 600 }}>
                    📲 Solicitá un nuevo enlace escribiendo "6" o "licencia" en el chat de WhatsApp.
                </p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff', padding: '24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: '24px' }}>
                    <i className="fa-solid fa-circle-check"></i>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '12px' }}>Certificado Recibido</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '340px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
                    La licencia médica de *{name}* ha sido registrada exitosamente en la bitácora legal de ObraSaaS.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', fontSize: '0.85rem', color: '#cbd5e1', textAlign: 'left', width: '100%', maxWidth: '340px', marginBottom: '28px' }}>
                    <strong style={{ color: '#ff9f1c' }}>Detalle de la Licencia:</strong>
                    <div style={{ marginTop: '8px' }}>• <strong>Operario:</strong> {name}</div>
                    <div>• <strong>Diagnóstico:</strong> {diagnosis}</div>
                    <div>• <strong>Período:</strong> {days} días corridos</div>
                    <div>• <strong>Comprobante:</strong> {fileName}</div>
                </div>
                <p style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>
                    📲 Ya podés cerrar esta ventana y volver a WhatsApp.
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px', color: '#f8fafc' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <span style={{ fontSize: '0.7rem', color: '#ff9f1c', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>ObraSaaS Mobile</span>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '4px 0 0 0' }}>Carga de Licencia Médica</h1>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Justificativo laboral para <strong>{name || 'Cargando...'}</strong></p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
                
                {/* Diagnosis */}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Diagnóstico / Motivo de Salud</label>
                    <select 
                        value={diagnosis} 
                        onChange={(e) => setDiagnosis(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                    >
                        <option value="Gripe / Cuadro Febril">Gripe / Cuadro Febril / COVID</option>
                        <option value="Lesión o Esguince en Obra">Lesión o Traumatismo en Obra</option>
                        <option value="Consulta Odontológica">Atención Odontológica Urgente</option>
                        <option value="Estudios Clínicos / Exámenes">Estudios Clínicos / Especialista</option>
                        <option value="Intervención Quirúrgica">Intervención Quirúrgica Menor</option>
                    </select>
                </div>

                {/* Duration in days */}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Días de Reposo Otorgados</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="30"
                        value={days} 
                        onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                        style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                        required
                    />
                </div>

                {/* Camera / File Upload */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Fotografía de Certificado o Receta</label>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        style={{ 
                            border: '2px dashed rgba(255,255,255,0.15)', 
                            borderRadius: '12px', 
                            padding: '20px', 
                            textAlign: 'center', 
                            background: docPhoto ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.2)', 
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {docPhoto ? (
                            <div>
                                <img src={docPhoto} alt="Certificado" style={{ maxHeight: '140px', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>
                                    <i className="fa-solid fa-check-circle"></i> {fileName} (Toca para cambiar)
                                </div>
                            </div>
                        ) : (
                            <div>
                                <i className="fa-solid fa-camera" style={{ fontSize: '2rem', color: '#ff9f1c', marginBottom: '8px' }}></i>
                                <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>Tomar Foto con la Cámara</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>o adjuntar archivo de imagen / PDF</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit Button */}
                <button 
                    type="submit" 
                    disabled={loading}
                    style={{ 
                        width: '100%', 
                        padding: '16px', 
                        background: loading ? '#334155' : 'linear-gradient(135deg, #ff9f1c, #f59e0b)', 
                        color: '#000', 
                        border: 'none', 
                        borderRadius: '12px', 
                        fontWeight: 800, 
                        fontSize: '1rem', 
                        cursor: loading ? 'not-allowed' : 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        boxShadow: loading ? 'none' : '0 8px 24px rgba(255, 159, 28, 0.3)'
                    }}
                >
                    {loading ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin"></i> Registrando Certificado...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-notes-medical"></i> Registrar Licencia Médica
                        </>
                    )}
                </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
                <i className="fa-solid fa-lock"></i> Firma Criptográfica SHA-256 • ObraSaaS Enterprise
            </div>
        </div>
    );
}

export default function MedicalWebview() {
    return (
        <div style={{ background: '#0a0e1a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#ff9f1c' }}></i>
                </div>
            }>
                <MedicalContent />
            </Suspense>
        </div>
    );
}
