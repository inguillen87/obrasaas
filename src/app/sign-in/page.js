'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, User, KeyRound, HardHat } from 'lucide-react';

export default function SignInPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('director');

    const handleDemoLogin = (role = 'director') => {
        setLoading(true);
        // Set demo cookie / localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('obrasaas_user_role', role);
            localStorage.setItem('obrasaas_demo_mode', 'true');
        }
        setTimeout(() => {
            router.push('/dashboard');
        }, 400);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate Clerk / Custom Auth validation
        setTimeout(() => {
            router.push('/dashboard');
        }, 500);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-950">
            {/* Background Ambient Glow */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none"></div>

            {/* Top Brand Link */}
            <div className="absolute top-8 left-8 z-10">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-all">
                        OS
                    </div>
                    <div>
                        <span className="font-black text-lg tracking-tight text-white block">ObraSaaS</span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Enterprise Platform</span>
                    </div>
                </Link>
            </div>

            <div className="w-full max-w-md mx-auto px-6 py-12 relative z-10">
                {/* 1-Click Instant Demo Card */}
                <div className="mb-6 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-2 border-amber-500/40 rounded-2xl p-5 backdrop-blur-md shadow-xl shadow-amber-500/5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-500/30">
                            <Sparkles className="w-3.5 h-3.5" /> Acceso Inmediato
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">Sin Contraseña</span>
                    </div>
                    <h2 className="text-lg font-black text-white leading-snug">
                        ¿Querés explorar la plataforma?
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 mb-4 leading-relaxed">
                        Entrá al Dashboard con datos de obra reales (Gantt, Curva S, WhatsApp Bot, KYC Biométrico y 3D BIM).
                    </p>

                    {/* Fast Role Switcher */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                            type="button"
                            onClick={() => handleDemoLogin('director')}
                            disabled={loading}
                            className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer">
                            <HardHat className="w-4 h-4" /> Modo Director
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDemoLogin('socia')}
                            disabled={loading}
                            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Dir. Técnica
                        </button>
                    </div>
                </div>

                {/* Standard Login Card */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-black text-white">Iniciar Sesión</h1>
                        <p className="text-xs text-slate-400 mt-1">Ingresá a tu cuenta corporativa de constructora</p>
                    </div>

                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="marcelo@tuconstructora.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Contraseña
                                </label>
                                <a href="#" className="text-xs text-amber-400 hover:underline">¿Olvidaste tu clave?</a>
                            </div>
                            <div className="relative">
                                <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer mt-2">
                            {loading ? 'Ingresando...' : (
                                <>
                                    <span>Ingresar a la Plataforma</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
                        ¿No tenés una cuenta todavía?{' '}
                        <Link href="/sign-up" className="text-amber-400 font-bold hover:underline">
                            Registrar mi Constructora
                        </Link>
                    </div>
                </div>

                {/* Footer Security Badges */}
                <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Cifrado SHA-256</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cumplimiento UOCRA/ART</span>
                </div>
            </div>
        </div>
    );
}
