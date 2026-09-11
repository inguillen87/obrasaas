"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, ProgressBar, PageHeader } from '@/lib/design-system';

export default function SostenibilidadPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('carbono'); // 'carbono' | 'modulos' | 'fijaciones' | 'fsc'
    const [updatingAssembly, setUpdatingAssembly] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/v1/sostenibilidad');
            const json = await res.json();
            if (json.success) {
                setData(json);
            }
        } catch (err) {
            console.error('Error fetching sustainability data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdvanceModule = async () => {
        setUpdatingAssembly(true);
        try {
            const res = await fetch('/api/v1/sostenibilidad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_assembly', montadosDelta: 1, tornillosDelta: 120 })
            });
            const json = await res.json();
            if (json.success) {
                await fetchData();
            }
        } catch (e) {
            console.error('Error advancing module assembly:', e);
        } finally {
            setUpdatingAssembly(false);
        }
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(
            `🌱 *Informe ESG & Construcción Sostenible — ObraSaaS*\n\n` +
            `• *Proyecto:* Torre Palermo Soho\n` +
            `• *Dirección Técnica:* Arq. María Victoria Schiaffino & Arq. Marcelo Guillén\n` +
            `• *Sistema:* ${data?.metrics?.tipoSistema || 'Wood Frame Industrializado'}\n` +
            `• *CO2 Capturado:* ${data?.derived?.toneladasCO2Netas || '43.6'} Tn CO2e fijadas\n` +
            `• *Reducción de Huella:* -${data?.metrics?.reduccionHuellaPct || '68.4'}% vs hormigón tradicional\n` +
            `• *Módulos Montados:* ${data?.metrics?.modulosOffSite?.montadosObra || 10}/${data?.metrics?.modulosOffSite?.total || 16} (${data?.derived?.percentMounted || 62}%)\n` +
            `• *Certificación:* ${data?.metrics?.certificacion || 'FSC / PEFC #ARG-2026-442'}\n\n` +
            `🔗 Ver reporte interactivo: https://obrasaas.vercel.app/sostenibilidad`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div style={{ minHeight: '100vh', background: '#060913', color: '#f8fafc', fontFamily: tokens.font.sans, padding: 'clamp(16px, 3vw, 32px)' }}>
            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
                <PageHeader
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span>🌱 Construcción Sostenible & Madera Modular</span>
                            <Badge color="#10b981" variant="subtle">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                    ESG Certificado
                                </span>
                            </Badge>
                        </div>
                    }
                    subtitle="Panel de descarbonización, captura de CO2, cadena de custodia FSC y montaje de módulos off-site (Especialidad Arq. María Victoria Schiaffino)"
                    breadcrumbs={[
                        { label: 'Dashboard', href: '/dashboard' },
                        { label: 'Portal Inversor', href: '/portal' },
                        { label: 'Sostenibilidad & Madera Modular' }
                    ]}
                    actions={
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                                <Button variant="ghost">← Dashboard</Button>
                            </Link>
                            <Link href="/cronograma" style={{ textDecoration: 'none' }}>
                                <Button variant="secondary">📅 Cronograma Gantt</Button>
                            </Link>
                            <Button variant="primary" icon="💬" onClick={handleShareWhatsApp}>
                                Compartir Informe ESG en WhatsApp
                            </Button>
                        </div>
                    }
                />

                {/* KPI Top Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    <GlassCard style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>CO2 Capturado en Estructura</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>
                            {data?.derived?.toneladasCO2Netas || '43.6'} Tn
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#86efac' }}>
                            🌳 Equivalente a {data?.derived?.equivalenteArbolesPlantados?.toLocaleString('es-AR') || '1.984'} árboles plantados
                        </div>
                    </GlassCard>

                    <GlassCard style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Reducción vs Hormigón Tradicional</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', margin: '4px 0' }}>
                            -{data?.metrics?.reduccionHuellaPct || '68.4'}%
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#7dd3fc' }}>
                            📉 {data?.derived?.toneladasCO2Evitadas || '31.5'} Tn CO2 evitadas en emisiones
                        </div>
                    </GlassCard>

                    <GlassCard style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Módulos Off-Site Ensamblados</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>
                            {data?.metrics?.modulosOffSite?.montadosObra || 10} / {data?.metrics?.modulosOffSite?.total || 16}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#fbbf24' }}>
                            ⚡ {data?.derived?.percentMounted || 62}% montados ({data?.metrics?.modulosOffSite?.tiempoMontajePromedioHoras || 4.2}h / módulo)
                        </div>
                    </GlassCard>

                    <GlassCard style={{ padding: '20px', borderLeft: '4px solid #a855f7' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Ahorro de Tiempo Total</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#a855f7', margin: '4px 0' }}>
                            +{data?.metrics?.ahorroTiempoSemanas || 6.5} sem
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#d8b4fe' }}>
                            ⏱️ Reducción del 35% del cronograma de obra
                        </div>
                    </GlassCard>
                </div>

                {/* Tabs Navigation */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                    {[
                        { id: 'carbono', label: '🌿 Balance de Carbono & Huella ESG' },
                        { id: 'modulos', label: '🏗️ Industrialización & Módulos Off-Site' },
                        { id: 'fijaciones', label: '🔩 Tornillería & Fijaciones Estructurales' },
                        { id: 'fsc', label: '📜 Madera Certificada FSC / IRAM' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            style={{
                                padding: '10px 18px',
                                borderRadius: '8px',
                                background: activeTab === t.id ? '#10b981' : 'transparent',
                                color: activeTab === t.id ? '#060913' : '#94a3b8',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab 1: Carbon Balance */}
                {activeTab === 'carbono' && (
                    <GlassCard style={{ padding: '32px', marginBottom: '28px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
                            🌿 Ciclo de Vida y Balance Neto de Descarbonización
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 24px' }}>
                            El modelo de construcción modular en madera actúa como un sumidero de carbono a largo plazo, capturando CO2 atmosférico durante el crecimiento forestal y evitando las altas emisiones del clínker y el acero.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981', marginBottom: '12px' }}>
                                    🌳 Sumidero de Carbono (Madera Instalada)
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                                    • <strong>Volumen estructural:</strong> {data?.metrics?.m3MaderaInstalada || 48.5} m³ de madera seca tratada.<br />
                                    • <strong>Factor de fijación:</strong> ~900 kg de CO2e capturado por m³.<br />
                                    • <strong>Carbono fijado total:</strong> {data?.derived?.toneladasCO2Netas || '43.6'} Toneladas de CO2e.<br />
                                    • <strong>Permanencia en estructura:</strong> +75 años de vida útil certificada.
                                </div>
                            </div>

                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
                                    📉 Emisiones Evitadas vs Estructura Tradicional
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                                    • <strong>Estructura tradicional H°A° equivalente:</strong> 52.4 Tn CO2e emitidas.<br />
                                    • <strong>Estructura modular Wood Frame + CLT:</strong> 8.7 Tn CO2e emitidas.<br />
                                    • <strong>Ahorro neto de emisiones:</strong> {data?.derived?.toneladasCO2Evitadas || '31.5'} Toneladas.<br />
                                    • <strong>Desempeño térmico:</strong> K = 0.28 W/m²K (42% de ahorro en climatización).
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#86efac' }}>Cumplimiento Norma IRAM 11507 & Res. GCBA Eficiencia Energética</span>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Apto para bonificaciones de ABL y certificaciones internacionales LEED / EDGE</div>
                            </div>
                            <Badge color="#10b981" variant="filled">Etiqueta Energética A+</Badge>
                        </div>
                    </GlassCard>
                )}

                {/* Tab 2: Modules Off-Site */}
                {activeTab === 'modulos' && (
                    <GlassCard style={{ padding: '32px', marginBottom: '28px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                                    🏗️ Estado de Industrialización Off-Site & Montaje en Obra
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                                    Fabricación en taller cerrado con control milimétrico de calidad y montaje veloz en obra
                                </p>
                            </div>
                            <Button variant="primary" icon="➕" onClick={handleAdvanceModule} disabled={updatingAssembly}>
                                {updatingAssembly ? 'Actualizando...' : 'Registrar Montaje de Módulo'}
                            </Button>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                                <span>Avance del Montaje ({data?.metrics?.modulosOffSite?.montadosObra || 10} de {data?.metrics?.modulosOffSite?.total || 16} Módulos)</span>
                                <span style={{ color: '#f59e0b' }}>{data?.derived?.percentMounted || 62}% Completo</span>
                            </div>
                            <ProgressBar progress={data?.derived?.percentMounted || 62} color="#f59e0b" />
                        </div>

                        {/* Module Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                            {Array.from({ length: data?.metrics?.modulosOffSite?.total || 16 }).map((_, idx) => {
                                const modNum = idx + 1;
                                const isMounted = modNum <= (data?.metrics?.modulosOffSite?.montadosObra || 10);
                                const isTransport = !isMounted && modNum <= ((data?.metrics?.modulosOffSite?.montadosObra || 10) + (data?.metrics?.modulosOffSite?.enTransporte || 2));
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '14px',
                                            borderRadius: '10px',
                                            background: isMounted ? 'rgba(16, 185, 129, 0.12)' : isTransport ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${isMounted ? '#10b981' : isTransport ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{isMounted ? '✅' : isTransport ? '🚚' : '🏭'}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>Módulo #{modNum}</div>
                                        <div style={{ fontSize: '0.7rem', color: isMounted ? '#86efac' : isTransport ? '#7dd3fc' : '#94a3b8', marginTop: '4px', fontWeight: 700 }}>
                                            {isMounted ? 'Montado en Obra' : isTransport ? 'En Transporte' : 'En Fabricación'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ background: 'rgba(6,9,19,0.85)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                            <div>⏱️ <strong>Tiempo por módulo:</strong> 4.2 hs (promedio de grúa e izaje)</div>
                            <div>👷 <strong>Cuadrilla de montaje:</strong> 4 operarios especializados + 1 supervisor</div>
                            <div>📐 <strong>Tolerancia milimétrica:</strong> ± 1.5 mm</div>
                        </div>
                    </GlassCard>
                )}

                {/* Tab 3: Fasteners */}
                {activeTab === 'fijaciones' && (
                    <GlassCard style={{ padding: '32px', marginBottom: '28px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                            🔩 Control de Fijaciones y Tornillería Estructural de Alta Resistencia
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 24px' }}>
                            Garantía de ductilidad antisísmica, anclaje de hold-downs y calibración dinamométrica conforme norma IRAM 11556
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tornillos Instalados</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#c084fc', margin: '4px 0' }}>
                                    {data?.metrics?.tornilleriaFijaciones?.instalados?.toLocaleString('es-AR') || '1.850'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#d8b4fe' }}>De {data?.metrics?.tornilleriaFijaciones?.totalProyectado?.toLocaleString('es-AR') || '2.400'} proyectados ({data?.derived?.percentFasteners || 77}%)</div>
                            </div>

                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Resistencia al Corte Certificada</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', margin: '4px 0' }}>
                                    {data?.metrics?.tornilleriaFijaciones?.resistenciaCertificadaKN || 28.5} kN
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#7dd3fc' }}>Ensayado en laboratorio conforme CIRSOC 601</div>
                            </div>

                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Proveedor Homologado</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', margin: '4px 0' }}>
                                    Rothoblaas / Spax
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#86efac' }}>Tornillos VGZ con tratamiento anticorrosivo</div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(6,9,19,0.85)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#fff' }}>📋 Registro de Ensayos Dinamométricos y Tirantes:</h4>
                            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                                • <strong>Anclajes Hold-Down a Fundación:</strong> 32/32 inspeccionados y torqueados a 85 N·m.<br />
                                • <strong>Conexiones Muro-Techo (Hurricane Ties):</strong> 120/120 colocadas con tornillo Heco-Topix 6.0x100mm.<br />
                                • <strong>Juntas entre Paneles Modulares:</strong> Conexión con doble chapa perforada y bulones grado 8.8.
                            </div>
                        </div>
                    </GlassCard>
                )}

                {/* Tab 4: FSC Timber */}
                {activeTab === 'fsc' && (
                    <GlassCard style={{ padding: '32px', marginBottom: '28px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
                            📜 Certificación Forestal FSC / PEFC y Cadena de Custodia
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 24px' }}>
                            Trazabilidad completa desde plantaciones sustentables certificadas de Misiones y Corrientes hasta la estructura de obra
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', marginBottom: '10px' }}>
                                    🌲 Especies Estructurales Empleadas
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                                    • <strong>Pino Elliotis / Taeda:</strong> Tratado con CCA vacío-presión (IRAM 9662) para tirantería y muros.<br />
                                    • <strong>Eucalipto Grandis Laminado (Glulam):</strong> Para vigas maestras y dinteles de grandes luces.<br />
                                    • <strong>Tableros OSB Estructurales:</strong> 15mm Kronospan con barrera de vapor hidrófuga Tyvek.
                                </div>
                            </div>

                            <div style={{ background: 'rgba(6,9,19,0.85)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981', marginBottom: '10px' }}>
                                    🏷️ Datos de Cadena de Custodia
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                                    • <strong>Certificado N°:</strong> {data?.metrics?.certificacion || 'FSC / PEFC #ARG-2026-442'}<br />
                                    • <strong>Aserradero Certificado:</strong> Forestal Bosques del Plata S.A. (Misiones)<br />
                                    • <strong>Contenido de Humedad:</strong> Verificado ≤ 14% mediante xilohigrómetro.<br />
                                    • <strong>Auditoría Ambiental:</strong> 100% madera libre de deforestación nativa.
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                )}

                {/* Footer Credits */}
                <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#64748b', marginTop: '40px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                    ObraSaaS Sustainable ConTech • Dirección Técnica: <strong>Arq. María Victoria Schiaffino & Arq. Marcelo Guillén</strong> • Conforme CIRSOC 601 & Ley 6.100 GCBA
                </div>
            </div>
        </div>
    );
}
