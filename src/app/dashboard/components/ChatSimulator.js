"use client";

import React, { useState, useRef, useEffect } from 'react';

export default function ChatSimulator({
  activeTab,
  state,
  setState,
  chatMessages,
  setChatMessages,
  audioData,
  addToast,
  setCopilotMessages,
  playBeep
}) {
  const [chatInput, setChatInput] = useState('');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsLabel, setGpsLabel] = useState('GPS: Obra Palermo Chico');
  const [playingAudioIndex, setPlayingAudioIndex] = useState(null);
  const [simulatedRole, setSimulatedRole] = useState('director');
  const [dispatchPhone, setDispatchPhone] = useState('5492613168608');
  const [dispatching, setDispatching] = useState(false);

  const handleLiveDispatch = async (messageType, customText = '') => {
    setDispatching(true);
    try {
      const res = await fetch('/api/v1/whatsapp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: dispatchPhone,
          messageType,
          customText
        })
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`✅ Mensaje enviado a +${dispatchPhone.slice(-10)} [${messageType}]`, 'success');
      } else {
        if (addToast) addToast(`ℹ️ WhatsApp despachado (Modo sandbox / demo): ${data.error || 'OK'}`, 'info');
      }
    } catch(e) {
      if (addToast) addToast('Error al despachar: ' + e.message, 'danger');
    } finally {
      setDispatching(false);
    }
  };

  const chatMessagesEndRef = useRef(null);
  const waveformRef1 = useRef(null);
  const waveformRef2 = useRef(null);
  const waveformRef3 = useRef(null);
  const waveformRef4 = useRef(null);
  const waveformRefs = { 1: waveformRef1, 2: waveformRef2, 3: waveformRef3, 4: waveformRef4 };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  // Draw Static Waveforms on canvases
  useEffect(() => {
    [1, 2, 3, 4].forEach(idx => {
      const canvas = waveformRefs[idx]?.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        const barWidth = 3;
        const gap = 2;
        for (let i = 0; i < 40; i++) {
          const x = i * (barWidth + gap) + 10;
          const h = Math.random() * 20 + 5;
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    });
  }, [activeTab]);

  // Audio Playback waveform animation
  useEffect(() => {
    if (playingAudioIndex === null) return;
    const canvas = waveformRefs[playingAudioIndex]?.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let progress = 0;
    const heights = Array.from({ length: 40 }, () => Math.random() * 20 + 5);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = 3;
      const gap = 2;
      progress += 0.01;
      if (progress >= 1.0) progress = 1.0;

      for (let i = 0; i < heights.length; i++) {
        const x = i * (barWidth + gap) + 10;
        const barProgress = i / heights.length;
        const animatedHeight = heights[i] + Math.sin(Date.now() * 0.025 + i) * 4;
        const y = (canvas.height - animatedHeight) / 2;

        if (barProgress < progress) {
          ctx.fillStyle = '#ff9f1c'; // Amber progress color
        } else {
          ctx.fillStyle = '#475569'; // Grey default color
        }
        ctx.fillRect(x, y, barWidth, animatedHeight);
      }
      if (progress < 1.0) {
        animationId = requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        const barWidth = 3;
        const gap = 2;
        for (let i = 0; i < heights.length; i++) {
          const x = i * (barWidth + gap) + 10;
          const h = heights[i];
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    };
  }, [playingAudioIndex]);

  // Play simulated audio notes
  const playAudioSim = (index) => {
    if (playingAudioIndex !== null) return;

    setPlayingAudioIndex(index);
    playBeep('start', () => {
      setTimeout(() => {
        playBeep('end', async () => {
          setPlayingAudioIndex(null);

          // Call simulated Webhook API to process the voice note transcription!
          const data = audioData[index];
          try {
            await fetch('/api/whatsapp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: data.from,
                bodyText: data.text,
                mediaUrl: `audio-sim-${index}.mp3`,
                mediaType: "audio/mpeg"
              })
            });

            // Reload state after webhook processed it
            const stateRes = await fetch('/api/state');
            if (stateRes.ok) {
              const stateData = await stateRes.json();
              setState(stateData);
            }

            const messagesRes = await fetch('/api/whatsapp');
            if (messagesRes.ok) {
              const messagesData = await messagesRes.json();
              setChatMessages(messagesData);
            }
            
            // Push smart notification
            if (data.impactClass === 'danger') {
              addToast('Alerta crítica prioritaria de campo: ' + data.actionDesc, 'warning');
            } else {
              addToast('Evento procesado por IA: ' + data.impactTag, 'success');
            }
            
            // Auto Copilot Insights update
            setCopilotMessages(prev => [...prev, { 
                sender: 'bot', 
                text: `**[Alerta de Audio en Vivo]**\nHe interceptado un mensaje de voz de ${data.from}. He procedido a actualizar el Gantt y notificar a los supervisores por precaución.` 
            }]);

          } catch (e) {
            console.error("Audio sim webhook error:", e);
          }
        });
      }, 3000);
    });
  };

  // Replay audio directly from chat bubble
  const replayAudio = () => {
    playBeep('start', () => {
      setTimeout(() => {
        playBeep('end');
      }, 1500);
    });
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatInput('');
    const fromPhone = simulatedRole === 'director' ? '2613168608' : simulatedRole === 'victoria' ? '2964520753' : 'carlos';
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromPhone,
          bodyText: text
        })
      });

      // Fetch updates
      const messagesRes = await fetch('/api/whatsapp');
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setChatMessages(messagesData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Select simulated attachments
  const selectAttachment = async (type) => {
    setAttachmentMenuOpen(false);
    const fromPhone = simulatedRole === 'director' ? '2613168608' : simulatedRole === 'victoria' ? '2964520753' : 'carlos';
    let payload = { from: fromPhone };
    
    if (type === 'document') {
      payload.bodyText = "Documento enviado: planos_palermo_v2.pdf";
      payload.mediaUrl = "planos_palermo_v2.pdf";
      payload.mediaType = "application/pdf";
    } else if (type === 'camera') {
      // Multimodal Chaos Tolerance Simulator (Task 4)
      payload.bodyText = "[IMAGEN BORROSA DETECTADA] - Procesando con Visión Multimodal...";
      payload.mediaUrl = "fachada.jpg";
      payload.mediaType = "image/jpeg";
      
      addToast('Procesando imagen caótica de WhatsApp mediante IA Multimodal...', 'info');
      
      setTimeout(() => {
        addToast('IA: Muro detectado con 85% de avance. Actualizando Gantt.', 'success');
        setCopilotMessages(prev => [...prev, { sender: 'bot', text: '✅ He analizado la foto borrosa enviada desde la obra. Reconozco que es el frente sur y el muro está al 85%. He actualizado el progreso de "Mampostería" en el Gantt.' }]);
      }, 3000);
      
    } else if (type === 'gallery') {
      payload.bodyText = "Imagen de revoque seleccionada";
      payload.mediaUrl = "revoque.jpg";
      payload.mediaType = "image/jpeg";
    } else if (type === 'audio') {
      payload.bodyText = "Audio de obra (5.4s)";
      payload.mediaUrl = "audio.mp3";
      payload.mediaType = "audio/mpeg";
    } else if (type === 'contact') {
      payload.bodyText = "👤 Contacto: Proveedor Arenas";
      payload.mediaUrl = "arenas.vcf";
      payload.mediaType = "text/vcard";
    }

    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.error(e);
    }
  };

  const confirmGpsSend = async () => {
    setGpsModalOpen(false);
    const fromPhone = simulatedRole === 'director' ? '2613168608' : simulatedRole === 'victoria' ? '2964520753' : 'carlos';
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromPhone,
          latitude: -34.5886,
          longitude: -58.4302
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const refreshGpsSearch = () => {
    setGpsLabel("Buscando satélites GPS...");
    setTimeout(() => {
      setGpsLabel("GPS: Obra Palermo Chico (Precisión: 4m)");
    }, 1000);
  };

  return (
    <section id="sec-whatsapp" className={`content-section animate-fade-in-up ${activeTab === 'sec-whatsapp' ? 'active' : ''}`}>
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div className="header-title">
          <h1>Meta WhatsApp Business Hub &amp; Copilot Engine</h1>
          <p>Control central de interacciones por WhatsApp, audios Whisper, OCR fiscal y despacho real a teléfonos móviles.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <i className="fa-solid fa-cloud-bolt"></i> Meta Cloud API Conectada
          </span>
        </div>
      </div>

      {/* Live Dispatcher Control Bar */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '0.88rem', color: '#38bdf8' }}>📱 Rol del Remitente:</strong>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => { setSimulatedRole('director'); setDispatchPhone('5492613168608'); }}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: simulatedRole === 'director' ? '#0284c7' : 'rgba(255,255,255,0.05)',
                  color: simulatedRole === 'director' ? '#fff' : '#94a3b8'
                }}
              >
                👑 Guillermo (Director)
              </button>
              <button
                onClick={() => { setSimulatedRole('victoria'); setDispatchPhone('5492964520753'); }}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: simulatedRole === 'victoria' ? '#0284c7' : 'rgba(255,255,255,0.05)',
                  color: simulatedRole === 'victoria' ? '#fff' : '#94a3b8'
                }}
              >
                📐 Victoria (Dir. Técnica)
              </button>
              <button
                onClick={() => { setSimulatedRole('juan'); setDispatchPhone('5491138452190'); }}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: simulatedRole === 'juan' ? '#0284c7' : 'rgba(255,255,255,0.05)',
                  color: simulatedRole === 'juan' ? '#fff' : '#94a3b8'
                }}
              >
                👷 Operario (Juan)
              </button>
            </div>
          </div>

          {/* Quick Real Dispatch to Mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Teléfono destino:</span>
            <input
              type="text"
              value={dispatchPhone}
              onChange={(e) => setDispatchPhone(e.target.value)}
              placeholder="549..."
              style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.75rem', width: '130px', fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* Action Dispatch Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleLiveDispatch(simulatedRole === 'director' ? 'menu_director' : simulatedRole === 'victoria' ? 'menu_victoria' : 'menu_worker')}
            disabled={dispatching}
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', border: 'none', color: '#fff', fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer' }}
          >
            📲 Enviar Menú Interactivo
          </button>
          <button
            onClick={() => handleLiveDispatch('daily_summary')}
            disabled={dispatching}
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer' }}
          >
            📊 Enviar Resumen Diario
          </button>
          <button
            onClick={() => handleLiveDispatch('recibo_uocra')}
            disabled={dispatching}
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer' }}
          >
            📄 Enviar Recibo UOCRA
          </button>
          <button
            onClick={() => handleLiveDispatch('absence_alert')}
            disabled={dispatching}
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer' }}
          >
            🚨 Probar Alerta Ausentismo (08:30 hs)
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Smartphone Mockup */}
        <div className="phone-frame">
          <div className="phone-notch"></div>
          <div className="whatsapp-simulator">
            <div className="whatsapp-header">
              <div className="whatsapp-contact">
                <div className="whatsapp-avatar">OS</div>
                <div className="whatsapp-contact-details">
                  <span className="whatsapp-contact-name">Asistente ObraSaaS</span>
                  <span className="whatsapp-contact-status">
                    {simulatedRole === 'director' ? '👑 Guillermo (Director)' : simulatedRole === 'victoria' ? '📐 Victoria (Dir. Técnica)' : '👷 Juan Zapata (Armador)'}
                  </span>
                </div>
              </div>
              <div>
                <i className="fa-solid fa-phone" style={{ color: 'var(--text-secondary)', marginRight: '12px', cursor: 'pointer' }}></i>
                <i className="fa-solid fa-ellipsis-vertical" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}></i>
              </div>
            </div>

            {/* Chat messages */}
            <div className="whatsapp-chat-body" style={{ overflowY: 'auto' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`message ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                  {msg.text.includes(' plan') || msg.text.includes('Ubicación') || msg.text.includes('🎙️') || msg.text.includes('📍') || msg.text.includes('📸') ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  ) : msg.text.startsWith('📄') || msg.text.startsWith('📸') || msg.text.startsWith('🖼️') || msg.text.startsWith('👤') ? (
                    <div>{msg.text}</div>
                  ) : msg.text.includes('Audio de obra') || msg.text.includes('Audio ') ? (
                    <div>
                      <div className="audio-player-container" onClick={replayAudio} style={{ minWidth: '180px', marginBottom: '6px', cursor: 'pointer' }} title="Replay Audio">
                        <div className="play-btn" style={{ width: '26px', height: '26px', fontSize: '0.75rem', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'var(--bg-main)' }}><i className="fa-solid fa-play"></i></div>
                        <div style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', background: 'var(--primary)', borderRadius: '2px' }}></div>
                        </div>
                        <i className="fa-solid fa-microphone-lines" style={{ color: '#ff9f1c', fontSize: '0.85rem' }}></i>
                      </div>
                      <span style={{ fontSize: '0.75rem' }}>{msg.text}</span>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  )}
                  <span className="message-time">{msg.time}</span>
                </div>
              ))}
              <div ref={chatMessagesEndRef}></div>
            </div>

            {/* Input Bar */}
            <div className="whatsapp-input-bar">
              <i className="fa-solid fa-paperclip whatsapp-clip-btn" onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)} title="Menú de Adjuntos" style={{ cursor: 'pointer' }}></i>
              <input 
                type="text" 
                className="whatsapp-text-input" 
                placeholder="Pregúntale al bot de obra..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button className="whatsapp-send-btn" onClick={handleSendMessage}><i className="fa-solid fa-paper-plane"></i></button>
            </div>

            {/* Attachment menu */}
            {attachmentMenuOpen && (
              <div className="whatsapp-attachment-menu" style={{ display: 'grid' }}>
                <div className="attachment-item" onClick={() => selectAttachment('document')}>
                  <div className="attachment-icon" style={{ background: '#4285f4' }}><i className="fa-solid fa-file-lines"></i></div>
                  <span>Documento</span>
                </div>
                <div className="attachment-item" onClick={() => selectAttachment('camera')}>
                  <div className="attachment-icon" style={{ background: '#ea4335' }}><i className="fa-solid fa-camera"></i></div>
                  <span>Cámara</span>
                </div>
                <div className="attachment-item" onClick={() => selectAttachment('gallery')}>
                  <div className="attachment-icon" style={{ background: '#a142f4' }}><i className="fa-solid fa-image"></i></div>
                  <span>Galería</span>
                </div>
                <div className="attachment-item" onClick={() => selectAttachment('audio')}>
                  <div className="attachment-icon" style={{ background: '#ff6d01' }}><i className="fa-solid fa-headphones"></i></div>
                  <span>Audio</span>
                </div>
                <div className="attachment-item" onClick={() => { setAttachmentMenuOpen(false); setGpsModalOpen(true); }}>
                  <div className="attachment-icon" style={{ background: '#0f9d58' }}><i className="fa-solid fa-location-dot"></i></div>
                  <span>Ubicación</span>
                </div>
                <div className="attachment-item" onClick={() => selectAttachment('contact')}>
                  <div className="attachment-icon" style={{ background: '#34a853' }}><i className="fa-solid fa-user"></i></div>
                  <span>Contacto</span>
                </div>
              </div>
            )}

            {/* GPS modal */}
            {gpsModalOpen && (
              <div className="gps-share-screen" style={{ display: 'flex' }}>
                <div className="gps-share-header">
                  <i className="fa-solid fa-arrow-left" onClick={() => setGpsModalOpen(false)} style={{ cursor: 'pointer' }}></i>
                  <span>Enviar ubicación</span>
                  <i className="fa-solid fa-rotate-right" onClick={refreshGpsSearch} style={{ cursor: 'pointer' }}></i>
                </div>
                <div className="gps-share-map-preview">
                  <div className="gps-radar-scanner">
                    <div className="radar-circle-1"></div>
                    <div className="radar-circle-2"></div>
                    <div className="radar-dot"></div>
                  </div>
                  <span className="gps-map-label">{gpsLabel}</span>
                </div>
                <div className="gps-share-options">
                  <div className="gps-option-item" onClick={confirmGpsSend}>
                    <div className="gps-option-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}><i className="fa-solid fa-location-crosshairs"></i></div>
                    <div className="gps-option-details">
                      <strong>Compartir ubicación en tiempo real</strong>
                      <span>Actualización satelital en vivo</span>
                    </div>
                  </div>
                  <div className="gps-option-item" onClick={confirmGpsSend}>
                    <div className="gps-option-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--info)' }}><i className="fa-solid fa-building"></i></div>
                    <div className="gps-option-details">
                      <strong>Enviar ubicación actual (Obra)</strong>
                      <span>Fichaje de Asistencia Georreferenciado</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Waveform Controls */}
        <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)' }}>Panel de Simulación de Audios</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Haz clic en reproducir para oír la telemetría sintetizada por **Web Audio API** mientras la IA procesa y transcribe el reporte.
          </p>

          {/* Audio 1 */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clipboard-user" style={{ color: 'var(--success)' }}></i> Audio 1: Fichaje Diario (Ingreso)</strong>
              <span className="badge badge-success">Luis Martínez</span>
            </div>
            <div className="audio-player-container">
              <button className="play-btn" onClick={() => playAudioSim(1)} disabled={playingAudioIndex !== null}>
                <i className={playingAudioIndex === 1 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-1"></i>
              </button>
              <canvas ref={waveformRef1} width="200" height="40" className="waveform-canvas"></canvas>
              <span className="audio-duration">0:08</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              "Hola Marcelo, ya entramos a la obra de Palermo. Todo el equipo listo."
            </p>
          </div>

          {/* Audio 2 */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-chart-line" style={{ color: 'var(--info)' }}></i> Audio 2: Reporte de Avance Diario</strong>
              <span className="badge badge-info">Juan Gómez</span>
            </div>
            <div className="audio-player-container">
              <button className="play-btn" onClick={() => playAudioSim(2)} disabled={playingAudioIndex !== null}>
                <i className={playingAudioIndex === 2 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-2"></i>
              </button>
              <canvas ref={waveformRef2} width="200" height="40" className="waveform-canvas"></canvas>
              <span className="audio-duration">0:12</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              "Terminamos el revoque grueso en la cocina y living. Avanzamos según lo planeado."
            </p>
          </div>

          {/* Audio 3 */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--danger)' }}></i> Audio 3: Incidencia Técnica Crítica</strong>
              <span className="badge badge-danger">Luis Martínez</span>
            </div>
            <div className="audio-player-container">
              <button className="play-btn" onClick={() => playAudioSim(3)} disabled={playingAudioIndex !== null}>
                <i className={playingAudioIndex === 3 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-3"></i>
              </button>
              <canvas ref={waveformRef3} width="200" height="40" className="waveform-canvas"></canvas>
              <span className="audio-duration">0:16</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              "Che, Marcelo, detectamos que la cañería de la descarga del baño principal tiene una fisura y pierde agua, hay que cambiar un codo de PVC de 110."
            </p>
          </div>

          {/* Audio 4 */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clock" style={{ color: 'var(--warning)' }}></i> Audio 4: Demora en Suministros (Cerámicas)</strong>
              <span className="badge badge-warning">Carlos Pérez</span>
            </div>
            <div className="audio-player-container">
              <button className="play-btn" onClick={() => playAudioSim(4)} disabled={playingAudioIndex !== null}>
                <i className={playingAudioIndex === 4 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-4"></i>
              </button>
              <canvas ref={waveformRef4} width="200" height="40" className="waveform-canvas"></canvas>
              <span className="audio-duration">0:14</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              "No nos llegó el camión con las cerámicas para el baño, nos va a demorar 2 días la colocación del revestimiento."
            </p>
          </div>

          {/* Audio 5: Proveedor Confirmando Entrega (Módulo 2B / 4B) */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-truck-ramp-box" style={{ color: 'var(--success)' }}></i> Audio 5: Confirmación de Proveedor (2 días antes)</strong>
              <span className="badge badge-success">Aberturas López</span>
            </div>
            <div className="audio-player-container">
              <button className="play-btn" onClick={() => playAudioSim(5)} disabled={playingAudioIndex !== null}>
                <i className={playingAudioIndex === 5 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-5"></i>
              </button>
              <canvas width="200" height="40" className="waveform-canvas" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}></canvas>
              <span className="audio-duration">0:10</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              "Hola Arq. Marcelo, confirmamos que el flete sale mañana temprano. Entrega en obra a las 09:00 AM."
            </p>
          </div>

          {/* Audio 6: Consulta de Quincena (Módulo 2B) */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-calendar-check" style={{ color: 'var(--info)' }}></i> Audio 6: Consulta de Quincena (Cuadrilla)</strong>
              <span className="badge badge-info">Juan Gómez</span>
            </div>
            <div className="audio-player-container">
              <button className="play-btn" onClick={() => playAudioSim(6)} disabled={playingAudioIndex !== null}>
                <i className={playingAudioIndex === 6 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-6"></i>
              </button>
              <canvas width="200" height="40" className="waveform-canvas" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}></canvas>
              <span className="audio-duration">0:07</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              "Hola Arq. Marcelo, ¿qué tareas nos tocan a la cuadrilla de albañilería en esta quincena?"
            </p>
          </div>

          {/* Sim Check-in & Fast Triggers */}
          <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-map-location-dot" style={{ color: '#60a5fa' }}></i> Simular Fichaje Completo por GPS</strong>
              <span className="badge badge-info">Carlos Pérez</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Simula que el operario envía su ubicación real desde su celular único enlazado para registrar ingreso.
            </p>
            <button className="btn btn-primary btn-sm" onClick={confirmGpsSend} style={{ width: '100%', fontSize: '0.8rem', padding: '10px', background: '#60a5fa', color: '#0a0e17', fontWeight: 700 }}>
              <i className="fa-solid fa-location-arrow"></i> Enviar Ubicación en Tiempo Real
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
