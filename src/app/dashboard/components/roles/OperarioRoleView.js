'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function OperarioRoleView({ state, setState, addToast }) {
  const [activeTab, setActiveTab] = useState('presentismo'); // 'presentismo' | 'credencial' | 'recibo' | 'reportes'
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [checkInTime, setCheckInTime] = useState('07:58 AM');
  const [distanceMeters, setDistanceMeters] = useState(32);
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);

  // Pay slip signature canvas state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [signatureHash, setSignatureHash] = useState('');
  const [signedTimestamp, setSignedTimestamp] = useState('');

  // Voice report state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);

  // Initialize canvas
  useEffect(() => {
    if (activeTab === 'recibo' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#22c55e';
    }
  }, [activeTab]);

  const handleGpsCheckIn = () => {
    setIsSimulatingGps(true);
    addToast('🛰️ Triangulando coordenadas GPS con satélite en obra...', 'info');
    setTimeout(() => {
      const newDistance = Math.floor(Math.random() * 25) + 15; // 15 to 40 meters
      setDistanceMeters(newDistance);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCheckInTime(timeStr);
      setIsCheckedIn(true);
      setIsSimulatingGps(false);

      if (setState) {
        setState(prev => ({
          ...prev,
          attendance: {
            ...prev.attendance,
            'Juan Gómez': {
              role: 'Oficial Albañil',
              status: 'Presente (GPS)',
              checkin: timeStr,
              distanceMeters: newDistance,
              artStatus: 'Vigente (La Segunda)'
            }
          }
        }));
      }

      addToast(`✅ Fichaje verificado a ${newDistance}m de la obra. ART validada automáticamente.`, 'success');
    }, 1200);
  };

  const handleGpsCheckOut = () => {
    setIsCheckedIn(false);
    addToast('🚪 Egreso de jornada registrado. Horas computadas según CCT 76/75.', 'info');
  };

  // Canvas drawing functions
  const startDrawing = (e) => {
    if (isSigned) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0]?.clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0]?.clientY)) - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing || isSigned) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0]?.clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0]?.clientY)) - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (isSigned) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSignReceipt = () => {
    if (!hasSignature) {
      addToast('⚠️ Por favor firme en el recuadro antes de confirmar conformidad.', 'warning');
      return;
    }
    const hash = 'SHA256-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    setSignatureHash(hash);
    setSignedTimestamp(dateStr);
    setIsSigned(true);
    addToast(`✍️ Recibo Quincena 1 firmado conforme Ley 25.506. Sello: ${hash.substring(0, 15)}...`, 'success');
  };

  const handleQuickAudioReport = (topic) => {
    addToast(`🎙️ Novedad enviada por audio al Capataz Miguel: "${topic}"`, 'success');
  };

  return (
    <div className="role-view operario-view animate-fade-in-up">
      {/* Role Header Banner */}
      <div className="glass-panel-premium" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderLeft: '4px solid #10b981', background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👷 Portal del Trabajador de Terreno (UOCRA)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Operario: <strong>Juan Gómez</strong> • Legajo #UOCRA-84920
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Mi Jornada, Fichaje Geocercado & Recibos Digitales
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
            Obra Asignada: <strong>Torre Libertador Park</strong> • Categoría: <strong>Oficial Albañil (CCT 76/75)</strong> • ART: <strong>La Segunda (Activa)</strong>
          </p>
        </div>

        {/* Quick Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: isCheckedIn ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${isCheckedIn ? '#22c55e' : '#ef4444'}`, borderRadius: '10px', padding: '8px 14px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ESTADO DE JORNADA</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isCheckedIn ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCheckedIn ? '#22c55e' : '#ef4444', display: 'inline-block' }}></span>
              {isCheckedIn ? `En Obra (${checkInTime})` : 'Fuera de Turno'}
            </div>
          </div>
        </div>
      </div>

      {/* Operario Subnavigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('presentismo')}
          className={`btn btn-sm ${activeTab === 'presentismo' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-location-crosshairs"></i> Presentismo GPS
        </button>
        <button
          onClick={() => setActiveTab('credencial')}
          className={`btn btn-sm ${activeTab === 'credencial' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-id-card-clip"></i> Credencial &amp; ART
        </button>
        <button
          onClick={() => setActiveTab('recibo')}
          className={`btn btn-sm ${activeTab === 'recibo' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-signature"></i> Recibo de Sueldo UOCRA
          {isSigned ? (
            <span style={{ background: '#22c55e', color: '#0f172a', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>Firmado</span>
          ) : (
            <span style={{ background: '#f59e0b', color: '#0f172a', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>1 Pendiente</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reportes')}
          className={`btn btn-sm ${activeTab === 'reportes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fa-solid fa-microphone-lines"></i> Avisos al Capataz
        </button>
      </div>

      {/* TAB 1: PRESENTISMO & GEOCERCA SATELITAL */}
      {activeTab === 'presentismo' && (
        <div className="animate-fade-in-up">
          <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
            {/* GPS Radar Card */}
            <div className="glass-panel-premium" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-satellite-dish" style={{ color: '#38bdf8' }}></i> Radar Geocercado de Obra
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Radio Permitido: 100m</span>
              </div>

              {/* Visual Radar Mock */}
              <div style={{ position: 'relative', height: '200px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.9) 70%)', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '16px' }}>
                {/* Radar Rings */}
                <div style={{ position: 'absolute', width: '160px', height: '160px', border: '1px dashed rgba(56, 189, 248, 0.3)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', width: '100px', height: '100px', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', width: '40px', height: '40px', border: '1px solid rgba(34, 197, 94, 0.6)', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%' }}></div>

                {/* Obra Center Pin */}
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <i className="fa-solid fa-building" style={{ color: '#fbbf24', fontSize: '1.2rem' }}></i>
                  <span style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700, marginTop: '2px' }}>Obra Libertador</span>
                </div>

                {/* Worker Pin */}
                <div style={{ position: 'absolute', top: '45px', left: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></div>
                  <span style={{ fontSize: '0.62rem', color: '#4ade80', fontWeight: 800, background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: '4px', marginTop: '2px' }}>Juan ({distanceMeters}m)</span>
                </div>
              </div>

              {/* Coordinates & Accuracy */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Coordenadas GPS Actuales</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>-34.5886°, -58.4302°</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Distancia al Eje de Obra</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: distanceMeters <= 100 ? '#4ade80' : '#f87171' }}>
                    {distanceMeters} metros ({distanceMeters <= 100 ? 'Dentro de Geocerca' : 'Fuera de Radio'})
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleGpsCheckIn}
                  disabled={isSimulatingGps}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-fingerprint"></i> {isSimulatingGps ? 'Validando Satélite...' : 'Registrar Check-In GPS'}
                </button>
                {isCheckedIn && (
                  <button
                    onClick={handleGpsCheckOut}
                    className="btn btn-secondary"
                    style={{ padding: '10px 16px', fontSize: '0.85rem', borderRadius: '8px', color: '#f87171' }}
                  >
                    Marcar Salida
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Log & Shift Details */}
            <div className="glass-panel-premium" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#fbbf24' }}></i> Registro de Jornadas (Quincena 1 Sep 2026)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {[
                  { dia: 'Hoy (Miércoles 16)', hora: checkInTime, distancia: `${distanceMeters}m`, estado: 'Presente', horas: '8.0 hs', art: 'OK' },
                  { dia: 'Ayer (Martes 15)', hora: '07:55 AM', distancia: '28m', estado: 'Presente', horas: '8.0 hs', art: 'OK' },
                  { dia: 'Lunes 14', hora: '08:02 AM', distancia: '41m', estado: 'Presente', horas: '8.0 hs + 2h Ext', art: 'OK' },
                  { dia: 'Viernes 11', hora: '07:50 AM', distancia: '22m', estado: 'Presente', horas: '8.0 hs', art: 'OK' },
                  { dia: 'Jueves 10', hora: '07:58 AM', distancia: '35m', estado: 'Presente', horas: '8.0 hs', art: 'OK' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{item.dia}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ingreso: {item.hora} • GPS: {item.distancia}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.68rem', marginRight: '6px' }}>{item.estado}</span>
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{item.horas}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(34, 197, 94, 0.08)', borderLeft: '3px solid #22c55e', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '0.75rem', color: '#86efac' }}>
                <strong>Premio Asistencia Perfecta UOCRA:</strong> Cumpliendo 10/10 jornadas sin faltas injustificadas. Adicional del 20% sobre básico garantizado.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREDENCIAL DIGITAL UOCRA + SRT */}
      {activeTab === 'credencial' && (
        <div className="animate-fade-in-up">
          <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
            {/* Worker Smart Credential Card */}
            <div className="glass-panel-premium" style={{ padding: '24px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>CREDENCIAL LABORAL HABILITANTE</div>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#fff', fontWeight: 800 }}>Juan Gómez</h3>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Oficial Albañil • Especialidad Hormigón Armado</div>
                </div>
                <div style={{ background: '#22c55e', color: '#0f172a', fontWeight: 900, fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px' }}>
                  ACTIVO
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>CUIL / DNI</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>20-33445566-9</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>LEGAJO UOCRA</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>#84.920</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>PÓLIZA ART (SRT)</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399' }}>La Segunda (#ART-2026-4451)</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>APTO MÉDICO DE LEY</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>Vence 14/11/2026 (Apto A)</div>
                </div>
              </div>

              {/* QR Access Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                    <i className="fa-solid fa-qrcode" style={{ color: '#0f172a', fontSize: '2rem' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>Pase Rápido de Portería</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Escanear en molinete o lector QR del capataz</div>
                  </div>
                </div>
                <button
                  onClick={() => addToast('📲 Código QR ampliado para acceso rápido en molinete.', 'info')}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '6px 12px' }}
                >
                  Ampliar QR
                </button>
              </div>
            </div>

            {/* EPP Delivery & Safety Gear Verification */}
            <div className="glass-panel-premium" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-vest-patches" style={{ color: '#f59e0b' }}></i> Dotación de EPP Asignada (Res. SRT 299/11)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {[
                  { item: 'Casco de Seguridad Clase A (MSA V-Gard)', entrega: '15/03/2026', estado: 'Vigente', icon: 'fa-helmet-safety', ok: true },
                  { item: 'Calzado Dieléctrico con Puntera Ombú', entrega: '01/08/2026', estado: 'Vigente', icon: 'fa-shoe-prints', ok: true },
                  { item: 'Arnés Anticaídas 3M con Cabo de Vida', entrega: '15/03/2026', estado: 'Inspeccionado', icon: 'fa-shield-halved', ok: true },
                  { item: 'Guantes de Descarne Reforzados', entrega: '01/09/2026', estado: 'Desgaste Normal', icon: 'fa-mitten', ok: true },
                  { item: 'Antiparras de Seguridad UV 400', entrega: '15/03/2026', estado: 'Vigente', icon: 'fa-glasses', ok: true },
                ].map((epp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className={`fa-solid ${epp.icon}`} style={{ color: '#fbbf24', fontSize: '1rem' }}></i>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{epp.item}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Entregado: {epp.entrega}</div>
                      </div>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>{epp.estado}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addToast('🦺 Solicitud de recambio de guantes enviada al pañol de obra.', 'success')}
                className="btn btn-sm btn-secondary"
                style={{ width: '100%', padding: '8px', fontSize: '0.78rem', borderRadius: '8px' }}
              >
                <i className="fa-solid fa-rotate"></i> Solicitar Renovación de EPP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECIBO DE SUELDO DIGITAL UOCRA CON FIRMA TÁCTIL */}
      {activeTab === 'recibo' && (
        <div className="animate-fade-in-up">
          <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
            {/* Official Pay Slip Document View */}
            <div className="glass-panel-premium" style={{ padding: '24px', background: '#0b1120', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Slip Header */}
              <div style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>CONSTRUCTORA DEL PLATA S.A.</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CUIT: 30-71449821-4 • CCT UOCRA 76/75</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>RECIBO DE HABERES — 1ª QUINCENA SEPTIEMBRE 2026</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Fecha de Pago</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>20/09/2026</div>
                </div>
              </div>

              {/* Worker Data */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.72rem' }}>
                <div><span style={{ color: '#94a3b8' }}>Empleado:</span> <strong>Gómez, Juan</strong></div>
                <div><span style={{ color: '#94a3b8' }}>CUIL:</span> <strong>20-33445566-9</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Categoría:</span> <strong>Oficial</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Ingreso:</span> <strong>12/03/2024</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Banco:</span> <strong>Galicia CBU ...8491</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Obra:</span> <strong>Torre Libertador</strong></div>
              </div>

              {/* Items Breakdown Table */}
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Concepto</th>
                    <th style={{ padding: '6px 0', textAlign: 'center' }}>Unid.</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>Haberes</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>Deducciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Sueldo Básico Oficial UOCRA</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>88 hs</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#fff' }}>$380.000,00</td>
                    <td></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Asistencia Perfecta CCT 76/75 (20%)</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>20%</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#fff' }}>$76.000,00</td>
                    <td></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Horas Extras al 50%</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>4 hs</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#fff' }}>$25.909,00</td>
                    <td></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Viático Diario Convencional</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>10 d</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#fff' }}>$18.500,00</td>
                    <td></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>Jubilación (11%)</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>11%</td>
                    <td></td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#f87171' }}>-$53.010,00</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>Obra Social OSPECON UOCRA (3%)</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>3%</td>
                    <td></td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#f87171' }}>-$14.457,00</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>Ley 19.032 INSSJP (3%)</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>3%</td>
                    <td></td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#f87171' }}>-$14.457,00</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>Cuota Sindical UOCRA (2.5%)</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>2.5%</td>
                    <td></td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#f87171' }}>-$12.047,00</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>Seguro de Vida Colectivo</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', color: '#94a3b8' }}>Fijo</td>
                    <td></td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#f87171' }}>-$1.500,00</td>
                  </tr>
                </tbody>
              </table>

              {/* Net Pay Amount Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '12px 16px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#86efac' }}>NETO A PERCIBIR (Acred. en cuenta)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4ade80' }}>$404.938,00 ARS</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#94a3b8' }}>
                  Total Bruto: $500.409,00<br />
                  Retenciones: -$95.471,00
                </div>
              </div>
            </div>

            {/* Touch Signature Pad & Cryptographic Seal */}
            <div className="glass-panel-premium" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-pen-nib" style={{ color: '#22c55e' }}></i> Firma Digital de Conformidad (Ley 25.506)
                  </h3>
                  {isSigned && (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                      <i className="fa-solid fa-check-double"></i> Conforme &amp; Sellado
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 14px' }}>
                  Firme con el dedo o mouse en el recuadro para certificar la recepción del haber quincenal y la liquidación detallada.
                </p>

                {/* Canvas Box */}
                <div style={{ position: 'relative', border: isSigned ? '2px solid #22c55e' : '2px dashed rgba(255,255,255,0.2)', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', height: '160px', marginBottom: '12px', cursor: isSigned ? 'not-allowed' : 'crosshair' }}>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ width: '100%', height: '100%', touchAction: 'none' }}
                  />

                  {!hasSignature && !isSigned && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-signature"></i> Dibujá tu firma aquí
                    </div>
                  )}

                  {isSigned && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '12px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', borderRadius: '6px', padding: '3px 8px', fontSize: '0.68rem', color: '#4ade80', fontFamily: 'monospace' }}>
                      {signatureHash}
                    </div>
                  )}
                </div>

                {/* Clear / Sign Controls */}
                {!isSigned ? (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <button
                      onClick={clearSignature}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '8px 14px', fontSize: '0.78rem' }}
                    >
                      <i className="fa-solid fa-eraser"></i> Borrar
                    </button>
                    <button
                      onClick={handleSignReceipt}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, padding: '8px 14px', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <i className="fa-solid fa-file-signature"></i> Firmar Recibo Conforme
                    </button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-circle-check"></i> Recibo Firmado Exitosamente
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      Registrado: <strong>{signedTimestamp}</strong><br />
                      Hash Criptográfico SHA-256: <code style={{ color: '#38bdf8' }}>{signatureHash}</code><br />
                      Validez jurídica según Ley Nacional 25.506 y CCT 76/75.
                    </div>
                  </div>
                )}
              </div>

              {/* Download / Proof Action */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => addToast('📄 Descargando copia en PDF del recibo firmado...', 'info')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', padding: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-download"></i> Descargar Comprobante PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AVISOS Y REPORTES AL CAPATAZ */}
      {activeTab === 'reportes' && (
        <div className="animate-fade-in-up">
          <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
            {/* Quick 1-Tap Reports */}
            <div className="glass-panel-premium" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-bolt" style={{ color: '#fbbf24' }}></i> Avisos Rápidos en 1-Clic al Capataz
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 16px' }}>
                Presioná cualquier botón para despachar una novedad estandarizada directamente al celular de Miguel (Capataz) y al Copiloto IA:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { title: 'Llegó el camión de arena gruesa a la puerta', icon: 'fa-truck', color: '#38bdf8' },
                  { title: 'Terminamos la hilada de ladrillos huecos del piso 2', icon: 'fa-trowel-bricks', color: '#22c55e' },
                  { title: 'Falta cal hidratada para continuar la mezcla', icon: 'fa-triangle-exclamation', color: '#f59e0b' },
                  { title: 'Se detectó fuga de agua en caño de alimentación', icon: 'fa-droplet', color: '#ef4444' },
                ].map((rep, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAudioReport(rep.title)}
                    className="btn btn-secondary"
                    style={{ padding: '12px 14px', borderRadius: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa-solid ${rep.icon}`} style={{ color: rep.color, fontSize: '1.1rem' }}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{rep.title}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Enviar con sello de hora y GPS</div>
                    </div>
                    <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}></i>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Message Recorder Simulator */}
            <div className="glass-panel-premium" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-microphone" style={{ color: '#ef4444' }}></i> Enviar Mensaje de Voz con IA
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 16px' }}>
                  El audio será transcripto por Whisper AI, vinculado a la tarea activa en el Gantt y notificado a la dirección técnica.
                </p>

                {/* Mic Record Button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', marginBottom: '16px' }}>
                  <button
                    onClick={() => {
                      if (!isRecording) {
                        setIsRecording(true);
                        addToast('🎙️ Grabando audio de reporte de obra...', 'info');
                        setTimeout(() => {
                          setIsRecording(false);
                          setRecordedAudio({
                            time: '0:14s',
                            text: 'Jefe, acá Juan Gómez. Ya terminamos el armado de hierros en la viga V-12 del nivel más tres. Está lista para que la revise la arquitecta antes del hormigón.'
                          });
                          addToast('✅ Audio transcripto y procesado por Copiloto IA.', 'success');
                        }, 3000);
                      }
                    }}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: isRecording ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                      border: '2px solid #ef4444',
                      color: '#fff',
                      fontSize: '1.4rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isRecording ? '0 0 20px #ef4444' : 'none',
                      transition: 'all 0.3s'
                    }}
                  >
                    <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                  </button>
                  <span style={{ fontSize: '0.75rem', color: isRecording ? '#f87171' : '#94a3b8', marginTop: '10px', fontWeight: 600 }}>
                    {isRecording ? 'Grabando reporte de obra (3s)...' : 'Presionar para grabar mensaje de voz'}
                  </span>
                </div>

                {/* Transcribed Output */}
                {recordedAudio && (
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid #38bdf8', padding: '12px', borderRadius: '0 8px 8px 0', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: '#38bdf8' }}><i className="fa-solid fa-wand-magic-sparkles"></i> Transcripción Inteligente:</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{recordedAudio.time}</span>
                    </div>
                    <p style={{ margin: 0, color: '#e2e8f0', fontStyle: 'italic' }}>
                      "{recordedAudio.text}"
                    </p>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Gantt: V-12 Actualizado</span>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Notificado a Arq. Victoria</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
