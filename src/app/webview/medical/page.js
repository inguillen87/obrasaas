"use client";

import { useState } from 'react';

export default function MedicalWebview() {
    const [name, setName] = useState('Juan Gómez');
    const [diagnosis, setDiagnosis] = useState('Gripe');
    const [days, setDays] = useState(2);
    const [fileUploaded, setFileUploaded] = useState(false);
    const [fileName, setFileName] = useState('certificado_medico.pdf');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Fetch current state from DB
            const res = await fetch('/api/state');
            const state = await res.json();

            // Register medical license incident
            const now = new Date();
            const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            
            const newIncident = {
                id: "inc-med-" + Date.now(),
                title: "Licencia Médica Registrada",
                description: `Licencia Médica: ${name} justificado por ${diagnosis} (${days} días). Doc adjunto: ${fileName}`,
                type: "warning",
                badge: "Licencia Médica",
                timestamp: `Hoy, ${timeStr}`,
                reporter: "Portal Webview WhatsApp",
                icon: "fa-solid fa-notes-medical"
            };

            if (!state.incidents) state.incidents = [];
            state.incidents.unshift(newIncident);

            // Update worker status in attendance
            if (state.attendance && state.attendance[name]) {
                state.attendance[name].status = `Licencia (Médica)`;
            }

            // Save state
            await fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });

            // Post simulated message in chat history
            // Wait, we can fetch messages and push a log
            const msgRes = await fetch('/api/state');
            // Actually, we can post a message to chatbot so it updates in chat history
            await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: 'webview',
                    text: `[Webview] ${name} cargó certificado médico por ${diagnosis} (${days} días). Archivo: ${fileName}`
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

    if (submitted) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#fff', padding: '24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '2.5rem', marginBottom: '24px', margin: '0 auto 24px auto', justifyContent: 'center' }}>
                    <i className="fa-solid fa-circle-check"></i>
                </div>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px' }}>Certificado Recibido</h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '340px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
                    La licencia médica de *{name}* ha sido registrada exitosamente en la bitácora administrativa de ObraSaaS.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', fontSize: '0.85rem', color: '#cbd5e1', textAlign: 'left', width: '100%', maxWidth: '340px', marginBottom: '32px' }}>
                    <strong>Detalles del Registro:</strong>
                    <div style={{ marginTop: '8px' }}>• Operario: {name}</div>
                    <div>• Diagnóstico: {diagnosis}</div>
                    <div>• Período: {days} días corridos</div>
                    <div>• Archivo: {fileName}</div>
                </div>
                <p style={{ color: '#ff9f1c', fontSize: '0.85rem', fontWeight: 600 }}>
                    📲 Ya puedes cerrar esta ventana y volver al chat de WhatsApp.
                </p>
            </div>
        );
    }

    return (
        <div style={{ background: '#0a0e1a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 16px' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '20px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#ff9f1c', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #ff9f1c, #e76f51)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem' }}>OS</div>
                        ObraSaaS
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>Carga de Certificado Médico</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Completa los datos solicitados por la inspección de obra.</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
                    
                    {/* Worker Selector */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Operario de Cuadrilla</label>
                        <select 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                        >
                            <option value="Juan Gómez" style={{ background: '#0a0e1a' }}>Juan Gómez (Albañilería)</option>
                            <option value="Carlos Pérez" style={{ background: '#0a0e1a' }}>Carlos Pérez (Pintura)</option>
                            <option value="Luis Martínez" style={{ background: '#0a0e1a' }}>Luis Martínez (Instalaciones)</option>
                        </select>
                    </div>

                    {/* Diagnosis */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Diagnóstico / Motivo</label>
                        <select 
                            value={diagnosis} 
                            onChange={(e) => setDiagnosis(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                        >
                            <option value="Gripe Fuerte" style={{ background: '#0a0e1a' }}>Gripe / Fiebre</option>
                            <option value="Lesión Muscular" style={{ background: '#0a0e1a' }}>Lesión o Esguince en Obra</option>
                            <option value="Control Odontológico" style={{ background: '#0a0e1a' }}>Consulta Odontológica</option>
                            <option value="Control Médico General" style={{ background: '#0a0e1a' }}>Estudios Clínicos / Exámenes</option>
                        </select>
                    </div>

                    {/* Duration in days */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Días de Licencia Otorgados</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="30"
                            value={days} 
                            onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                            required
                        />
                    </div>

                    {/* Certificate File Upload Mock */}
                    <div style={{ marginBottom: '28px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Foto o PDF de Certificado</label>
                        <div style={{ border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.15)', cursor: 'pointer' }} onClick={() => setFileUploaded(true)}>
                            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.5rem', color: '#ff9f1c', marginBottom: '8px' }}></i>
                            {fileUploaded ? (
                                <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                                    ✓ {fileName} cargado
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    Toca para capturar foto o adjuntar archivo
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ width: '100%', padding: '14px', background: '#ff9f1c', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        {loading ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : (
                            <>
                                <i className="fa-solid fa-file-medical"></i> Registrar Certificado
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
