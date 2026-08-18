'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PosterPage() {
    const [project, setProject] = useState({
        name: 'Torre Palermo Soho',
        address: 'Honduras 4850, Palermo, CABA',
        director: 'Arq. Marcelo',
        capataz: 'Luis Martínez',
        geofenceRadiusMeters: 100,
        phone: '+1 (555) 153-3706'
    });

    useEffect(() => {
        fetch('/api/state')
            .then(res => res.json())
            .then(data => {
                if (data.projectConfig) {
                    setProject(prev => ({
                        ...prev,
                        name: data.projectConfig.name || prev.name,
                        address: data.projectConfig.address || prev.address,
                        director: data.projectConfig.director?.name || prev.director,
                        capataz: data.projectConfig.capataz?.name || prev.capataz,
                        geofenceRadiusMeters: data.projectConfig.geofenceRadiusMeters || prev.geofenceRadiusMeters
                    }));
                }
            })
            .catch(() => {});
    }, []);

    const whatsappUrl = `https://wa.me/15551533706?text=${encodeURIComponent('Hola, estoy en la obra ' + project.name + ' para registrar mi ingreso.')}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(whatsappUrl)}&margin=15`;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 print:p-0 print:bg-white print:text-black">
            {/* Action Bar (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between print:hidden">
                <Link href="/dashboard" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-700">
                    ← Volver al Dashboard
                </Link>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer">
                        🖨️ Imprimir Cartel de Entrada (A4 / Plotter)
                    </button>
                </div>
            </div>

            {/* Printable Official Jobsite Poster */}
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl shadow-2xl p-10 print:shadow-none print:p-8 print:rounded-none print:max-w-none border-4 border-amber-500">
                {/* Header Banner */}
                <div className="flex items-center justify-between border-b-4 border-slate-900 pb-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black text-3xl shadow-md">
                            🏗️
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-950">OBRASAAS ENTERPRISE</h1>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sistema Oficial de Control de Acceso & Gestión de Obra</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="inline-block px-4 py-1.5 bg-slate-950 text-amber-400 font-black text-sm uppercase tracking-wider rounded">
                            CARTEL OFICIAL DE INGRESO
                        </span>
                        <p className="text-xs text-slate-500 mt-1 font-semibold">Resolución SRT 319/99 • Ley 22.250</p>
                    </div>
                </div>

                {/* Project Info Block */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs uppercase font-bold text-slate-400">Nombre de la Obra</p>
                        <p className="text-2xl font-black text-slate-900">{project.name}</p>
                        <p className="text-sm font-semibold text-slate-600 mt-1">📍 {project.address}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400">Director de Obra</p>
                            <p className="font-bold text-slate-800">{project.director}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400">Capataz General</p>
                            <p className="font-bold text-slate-800">{project.capataz}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400">Geocerca Satelital</p>
                            <p className="font-bold text-emerald-700">Radio {project.geofenceRadiusMeters}m Activo ✅</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400">Línea WhatsApp Bot</p>
                            <p className="font-bold text-slate-800">{project.phone}</p>
                        </div>
                    </div>
                </div>

                {/* QR Section & Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-amber-50/60 border-2 border-amber-300 rounded-2xl p-8 mb-8">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="bg-white p-4 rounded-2xl shadow-xl border-2 border-amber-400">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={qrCodeUrl} 
                                alt="QR Fichaje ObraSaaS" 
                                className="w-56 h-56 object-contain"
                            />
                        </div>
                        <p className="text-xs font-bold text-slate-600 mt-3">Escaneá con la cámara de tu celular</p>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-black text-slate-950 flex items-center gap-2">
                            📱 CÓMO FICHAR TU INGRESO:
                        </h2>
                        
                        <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">1</span>
                            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                                <strong className="text-slate-950">Escaneá el código QR</strong> con tu teléfono para abrir el chat de WhatsApp con el Asistente de Obra.
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">2</span>
                            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                                <strong className="text-slate-950">Compartí tu ubicación</strong> en el chat para validar la geocerca satelital del predio.
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">3</span>
                            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                                <strong className="text-slate-950">Si es tu primer día:</strong> Completá el registro biométrico de DNI y selfie facial en 1 minuto.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Legal Badges Footer */}
                <div className="border-t-2 border-slate-200 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-6">
                        <span>🛡️ Pólizas ART Verificadas</span>
                        <span>👷 Convenio Colectivo UOCRA</span>
                        <span>🔒 Auditoría Criptográfica SHA-256</span>
                    </div>
                    <div>
                        <span>Plataforma Oficial • <strong className="text-slate-900">obrasaas.vercel.app</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
