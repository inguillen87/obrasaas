'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, User, KeyRound, Phone, HardHat } from 'lucide-react';

export default function SignUpPage() {
    const router = useRouter();
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('obrasaas_company_name', companyName);
            localStorage.setItem('obrasaas_demo_mode', 'true');
        }
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
                {/* 1-Click Fast Demo Link */}
                <div className="mb-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-300 font-medium">¿Querés probar la demo primero?</span>
                    </div>
                    <Link 
                        href="/dashboard" 
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-all">
                        Abrir Demo 🚀
                    </Link>
                </div>

                {/* Sign Up Form Card */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-black text-white">Comenzá tu Prueba Gratis</h1>
                        <p className="text-xs text-slate-400 mt-1">14 días de acceso completo sin tarjeta de crédito</p>
                    </div>

                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                Empresa Constructora / Estudio
                            </label>
                            <div className="relative">
                                <Building2 className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Constructora del Plata S.A."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                Correo Corporativo
                            </label>
                            <div className="relative">
                                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="direccion@constructora.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                Celular / WhatsApp (Para Notificaciones)
                            </label>
                            <div className="relative">
                                <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+54 9 11 5555-6666"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer mt-2">
                            {loading ? 'Creando Espacio...' : (
                                <>
                                    <span>Crear Cuenta Gratis</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
                        ¿Ya tenés una cuenta?{' '}
                        <Link href="/sign-in" className="text-amber-400 font-bold hover:underline">
                            Iniciar Sesión
                        </Link>
                    </div>
                </div>

                {/* Footer Security Badges */}
                <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Cifrado SHA-256</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cumplimiento Ley 22.250</span>
                </div>
            </div>
        </div>
    );
}
