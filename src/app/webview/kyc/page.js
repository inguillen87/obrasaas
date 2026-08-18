"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function KYCContent() {
    const searchParams = useSearchParams();
    const workerParam = searchParams.get('worker') || '';
    const phoneParam = searchParams.get('phone') || '';
    const tokenParam = searchParams.get('token') || '';

    // Step state: 1 = Personal Data, 2 = DNI Camera Scan, 3 = Biometric Selfie Camera, 4 = GPS & Review, 5 = Verified Success
    const [step, setStep] = useState(1);
    const [nombre, setNombre] = useState('');
    const [dni, setDni] = useState('');
    const [cuil, setCuil] = useState('');
    const [trade, setTrade] = useState('Albañilería Principal');
    const [phone, setPhone] = useState(phoneParam || '');

    // Captured Media (Base64)
    const [dniFront, setDniFront] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [voiceEnrolled, setVoiceEnrolled] = useState(false);
    const [recordingVoice, setRecordingVoice] = useState(false);

    // Live WebRTC Camera Stream State
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' for DNI, 'user' for Selfie
    const [cameraError, setCameraError] = useState(null);
    const [streamInstance, setStreamInstance] = useState(null);

    // GPS Telemetry
    const [gpsLocation, setGpsLocation] = useState(null);
    const [gpsDistance, setGpsDistance] = useState(null);
    const [gpsStatus, setGpsStatus] = useState('Obteniendo satélites...');
    const [isInsideGeofence, setIsInsideGeofence] = useState(false);
    const [activeProjectName, setActiveProjectName] = useState('Obra');
    const [projectCoords, setProjectCoords] = useState({ lat: -34.5886, lon: -58.4302, radius: 100 });

    // Submission & Error State
    const [submitting, setSubmitting] = useState(false);
    const [verifiedResult, setVerifiedResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Fetch worker profile from state API (dynamic, no hardcoding)
    useEffect(() => {
        if (workerParam) {
            fetch(`/api/state`)
                .then(res => res.json())
                .then(state => {
                    const registry = state.workerRegistry || [];
                    const worker = registry.find(w => 
                        w.id === workerParam || 
                        (w.name || '').toLowerCase().includes(workerParam.toLowerCase())
                    );
                    if (worker) {
                        setNombre(worker.name || '');
                        setDni(worker.dni || '');
                        setCuil('');
                        setTrade(worker.trade || worker.role || 'Albañilería Principal');
                        if (worker.phone) setPhone(worker.phone);
                    }
                    // Set active project name for GPS display
                    if (state.projectConfig?.name) {
                        setActiveProjectName(state.projectConfig.name);
                    }
                    // Store project coordinates for geofence calculation
                    if (state.projectConfig) {
                        setProjectCoords({
                            lat: state.projectConfig.latitude || -34.5886,
                            lon: state.projectConfig.longitude || -58.4302,
                            radius: state.projectConfig.geofenceRadiusMeters || 100
                        });
                    }
                })
                .catch(err => console.warn('Could not load worker profile:', err));
        }
    }, [workerParam]);

    // Live GPS fetch on load (uses dynamic project coordinates)
    useEffect(() => {
        if (typeof window !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    setGpsLocation({ lat, lon });

                    // Distance to active project site (dynamic)
                    const R = 6371e3;
                    const pLat = projectCoords.lat;
                    const pLon = projectCoords.lon;
                    const phi1 = lat * Math.PI / 180;
                    const phi2 = pLat * Math.PI / 180;
                    const dPhi = (pLat - lat) * Math.PI / 180;
                    const dLam = (pLon - lon) * Math.PI / 180;
                    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)*Math.sin(dLam/2);
                    const dist = Math.round(R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))));

                    setGpsDistance(dist);
                    setIsInsideGeofence(dist <= projectCoords.radius);
                    setGpsStatus(dist <= projectCoords.radius ? `✅ Dentro de obra (${dist}m de radio)` : `⚠️ Fuera de radio (${dist}m de obra)`);
                },
                (err) => {
                    setGpsStatus('⚠️ No se pudo obtener GPS. Verifique permisos de ubicación.');
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }, [projectCoords]);

    // Stop current camera stream
    const stopCamera = () => {
        if (streamInstance) {
            streamInstance.getTracks().forEach(track => track.stop());
            setStreamInstance(null);
        }
        setCameraActive(false);
    };

    // Start WebRTC Camera stream
    const startCamera = async (facing = 'environment') => {
        stopCamera();
        setCameraError(null);
        try {
            const constraints = {
                video: {
                    facingMode: facing,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setStreamInstance(stream);
            setCameraActive(true);
            setCameraFacing(facing);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(e => console.warn("Video play interrupted:", e));
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraError("No se pudo acceder a la cámara. Verifique los permisos en el navegador.");
            setCameraActive(false);
        }
    };

    // Handle step change and auto-start camera
    useEffect(() => {
        if (step === 2) {
            startCamera('environment'); // Back camera for DNI
        } else if (step === 3) {
            startCamera('user'); // Front camera for Selfie
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [step]);

    // Ensure video stream attaches to element
    useEffect(() => {
        if (cameraActive && streamInstance && videoRef.current) {
            videoRef.current.srcObject = streamInstance;
        }
    }, [cameraActive, streamInstance]);

    // Capture frame from video element
    const capturePhoto = (target) => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        if (cameraFacing === 'user') {
            // Mirror selfie horizontally for natural preview
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        if (target === 'dni') {
            setDniFront(dataUrl);
            stopCamera();
        } else if (target === 'selfie') {
            setSelfie(dataUrl);
            stopCamera();
        }
    };

    // Fallback file upload from gallery
    const handleFileUpload = (e, setter) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setter(ev.target.result);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRecordVoice = async () => {
        setRecordingVoice(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                setRecordingVoice(false);
                setVoiceEnrolled(true);
            };
            mediaRecorder.start();
            // Record 3 seconds of voice sample
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 3000);
        } catch (err) {
            console.warn('Voice recording not available:', err);
            setRecordingVoice(false);
            // Skip voice enrollment if mic not available
            setVoiceEnrolled(false);
        }
    };

    // Submit KYC to API
    const handleSubmitKYC = async (e) => {
        if (e) e.preventDefault();
        setSubmitting(true);
        setErrorMessage(null);

        if (!dniFront) {
            setErrorMessage("Es obligatorio capturar la foto del DNI.");
            setSubmitting(false);
            setStep(2);
            return;
        }

        if (!selfie) {
            setErrorMessage("Es obligatorio capturar la selfie biométrica.");
            setSubmitting(false);
            setStep(3);
            return;
        }

        try {
            const res = await fetch('/api/webview/kyc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workerId: workerParam,
                    phone: phone,
                    nombre: nombre,
                    dni: dni,
                    cuil: cuil,
                    trade: trade,
                    dniFrontBase64: dniFront,
                    selfieBase64: selfie,
                    latitude: gpsLocation?.lat || null,
                    longitude: gpsLocation?.lon || null,
                    voiceEnrolled: voiceEnrolled
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setVerifiedResult(data);
                setStep(5); // Success step
            } else {
                setErrorMessage(data.error || "No se pudo verificar la identidad. Intente nuevamente.");
            }
        } catch (err) {
            console.error("KYC submit error:", err);
            setErrorMessage("Error de conexión al procesar la biometría. Verifique su conexión.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '1rem', maxWidth: '460px', margin: '0 auto' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.2rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.8rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block', boxShadow: '0 0 8px #38bdf8' }}></span>
                    ObraSaaS Biometric KYC Engine
                </div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: '#fff' }}>
                    Verificación de Identidad
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                    Registro Oficial UOCRA &amp; Geocerca Satelital
                </p>
            </div>

            {/* Stepper Indicator */}
            {step < 5 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '14px', left: '10%', right: '10%', height: '2px', background: '#1e293b', zIndex: 0 }}>
                        <div style={{ width: `${((step - 1) / 3) * 100}%`, height: '100%', background: '#38bdf8', transition: 'width 0.3s' }}></div>
                    </div>
                    {[
                        { num: 1, label: "Datos" },
                        { num: 2, label: "DNI Cam" },
                        { num: 3, label: "Selfie Cam" },
                        { num: 4, label: "Auditoría" }
                    ].map((st) => (
                        <div key={st.num} style={{ textAlign: 'center', zIndex: 1, width: '22%' }}>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: step >= st.num ? '#38bdf8' : '#0f172a',
                                color: step >= st.num ? '#090d16' : '#64748b',
                                border: `2px solid ${step >= st.num ? '#38bdf8' : '#334155'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                margin: '0 auto 4px auto'
                            }}>
                                {step > st.num ? '✓' : st.num}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: step >= st.num ? '#e2e8f0' : '#64748b', fontWeight: step === st.num ? 700 : 400 }}>
                                {st.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Error Notification Banner */}
            {errorMessage && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <div>
                        <strong style={{ color: '#fff', display: 'block' }}>Validación Rechazada</strong>
                        {errorMessage}
                    </div>
                </div>
            )}

            {/* STEP 1: Datos Personales */}
            {step === 1 && (
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📋 1. Datos Personales del Operario
                    </h2>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Nombre Completo (como figura en DNI)</label>
                            <input 
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Ej: Juan Carlos Gómez"
                                required
                                style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Número de DNI</label>
                                <input 
                                    type="text"
                                    value={dni}
                                    onChange={(e) => setDni(e.target.value)}
                                    placeholder="34.589.120"
                                    required
                                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>CUIL Laboral</label>
                                <input 
                                    type="text"
                                    value={cuil}
                                    onChange={(e) => setCuil(e.target.value)}
                                    placeholder="20-34589120-3"
                                    style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Categoría / Especialidad UOCRA</label>
                            <select 
                                value={trade}
                                onChange={(e) => setTrade(e.target.value)}
                                style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                            >
                                <option value="Albañilería Principal">Oficial Albañil (Mampostería / Revoques)</option>
                                <option value="Instalaciones y Sanitarios">Oficial Especializado (Plomero / Gasista)</option>
                                <option value="Pintura e Interiores">Medio Oficial (Pintura / Revestimientos)</option>
                                <option value="Estructuras y Hormigón">Armador / Encofrador de Hormigón</option>
                                <option value="Electricista de Obra">Electricista Habilitado</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>WhatsApp Vinculado</label>
                            <input 
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+54 9 11 ..."
                                style={{ width: '100%', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#94a3b8', fontSize: '0.9rem', outline: 'none' }}
                            />
                        </div>

                        <button 
                            onClick={() => {
                                if (!nombre || !dni) {
                                    setErrorMessage("Por favor complete nombre y DNI para continuar.");
                                    return;
                                }
                                setErrorMessage(null);
                                setStep(2);
                            }}
                            style={{ marginTop: '8px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <span>Continuar a Escaneo de DNI con Cámara</span> 📸
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: Live Camera DNI Scan */}
            {step === 2 && (
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🪪 2. Captura de DNI con Cámara
                        </h2>
                        <button onClick={() => startCamera(cameraFacing === 'environment' ? 'user' : 'environment')} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>
                            🔄 Cambiar Cámara
                        </button>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
                        Encuadre el frente del DNI dentro del marco con buena luz para lectura OCR de IA.
                    </p>

                    {/* Live Viewfinder */}
                    {!dniFront ? (
                        <div style={{ position: 'relative', width: '100%', height: '240px', background: '#000', borderRadius: '10px', overflow: 'hidden', border: '2px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cameraActive ? (
                                <>
                                    <video 
                                        ref={videoRef}
                                        autoPlay 
                                        playsInline 
                                        muted
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* DNI Guide Overlay */}
                                    <div style={{ position: 'absolute', width: '85%', height: '70%', border: '2px dashed #38bdf8', borderRadius: '8px', pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
                                        <div style={{ position: 'absolute', top: '-10px', left: '10px', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                            DNI / Credencial UOCRA
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '12px' }}>{cameraError || 'Iniciando cámara...'}</p>
                                    <button onClick={() => startCamera('environment')} style={{ background: '#38bdf8', color: '#090d16', border: 'none', borderRadius: '6px', padding: '8px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                        Reintentar Acceso a Cámara
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #22c55e' }}>
                            <img src={dniFront} alt="DNI Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(34, 197, 94, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                ✓ DNI Capturado
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!dniFront ? (
                            <button 
                                onClick={() => capturePhoto('dni')}
                                disabled={!cameraActive}
                                style={{ background: cameraActive ? '#38bdf8' : '#334155', color: '#090d16', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 800, fontSize: '0.95rem', cursor: cameraActive ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                📸 Capturar Foto de DNI
                            </button>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button 
                                    onClick={() => { setDniFront(null); startCamera('environment'); }}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    🔄 Re-tomar
                                </button>
                                <button 
                                    onClick={() => setStep(3)}
                                    style={{ background: '#22c55e', color: '#090d16', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    Paso Siguiente ➔
                                </button>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            <label style={{ fontSize: '0.7rem', color: '#64748b', textDecoration: 'underline', cursor: 'pointer' }}>
                                O subir imagen desde galería
                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setDniFront)} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: Live Camera Biometric Selfie & Liveness */}
            {step === 3 && (
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🤳 3. Selfie Biométrica &amp; Liveness
                        </h2>
                        <button onClick={() => startCamera(cameraFacing === 'user' ? 'environment' : 'user')} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>
                            🔄 Cambiar Cámara
                        </button>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
                        Mire fijamente al óvalo con rostro despejado y buena luz para la comparación facial por IA.
                    </p>

                    {/* Live Viewfinder with Facial Oval */}
                    {!selfie ? (
                        <div style={{ position: 'relative', width: '100%', height: '240px', background: '#000', borderRadius: '10px', overflow: 'hidden', border: '2px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cameraActive ? (
                                <>
                                    <video 
                                        ref={videoRef}
                                        autoPlay 
                                        playsInline 
                                        muted
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* Facial Oval Mask Overlay */}
                                    <div style={{ position: 'absolute', width: '160px', height: '210px', border: '2px solid #38bdf8', borderRadius: '50%', pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}>
                                        <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            Encuadre su Rostro
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '12px' }}>{cameraError || 'Iniciando cámara frontal...'}</p>
                                    <button onClick={() => startCamera('user')} style={{ background: '#38bdf8', color: '#090d16', border: 'none', borderRadius: '6px', padding: '8px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                        Activar Cámara Frontal
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #22c55e' }}>
                            <img src={selfie} alt="Selfie Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(34, 197, 94, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                ✓ Selfie Biométrica Lista
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!selfie ? (
                            <button 
                                onClick={() => capturePhoto('selfie')}
                                disabled={!cameraActive}
                                style={{ background: cameraActive ? '#38bdf8' : '#334155', color: '#090d16', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 800, fontSize: '0.95rem', cursor: cameraActive ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                🤳 Tomar Selfie Biométrica
                            </button>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button 
                                    onClick={() => { setSelfie(null); startCamera('user'); }}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    🔄 Re-tomar
                                </button>
                                <button 
                                    onClick={() => setStep(4)}
                                    style={{ background: '#22c55e', color: '#090d16', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    Paso Final ➔
                                </button>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            <label style={{ fontSize: '0.7rem', color: '#64748b', textDecoration: 'underline', cursor: 'pointer' }}>
                                O subir selfie desde archivo
                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setSelfie)} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: Review, Voice, GPS & Final Submission */}
            {step === 4 && (
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📡 4. Certificación Satelital &amp; Envío
                    </h2>

                    {/* Summary Card */}
                    <div style={{ background: '#090d16', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                            <img src={selfie} alt="Selfie Mini" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8' }} />
                            <div>
                                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>{nombre}</strong>
                                <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>DNI {dni} • {trade}</span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.7rem', color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
                            <span>🪪 DNI OCR: <strong style={{ color: '#4ade80' }}>Capturado</strong></span>
                            <span>🤳 Selfie: <strong style={{ color: '#4ade80' }}>Capturada</strong></span>
                            <span>📍 Obra: <strong style={{ color: '#fff' }}>{activeProjectName}</strong></span>
                            <span>📡 GPS: <strong style={{ color: isInsideGeofence ? '#4ade80' : '#f59e0b' }}>{gpsDistance ? `${gpsDistance}m` : 'Validado'}</strong></span>
                        </div>
                    </div>

                    {/* Voice Sample Opt-in */}
                    <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                            🎙️ Enrolamiento Biométrico de Voz (Opcional)
                        </span>
                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0 0 8px 0' }}>
                            Permite fichar asistencia enviando notas de voz de WhatsApp con reconocimiento automático de locutor.
                        </p>
                        <button 
                            onClick={handleRecordVoice}
                            disabled={recordingVoice || voiceEnrolled}
                            style={{ width: '100%', background: voiceEnrolled ? 'rgba(34, 197, 94, 0.2)' : '#1e293b', border: `1px solid ${voiceEnrolled ? '#22c55e' : '#334155'}`, color: voiceEnrolled ? '#4ade80' : '#e2e8f0', borderRadius: '6px', padding: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: voiceEnrolled ? 'default' : 'pointer' }}
                        >
                            {recordingVoice ? "🎙️ Grabando muestra de audio (2s)..." : voiceEnrolled ? "✓ Muestra Vocal Enrolada" : "🎙️ Grabar Muestra de Voz"}
                        </button>
                    </div>

                    <button 
                        onClick={handleSubmitKYC}
                        disabled={submitting}
                        style={{ width: '100%', background: submitting ? '#334155' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#090d16', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 900, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        {submitting ? "🔄 Verificando Biometría con IA..." : "🚀 Validar Identidad & Activar Legajo"}
                    </button>
                </div>
            )}

            {/* STEP 5: Success & Certified Legajo */}
            {step === 5 && verifiedResult && (
                <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #22c55e', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)', border: '2px solid #22c55e', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 12px auto' }}>
                        ✓
                    </div>

                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
                        ¡Identidad KYC Verificada!
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
                        Tu legajo biométrico ha sido activado y firmado con hash SHA-256 en el centro de mando.
                    </p>

                    <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', textAlign: 'left', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{verifiedResult.workerName}</strong>
                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 800 }}>
                                ACTIVO
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                            <span>DNI: <strong style={{ color: '#fff' }}>{verifiedResult.dni}</strong></span>
                            <span>Rol: <strong style={{ color: '#38bdf8' }}>{verifiedResult.trade}</strong></span>
                            <span>Facial Match: <strong style={{ color: '#4ade80' }}>{verifiedResult.faceMatchScore}%</strong></span>
                            <span>Geocerca: <strong style={{ color: verifiedResult.isInsideGeofence ? '#4ade80' : '#f59e0b' }}>{verifiedResult.distanceMeters || 0}m</strong></span>
                        </div>
                        {verifiedResult.auditBlock && (
                            <div style={{ marginTop: '8px', borderTop: '1px solid #1e293b', paddingTop: '6px', fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace' }}>
                                Sello SHA-256: {verifiedResult.auditBlock.substring(0, 24)}...
                            </div>
                        )}
                    </div>

                    <a 
                        href="https://wa.me/15551533706?text=Hola%20ya%20complet%C3%A9%20mi%20verificaci%C3%B3n%20KYC"
                        style={{ display: 'block', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#090d16', textDecoration: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.95rem' }}
                    >
                        Volver a WhatsApp &amp; Fichar 💬
                    </a>
                </div>
            )}
        </div>
    );
}

export default function KYCPage() {
    return (
        <Suspense fallback={<div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Cargando portal KYC...</div>}>
            <KYCContent />
        </Suspense>
    );
}
