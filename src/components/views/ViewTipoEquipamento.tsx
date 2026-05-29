
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { AuthUser, TipoEquipamento } from '../../types';
import { Edit2 } from 'lucide-react';

export default function ViewTipoEquipamento({ user }: { user: AuthUser }) {
  const [data, setData] = useState<(TipoEquipamento & { em_uso?: number })[]>([]);
  const [nome, setNome] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const load = () => apiFetch('/api/tipo-equipamentos', user.user).then(setData);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if(!nome) return;
    if (editId) {
       await apiFetch(`/api/tipo-equipamentos/${editId}`, user.user, 'PUT', { nome });
    } else {
       await apiFetch('/api/tipo-equipamentos', user.user, 'POST', { nome });
    }
    setNome('');
    setEditId(null);
    load();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tipos de Equipamento</h2>
         <input 
          type="text" 
          placeholder="Pesquisar..." 
          className="border border-slate-300 p-2 rounded text-sm w-64 ml-4" 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
      </div>
      <div className="flex gap-2 mb-6">
        <input value={nome} onChange={e=>setNome(e.target.value)} placeholder={editId ? "Editar tipo..." : "Novo tipo..."} className="border p-2 rounded flex-1" />
        <button onClick={save} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded">{editId ? 'Salvar' : 'Adicionar'}</button>
        {editId && <button onClick={() => { setEditId(null); setNome(''); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">Cancelar</button>}
      </div>
      <ul className="divide-y border rounded bg-white">
         {data.map(d => (
           <li key={d.id} className="p-3 flex justify-between items-center">
             <span>{d.nome} <span className="text-xs text-slate-400 ml-2">({d.em_uso || 0} em uso)</span></span>
             {d.em_uso === 0 && (
               <button onClick={() => { setEditId(d.id); setNome(d.nome); }} className="text-blue-600 hover:text-blue-800">
                 <Edit2 size={16} />
               </button>
             )}
           </li>
         ))}
      </ul>
    </div>
  );
}
