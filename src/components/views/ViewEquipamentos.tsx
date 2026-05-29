
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { AuthUser, Equipamento, TipoEquipamento, Locatario } from '../../types';
import { Edit2, Trash2, Download } from 'lucide-react';

export default function ViewEquipamentos({ user }: { user: AuthUser }) {
  const [data, setData] = useState<Equipamento[]>([]);
  const [tipos, setTipos] = useState<TipoEquipamento[]>([]);
  const [locatarios, setLocatarios] = useState<Locatario[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Equipamento>>({ ativo: true });

  const [searchQuery, setSearchQuery] = useState("");
  const load = () => {
    apiFetch('/api/equipamentos', user.user).then(setData);
    if(user.role.startsWith('LOCADOR')) {
      apiFetch('/api/locatarios', user.user).then(setLocatarios);
    }
  };
  useEffect(() => { load(); apiFetch('/api/tipo-equipamentos', user.user).then(setTipos); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.id) {
      await apiFetch(`/api/equipamentos/${form.id}`, user.user, 'PUT', form);
    } else {
      await apiFetch('/api/equipamentos', user.user, 'POST', form);
    }
    setShowModal(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('Excluir?')) return;
    await apiFetch(`/api/equipamentos/${id}`, user.user, 'DELETE');
    load();
  };
  
  const generateCsv = () => {
     let csv = "ID,Nome,Codigo,Tipo,Locatario,Ativo,DataCadastro\n";
     data.forEach(d => csv += `${d.id},${d.nome || ''},${d.codigo},${d.tipo_nome},${d.locatario_nome},${d.ativo},${new Date(d.data_cadastro).toLocaleString()}\n`);
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = 'equipamentos.csv';
     a.click();
  };

  const podeEditar = user.role.startsWith('LOCADOR');

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Equipamentos</h2>
        <input 
          type="text" 
          placeholder="Pesquisar..." 
          className="border border-slate-300 p-2 rounded text-sm w-64 ml-4" 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
        <div className="flex gap-2">
          <button onClick={generateCsv} className="bg-gray-600 text-white px-4 py-2 rounded flex items-center gap-2"><Download size={18}/> Exportar CSV</button>
          {podeEditar && <button onClick={() => { setForm({ativo:true}); setShowModal(true); }} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded">Novo</button>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Nome</th>
              <th className="p-3">Código</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Locatário</th>
              <th className="p-3">Status</th>
              <th className="p-3">Total O.S.</th>
              {podeEditar && <th className="p-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {(data).filter((d) => Object.values(d || {}).join(" ").toLowerCase().includes(searchQuery.toLowerCase())).map((d) => (
              <tr key={d.id} className="border-b">
                <td className="p-3 font-medium">{d.nome || '-'}</td>
                <td className="p-3 font-mono">{d.codigo}</td>
                <td className="p-3">{d.tipo_nome || <span className="text-slate-400 italic">Sem Tipo</span>}</td>
                <td className="p-3">{d.locatario_nome || d.locatario_cnpj || <span className="text-slate-400 italic">Sem Empresa</span>}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${d.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {d.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3 font-medium">{d.totalOs || 0}</td>
                {podeEditar && (
                  <td className="p-3 flex gap-2">
                    <button onClick={() => { setForm(d); setShowModal(true); }} className="text-blue-600"><Edit2 size={18}/></button>
                    <button onClick={() => remove(d.id)} className="text-red-600"><Trash2 size={18}/></button>
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
            <h3 className="text-lg font-bold mb-4">{form.id ? 'Editar' : 'Novo'} Equipamento</h3>
            <form onSubmit={save} className="space-y-4">
              <input placeholder="Nome do Equipamento (Opcional)" className="w-full border p-2 rounded" value={form.nome||''} onChange={e=>setForm({...form, nome:e.target.value})} />
              <input required placeholder="Código Identificador (VCGREEN-...)" className="w-full border p-2 rounded font-mono" value={form.codigo||''} onChange={e=>setForm({...form, codigo:e.target.value})} />
              
              <select required className="w-full border p-2 rounded" value={form.tipo_id||''} onChange={e=>setForm({...form, tipo_id: e.target.value ? parseInt(e.target.value) : undefined})}>
                <option value="">Selecione o Tipo</option>
                {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>

              <select required className="w-full border p-2 rounded" value={form.locatario_cnpj||''} onChange={e=>setForm({...form, locatario_cnpj: e.target.value})}>
                <option value="">Selecione o Locatário</option>
                {locatarios.map(l => <option key={l.cnpj_cpf} value={l.cnpj_cpf}>{l.nome} ({l.cnpj_cpf})</option>)}
              </select>
              
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form, ativo: e.target.checked})} />
                Ativo
              </label>

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
