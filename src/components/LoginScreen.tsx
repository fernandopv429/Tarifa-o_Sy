import React, { useState } from 'react';
import { AuthUser } from '../types';
import { Lock, Mail } from 'lucide-react';

export default function LoginScreen({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/tmo/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao logar');
      onLogin(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="VC Green Sustentabilidade & Inovação" className="h-28 object-contain" onError={(e) => {
            // Fallback if the user hasn't uploaded logo.png to the public folder yet
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextElementSibling) {
              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
            }
          }} />
          <div className="hidden text-center">
            <h2 className="text-3xl font-black tracking-tight mb-1">
              <span className="text-[#C6A27A]">VC</span> <span className="text-slate-900">GREEN</span>
            </h2>
            <p className="text-sm tracking-wide text-slate-800">sustentabilidade & inovação</p>
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email ou CNPJ</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input type="text" title="Insira seu email ou CNPJ (apenas números)" required value={email} onChange={e => setEmail(e.target.value.toLowerCase().replace(/\s/g, ""))}
                className="pl-10 w-full block rounded-lg border-gray-300 shadow-sm focus:border-slate-800 focus:ring-slate-800 bg-gray-50 border p-2.5" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="pl-10 w-full block rounded-lg border-gray-300 shadow-sm focus:border-slate-800 focus:ring-slate-800 bg-gray-50 border p-2.5" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center">
              <input id="remember-me" type="checkbox" className="h-4 w-4 text-slate-800 focus:ring-slate-800 border-gray-300 rounded" />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Lembrar-me
              </label>
            </div>
            <div className="text-sm">
              <button type="button" onClick={() => alert('Para redefinir sua senha, entre em contato com o administrador do sistema.')} className="font-medium text-slate-600 hover:text-slate-800">
                Esqueci minha senha
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 disabled:opacity-50 mt-6">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
      <div className="fixed bottom-4 right-4 text-xs font-mono text-gray-400 opacity-0 hover:opacity-100 transition-opacity duration-300 cursor-default">
        nexusdevhub
      </div>
    </div>
  );
}
