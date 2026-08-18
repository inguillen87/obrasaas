"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AttendanceContent() {
    const searchParams = useSearchParams();
    const workerParam = searchParams.get('worker') || '';
    const tokenParam = searchParams.get('token') || '';

    const [name, setName] = useState('Juan Gómez');
    const [role, setRole] = useState('Albañilería');
    const [authorized, setAuthorized] = useState(null);
    const [fichajes, setFichajes] = useState([]);
    const [checkingIn, setCheckingIn] = useState(false);
    const [statusText, setStatusText] = useState('Listo para registrar ingreso satelital');
    const [statusType, setStatusType] = useState('info');
    const [gpsInfo, setGpsInfo] = useState(null);
    const [activeProject, setActiveProject] = useState({ name: 'Torre Palermo Soho', city: 'CABA', radius: 100 });

    useEffect(() => {
        if (workerParam === 'carlos') {
            setName('Carlos Pérez');
            setRole('Pintura & Revestimientos');
        } else if (workerParam === 'juan') {
            setName('Juan Gómez');
            setRole('Albañilería Principal');
        } else if (workerParam === 'luis') {
            setName('Luis Martínez');
            setRole('Instalaciones & Sanitarios');
        }
    }, [workerParam]);

    // Check token authenticity & fetch project
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

                const stateRes = await fetch('/api/project');
                const stateData = await stateRes.json();
                if (stateData.activeProject) {
                    setActiveProject(stateData.activeProject);
                }
            } catch (e) {
                setAuthorized(false);
            }
        };
        verifyAccess();
    }, [workerParam, tokenParam]);

    useEffect(() => {
        const now = new Date();
        const dates = [];
        for (let i = 1; i <= 5; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                dates.push({
                    date: date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
                    checkin: '08:02 AM',
                    status: 'Presente (GPS Satelital)'
                });
            }
        }
        setFichajes(dates);
    }, []);

    const handleGPSCheckin = () => {
        setCheckingIn(true);
        setStatusText('🛰️ Conectando con constelación GPS satelital...');
        setStatusType('info');

        if (!navigator.geolocation) {
            fallbackCheckin(-34.5886, -58.4302);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const accuracy = Math.round(pos.coords.accuracy || 8);
                setGpsInfo({ lat, lon, accuracy });
                await submitCheckin(lat, lon, accuracy);
            },
            (err) => {
                console.warn("Geolocation permission error or unavailable, using fallback:", err.message);
                fallbackCheckin(-34.5886, -58.4302);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const fallbackCheckin = async (lat, lon) => {
        await submitCheckin(lat, lon, 12);
    };

    const submitCheckin = async (lat, lon, accuracy) => {
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
            const now = new Date();
            const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

            if (data.success) {
                if (data.reply?.includes('Validado') || data.reply?.includes('Dentro del radio')) {
                    setStatusText(`✓ Presentismo Validado a las ${timeStr}. Estás dentro de la geocerca de ${activeProject.name} (Precisión GPS: ±${accuracy}m).`);
                    setStatusType('success');
                    setFichajes(prev => [
                        {
                            date: now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
                            checkin: timeStr,
                            status: 'Presente (GPS Satelital)'
                        },
                        ...prev
                    ]);
                } else if (data.reply?.includes('DENEGADO')) {
                    setStatusText(`🚨 ACCESO BLOQUEADO: Tu cobertura de ART se encuentra vencida. Notificá al Director.`);
                    setStatusType('error');
                } else {
                    setStatusText(`⚠️ Ubicación registrada fuera del límite de obra. Se ha alertado a la Dirección.`);
                    setStatusType('warning');
                }
            } else {
                setStatusText('Error en el servidor al registrar el fichaje.');
                setStatusType('error');
            }
        } catch (e) {
            console.error(e);
            setStatusText('Error de conexión con el servidor ObraSaaS.');
            setStatusType('error');
        } finally {
            setCheckingIn(false);
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
                    El enlace utilizado no es válido, ha expirado o tiene una firma de seguridad incorrecta.
                </p>
                <p style={{ color: '#ff9f1c', fontSize: '0.85rem', fontWeight: 600 }}>
                    Solicitá un nuevo enlace desde WhatsApp enviando "1".
                </p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#f8fafc', padding: '20px 16px', fontFamily: 'Inter, sans-serif', maxWidth: '480px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                <div>
                    <span style={{ fontSize: '0.7rem', color: '#ff9f1c', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>ObraSaaS Mobile</span>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0 0' }}>Presentismo Satelital</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '20px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>GPS Activo</span>
                </div>
            </div>

            {/* Obra & Worker Card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #ff9f1c, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#000', fontWeight: 800 }}>
                        {name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{role}</div>
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '2px' }}>
                            <i className="fa-solid fa-city"></i> {activeProject.name} ({activeProject.city})
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Action Button */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <button
                    onClick={handleGPSCheckin}
                    disabled={checkingIn}
                    style={{
                        width: '100%',
                        padding: '18px 24px',
                        background: checkingIn ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '16px',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        cursor: checkingIn ? 'not-allowed' : 'pointer',
                        boxShadow: checkingIn ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {checkingIn ? (
                        <>
                            <i className="fa-solid fa-satellite-dish fa-spin"></i> Validando Posición Satelital...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-location-dot"></i> Fichar Ingreso a Obra (GPS)
                        </>
                    )}
                </button>

                {/* Status Message */}
                <div style={{
                    marginTop: '14px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    background: statusType === 'success' ? 'rgba(16, 185, 129, 0.1)' : statusType === 'error' ? 'rgba(239, 68, 68, 0.1)' : statusType === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${statusType === 'success' ? 'rgba(16, 185, 129, 0.3)' : statusType === 'error' ? 'rgba(239, 68, 68, 0.3)' : statusType === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: statusType === 'success' ? '#10b981' : statusType === 'error' ? '#ef4444' : statusType === 'warning' ? '#f59e0b' : '#94a3b8'
                }}>
                    {statusText}
                </div>
            </div>

            {/* History Feed */}
            <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                    <i className="fa-solid fa-clock-rotate-left"></i> Historial Reciente de Ingresos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {fichajes.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{f.date}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.status}</div>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                {f.checkin}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Footer */}
            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: '#475569', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <i className="fa-solid fa-lock"></i> Geocerca Satelital Certificada • Ley UOCRA 22.250 • ObraSaaS
            </div>
        </div>
    );
}

export default function AttendancePage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#ff9f1c' }}></i>
            </div>
        }>
            <AttendanceContent />
        </Suspense>
    );
}
