"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AttendanceContent() {
    const searchParams = useSearchParams();
    const workerParam = searchParams.get('worker') || '';
    const tokenParam = searchParams.get('token') || '';

    const [name, setName] = useState('Juan Gómez');
    const [authorized, setAuthorized] = useState(null); // null = loading, true = active, false = blocked
    const [fichajes, setFichajes] = useState([]);
    const [presents, setPresents] = useState(21);
    const [absences, setAbsences] = useState(0);
    const [checkingIn, setCheckingIn] = useState(false);
    const [statusText, setStatusText] = useState('Listo para registrar ingreso');
    const [statusType, setStatusType] = useState('info'); 

    // Translate short id to full name
    useEffect(() => {
        if (workerParam === 'carlos') {
            setName('Carlos Pérez');
        } else if (workerParam === 'juan') {
            setName('Juan Gómez');
        } else if (workerParam === 'luis') {
            setName('Luis Martínez');
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

    useEffect(() => {
        // Load initial records
        const now = new Date();
        const dates = [];
        for (let i = 1; i <= 5; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                dates.push({
                    date: date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
                    checkin: '08:02 AM',
                    status: 'Presente (GPS)'
                });
            }
        }
        setFichajes(dates);
    }, []);

    const handleGPSCheckin = async () => {
        setCheckingIn(true);
        setStatusText('Obteniendo ubicación GPS satelital...');
        setStatusType('info');

        const insideGeofence = Math.random() > 0.15; 
        
        let lat = -34.5886;
        let lon = -58.4302;
        
        if (!insideGeofence) {
            lat = -34.5898; 
            lon = -58.4320;
        }

        setTimeout(async () => {
            try {
                const res = await fetch('/api/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: workerParam,
                        latitude: lat,
                        longitude: lon
                    })
                });
                const data = await res.json();

                if (data.success) {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                    
                    if (insideGeofence) {
                        setStatusText(`✓ Fichaje Registrado Exitosamente a las ${timeStr}. Estás dentro de la geocerca de la obra.`);
                        setStatusType('success');
                        setPresents(prev => prev + 1);
                        setFichajes(prev => [
                            {
                                date: now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
                                checkin: timeStr,
                                status: 'Presente (GPS)'
                            },
                            ...prev
                        ]);
                    } else {
                        setStatusText(`⚠️ ALERTA: Fichaje registrado fuera del límite permitido (Desvío GPS). Notificación enviada al director.`);
                        setStatusType('error');
                    }
                } else {
                    setStatusText('Falla en la validación biométrica/satelital.');
                    setStatusType('error');
                }
            } catch (e) {
                console.error(e);
                setStatusText('Error de conexión con el servidor ObraSaaS.');
                setStatusType('error');
            } finally {
                setCheckingIn(false);
            }
        }, 1500);
    };

    if (authorized === null) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#ff9f1c', marginBottom: '16px' }}></i>
                    <div>Verificando firma de seguridad...</div>
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>Acceso Bloqueado</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '320px', lineHeight: '1.5', marginBottom: '32px' }}>
                    El enlace utilizado no es válido, ha expirado o tiene una firma de seguridad incorrecta.
                </p>
                <p style={{ color: '#ff9f1c', fontSize: '0.85rem', fontWeight: 600 }}>
                    📲 Solicite un nuevo enlace seguro escribiendo "fichar" en el chat de WhatsApp.
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '10px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#ff9f1c', marginBottom: '8px' }}>
                    <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #ff9f1c, #e76f51)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem' }}>OS</div>
                    ObraSaaS
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>Control de Presentismo Satelital</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Fichaje seguro para: *{name}*</p>
            </div>

            {/* Stats Panel */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{presents}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>Asistencias</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{absences}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>Inasistencias</div>
                    </div>
                </div>
            </div>

            {/* GPS Checkin Action */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 159, 28, 0.08)', color: '#ff9f1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 16px auto' }}>
                    <i className="fa-solid fa-location-dot"></i>
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Fichaje Georreferenciado</h4>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '20px', lineHeight: '1.4' }}>
                    Presiona el botón para validar tu ubicación actual contra la geocerca activa del predio de obra.
                </p>

                {/* Status Feedback banner */}
                <div style={{ 
                    background: statusType === 'success' ? 'rgba(16, 185, 129, 0.1)' : statusType === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    border: `1px solid ${statusType === 'success' ? '#10b981' : statusType === 'error' ? '#ef4444' : '#3b82f6'}`,
                    color: statusType === 'success' ? '#10b981' : statusType === 'error' ? '#f87171' : '#60a5fa',
                    padding: '12px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    marginBottom: '20px',
                    textAlign: 'left'
                }}>
                    <i className={`fa-solid ${statusType === 'success' ? 'fa-circle-check' : statusType === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} style={{ marginRight: '8px' }}></i>
                    {statusText}
                </div>

                <button 
                    onClick={handleGPSCheckin}
                    disabled={checkingIn}
                    style={{ width: '100%', padding: '14px', background: '#ff9f1c', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    {checkingIn ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                        <>
                            <i className="fa-solid fa-crosshairs"></i> Registrar Fichaje GPS
                        </>
                    )}
                </button>
            </div>

            {/* History list */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: '#cbd5e1' }}><i className="fa-solid fa-history" style={{ marginRight: '6px' }}></i> Historial Reciente de Fichajes</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {fichajes.map((f, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.02)' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{f.date}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Ingreso: {f.checkin}</div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '4px 8px', borderRadius: '6px' }}>
                                {f.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AttendanceWebview() {
    return (
        <div style={{ background: '#0a0e1a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 16px' }}>
            <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                    <div style={{ textAlign: 'center' }}>
                        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#ff9f1c', marginBottom: '16px' }}></i>
                        <div>Cargando panel de asistencia...</div>
                    </div>
                </div>
            }>
                <AttendanceContent />
            </Suspense>
        </div>
    );
}
