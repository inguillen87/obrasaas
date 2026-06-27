"use client";

import { useState, useEffect } from 'react';

export default function AttendanceWebview() {
    const [name, setName] = useState('Juan Gómez');
    const [fichajes, setFichajes] = useState([]);
    const [presents, setPresents] = useState(21);
    const [absences, setAbsences] = useState(0);
    const [checkingIn, setCheckingIn] = useState(false);
    const [statusText, setStatusText] = useState('Listo para registrar ingreso');
    const [statusType, setStatusType] = useState('info'); // 'info', 'success', 'error'

    useEffect(() => {
        // Load initial records
        const now = new Date();
        const dates = [];
        for (let i = 1; i <= 5; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            if (date.getDay() !== 0 && date.getDay() !== 6) { // Exclude weekends
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

        // Simulate GPS coordinates
        // Palermo site: lat: -34.5886, lon: -58.4302
        // We will simulate a small deviation to make it interesting
        const insideGeofence = Math.random() > 0.15; // 85% chance inside
        
        let lat = -34.5886;
        let lon = -58.4302;
        
        if (!insideGeofence) {
            // Fichaje fuera del predio
            lat = -34.5898; 
            lon = -58.4320;
        }

        setTimeout(async () => {
            try {
                // Post to webhook API
                const res = await fetch('/api/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: name.toLowerCase().replace(' ', ''),
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

    return (
        <div style={{ background: '#0a0e1a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 16px' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '10px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#ff9f1c', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #ff9f1c, #e76f51)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem' }}>OS</div>
                        ObraSaaS
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>Control de Presentismo Satelital</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Cuadrilla de Obra - Módulo Fichaje Móvil</p>
                </div>

                {/* Worker selection */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Operario Activo</label>
                    <select 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                    >
                        <option value="Juan Gómez" style={{ background: '#0a0e1a' }}>Juan Gómez (Albañilería)</option>
                        <option value="Carlos Pérez" style={{ background: '#0a0e1a' }}>Carlos Pérez (Pintura)</option>
                        <option value="Luis Martínez" style={{ background: '#0a0e1a' }}>Luis Martínez (Instalaciones)</option>
                    </select>

                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
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
        </div>
    );
}
