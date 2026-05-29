import React, { useState } from 'react';
import { AuthUser } from '../types';

export default function ChangePasswordScreen({ user, onSuccess, onCancel }: { user: AuthUser, onSuccess: () => void, onCancel: () => void }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirm) return setError('As senhas não coincidem');
    if (newPass.length < 6) return setError('A nova senha deve ter no mínimo 6 caracteres');
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/tmo/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.user, currentPassword: current, newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">Mudança de Senha Obrigatória</h2>
        <p className="text-sm text-gray-500 mb-8 text-center">Como este é seu primeiro acesso, ou sua senha foi resetada para o padrão, você precisa cadastrar uma nova senha.</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Senha Atual</label>
            <input type="password" required value={current} onChange={e => setCurrent(e.target.value)}
              className="w-full block rounded-lg border-gray-300 shadow-sm border p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nova Senha</label>
            <input type="password" required value={newPass} onChange={e => setNewPass(e.target.value)}
              className="w-full block rounded-lg border-gray-300 shadow-sm border p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Nova Senha</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full block rounded-lg border-gray-300 shadow-sm border p-2.5" />
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onCancel} className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-lg text-white font-medium bg-green-600 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
