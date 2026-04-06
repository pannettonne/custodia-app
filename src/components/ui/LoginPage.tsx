'use client'

import { useAuth } from '@/lib/auth-context'
import { Shield, Calendar, Users, Bell } from 'lucide-react'

export function LoginPage() {
  const { signInWithGoogle, loading } = useAuth()

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-2xl shadow-blue-500/30 mb-5">
            <span className="text-4xl">👨‍👩‍👦</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">CustodiaApp</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            Gestión de custodia compartida<br />de forma clara y sencilla
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { icon: Calendar, label: 'Calendario visual', color: 'text-blue-400' },
            { icon: Users, label: 'Dos progenitores', color: 'text-violet-400' },
            { icon: Bell, label: 'Solicitudes de cambio', color: 'text-pink-400' },
            { icon: Shield, label: 'Seguro con Google', color: 'text-green-400' },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl p-3"
            >
              <Icon size={16} className={color} />
              <span className="text-slate-300 text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Google Sign In */}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-black/30 active:scale-95"
        >
          {/* Google SVG */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'Conectando...' : 'Continuar con Google'}
        </button>

        <p className="text-center text-slate-600 text-xs mt-6">
          Tus datos se sincronizan de forma segura.<br />
          Solo tú y el otro progenitor veis el calendario.
        </p>
      </div>
    </div>
  )
}
