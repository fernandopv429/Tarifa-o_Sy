
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { maskCpfCnpj } from '../../lib/masks';
import { AuthUser, AppUser, Locatario } from '../../types';
import { Edit2, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function ViewUsuarios({ user }: { user: AuthUser }) {
  const [data, setData] = useState<(AppUser & { locatario_nome?: string; ativo?: boolean })[]>([]);
  const [locatarios, setLocatarios] = useState<Locatario[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<AppUser>&{password?:string, ativo?:boolean}>({});

  const [searchQuery, setSearchQuery] = useState("");
  const load = () => {
    apiFetch('/api/usuarios', user.user).then(setData);
    if(user.role.startsWith('LOCADOR')) apiFetch('/api/locatarios', user.user).then(setLocatarios);
  };
  useEffect(() => { load(); }, []);

  const podeEditar = ['LOCADOR_MASTER', 'LOCADOR', 'LOCATARIO_MASTER'].includes(user.role);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEditar) return;
    if (form.id) {
      await apiFetch(`/api/usuarios/${form.id}`, user.user, 'PUT', form);
    } else {
      let role = form.role || 'LOCATARIO_MASTER';
      if (user.role === 'LOCATARIO_MASTER') { role = 'LOCATARIO_MASTER'; form.locatario_cnpj = user.locatario_cnpj; }
      await apiFetch('/api/usuarios', user.user, 'POST', { ...form, role });
    }
    setShowModal(false);
    load();
  };

  const toggleAtivo = async (d: any) => {
    if (!confirm(d.ativo ? 'Bloquear usuário?' : 'Desbloquear usuário?')) return;
    await apiFetch(`/api/usuarios/${d.id}`, user.user, 'PUT', { ...d, ativo: !d.ativo });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Usuários</h2>
        <input 
          type="text" 
          placeholder="Pesquisar..." 
          className="border border-slate-300 p-2 rounded text-sm w-64 ml-4" 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
        {podeEditar && <button onClick={() => { setForm({ senha_padrao: true, ativo: true }); setShowModal(true); }} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded">Novo Usuário</button>}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Nome</th>
              <th className="p-3">Email/Username</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Empresa (Vínculo)</th>
              <th className="p-3">Status</th>
              {podeEditar && <th className="p-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {(data).filter((d) => Object.values(d || {}).join(" ").toLowerCase().includes(searchQuery.toLowerCase())).map((d) => (
              <tr key={d.id} className={`border-b ${d.ativo === 0 || d.ativo === false ? 'opacity-50' : ''}`}>
                <td className="p-3 flex items-center gap-2">
                  {d.nome}
                </td>
                <td className="p-3">{d.username}</td>
                <td className="p-3">{d.role === 'LOCADOR_MASTER' ? 'Locador Master' : d.role === 'LOCADOR' ? 'Locador' : d.role === 'LOCATARIO_MASTER' ? 'Locatário Master' : d.role === 'LOCATARIO' ? 'Locatário Viewer' : d.role}</td>
                <td className="p-3">{d.locatario_nome || (d.locatario_cnpj ? maskCpfCnpj(d.locatario_cnpj) : '') || '-'}</td>
                <td className="p-3">
                   {d.ativo || d.ativo === undefined ? <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-semibold">Ativo</span> : <span className="text-red-600 bg-red-50 px-2 py-1 flex items-center gap-1 w-max rounded text-xs font-semibold"><ShieldAlert size={14}/> Bloqueado</span>}
                </td>
                {podeEditar && (
                  <td className="p-3 flex gap-2">
                    <button onClick={() => { setForm(d); setShowModal(true); }} className="text-blue-600"><Edit2 size={18}/></button>
                    <button onClick={() => toggleAtivo(d)} className={d.ativo ? "text-red-600" : "text-emerald-600"}>{d.ativo ? "Bloquear" : "Desbloquear"}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
             <h3 className="text-lg font-bold mb-4">{form.id ? 'Editar' : 'Novo'} Usuário</h3>
             <form onSubmit={save} className="space-y-4">
                <input required placeholder="Nome Completo" className="w-full border p-2 rounded" value={form.nome||''} onChange={e=>setForm({...form, nome:e.target.value})} />
                <input type="email" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="O email deve conter um domínio válido (ex: @dominio.com.br)" required placeholder="Email" className="w-full border p-2 rounded" value={form.username||''} onChange={e=>setForm({...form, username:e.target.value.toLowerCase().replace(/\s/g, "")})} />
                <input type={form.id ? "password" : "text"} required={!form.id} placeholder={form.id ? "Nova Senha (opcional)" : "Senha Inicial"} className="w-full border p-2 rounded" value={form.password||''} onChange={e=>setForm({...form, password:e.target.value})} />
                
                {user.role.startsWith('LOCADOR') ? (
                  <>
                    <select required className="w-full border p-2 rounded" value={form.role||''} onChange={e=>setForm({...form, role: e.target.value as any})}>
                      <option value="">Selecione o Tipo</option>
                      <option value="LOCADOR_MASTER">Locador</option>
                      <option value="LOCATARIO_MASTER">Locatário Master</option>
                      <option value="LOCATARIO">Locatário Viewer</option>
                    </select>

                    {(form.role === 'LOCATARIO_MASTER' || form.role === 'LOCATARIO') && (
                      <select required className="w-full border p-2 rounded" value={form.locatario_cnpj||''} onChange={e=>setForm({...form, locatario_cnpj: e.target.value})}>
                        <option value="">Selecione Locatário</option>
                        {locatarios.map(l => <option key={l.cnpj_cpf} value={l.cnpj_cpf}>{l.nome} ({l.cnpj_cpf ? maskCpfCnpj(l.cnpj_cpf) : ''})</option>)}
                      </select>
                    )}
                  </>
                ) : user.role === 'LOCATARIO_MASTER' ? (
                  <>
                    <select required className="w-full border p-2 rounded" value={form.role||''} onChange={e=>setForm({...form, role: e.target.value as any})}>
                      <option value="">Selecione o Perfil</option>
                      <option value="LOCATARIO_MASTER">Locatário Master</option>
                      <option value="LOCATARIO">Locatário Viewer</option>
                    </select>
                  </>
                ) : null}
                
                {form.id && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.senha_padrao||false} onChange={e=>setForm({...form, senha_padrao: e.target.checked})} />
                    Exigir Mudança de Senha no Login
                  </label>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded">Salvar</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
