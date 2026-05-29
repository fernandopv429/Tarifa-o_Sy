
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Locatario, AuthUser } from '../../types';
import { Edit2, Trash2 } from 'lucide-react';

export default function ViewLocatarios({ user }: { user: AuthUser }) {
  const [data, setData] = useState<Locatario[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Locatario>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const load = () => apiFetch('/api/locatarios', user.user).then(setData);
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (form.cnpj_cpf) {
      const regex = /(^\d{3}\.\d{3}\.\d{3}\-\d{2}$)|(^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$)|(^\d{11}$)|(^\d{14}$)/;
      if (!regex.test(form.cnpj_cpf)) {
        setErrorMsg("Formato inválido para CNPJ/CPF. Digite apenas números ou utilize a pontuação correta.");
        return;
      }
    }

    if (form.id) {
      await apiFetch(`/api/locatarios/${form.id}`, user.user, 'PUT', form);
    } else {
      await apiFetch('/api/locatarios', user.user, 'POST', form);
    }
    setShowModal(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('Excluir?')) return;
    await apiFetch(`/api/locatarios/${id}`, user.user, 'DELETE');
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Locatários</h2>
        <input 
          type="text" 
          placeholder="Pesquisar..." 
          className="border border-slate-300 p-2 rounded text-sm w-64 ml-4" 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
        <button onClick={() => { setForm({}); setShowModal(true); }} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded">Novo Locatário</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Nome / Razão</th>
              <th className="p-3">CNPJ/CPF</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Contato</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data).filter((d) => Object.values(d || {}).join(" ").toLowerCase().includes(searchQuery.toLowerCase())).map((d) => (
              <tr key={d.id} className="border-b">
                <td className="p-3">{d.nome}</td>
                <td className="p-3">{d.cnpj_cpf}</td>
                <td className="p-3">{d.telefone}</td>
                <td className="p-3">{d.contato_nome} <br/><span className="text-sm text-gray-500">{d.contato_email}</span></td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => { setForm(d); setShowModal(true); }} className="text-blue-600"><Edit2 size={18}/></button>
                  <button onClick={() => remove(d.id)} className="text-red-600"><Trash2 size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">{form.id ? 'Editar' : 'Novo'} Locatário</h3>
            <form onSubmit={save} className="space-y-4">
              {errorMsg && <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">{errorMsg}</div>}
              <input required placeholder="Nome / Razão" className="w-full border p-2 rounded" value={form.nome||''} onChange={e=>setForm({...form, nome:e.target.value})} />
              <input required placeholder="CNPJ/CPF" pattern="(^[0-9]{3}\.[0-9]{3}\.[0-9]{3}\-[0-9]{2}$)|(^[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}\-[0-9]{2}$)|(^[0-9]{11}$)|(^[0-9]{14}$)" title="Formato inválido. Digite apenas números (11 para CPF, 14 para CNPJ) ou utilize a pontuação completa." className="w-full border p-2 rounded" value={form.cnpj_cpf||''} onChange={e=> { setForm({...form, cnpj_cpf: e.target.value}); if (errorMsg) setErrorMsg(""); }} />
              <input placeholder="Endereço" className="w-full border p-2 rounded" value={form.endereco||''} onChange={e=>setForm({...form, endereco:e.target.value})} />
              <input placeholder="Telefone" className="w-full border p-2 rounded" value={form.telefone||''} onChange={e=>setForm({...form, telefone: e.target.value})} />
              <input placeholder="Nome do Contato" className="w-full border p-2 rounded" value={form.contato_nome||''} onChange={e=>setForm({...form, contato_nome:e.target.value})} />
              <input type="email" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="O email deve conter um domínio válido (ex: @dominio.com.br)" placeholder="Email do Contato" className="w-full border p-2 rounded" value={form.contato_email||''} onChange={e=>setForm({...form, contato_email:e.target.value.toLowerCase().replace(/\s/g, "")})} />
              <input type="text" placeholder="Senha de Acesso (Usuario Master)" className="w-full border p-2 rounded" value={(form as any).senha_master||''} onChange={e=>setForm({...form, senha_master:e.target.value} as any)} />
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
