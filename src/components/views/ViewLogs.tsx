
import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { AuthUser } from '../../types';
import { DatabaseBackup, Database, Search } from 'lucide-react';

export default function ViewLogs({ user }: { user: AuthUser }) {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const load = () => apiFetch('/api/logs', user.user).then(setData);
  useEffect(() => { load(); }, []);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(d => 
      (d.username?.toLowerCase() || '').includes(q) ||
      (d.acao?.toLowerCase() || '').includes(q) ||
      (d.detalhes?.toLowerCase() || '').includes(q)
    );
  }, [data, search]);

  const handleBackup = () => {
    // window.open will trigger the browser's download dialog because the content disposition is 'attachment'
    window.open(`/api/admin/backup/csv?user=${encodeURIComponent(user.user)}`, '_blank');
  };

  const handleRestore = () => {
     const el = document.createElement('input');
     el.type = 'file';
     el.accept = '.csv';
     el.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm(`Tem certeza que deseja restaurar o banco usando o arquivo ${file.name}? Essa ação pode não ser reversível.`)) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvData = event.target?.result;
            if (typeof csvData === 'string') {
               try {
                   await apiFetch('/api/admin/restore/csv', user.user, 'POST', { csv: csvData });
                   alert('Restore concluído com sucesso!');
                   load();
               } catch (err: any) {
                   alert('Erro no restore: ' + err.message);
               }
            }
        };
        reader.readAsText(file);
     }
     el.click();
  };

  return (
    <div className="space-y-6">
      {user.role === 'LOCADOR_MASTER' && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-4 mt-2 mb-4">
           <button onClick={handleBackup} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded font-medium">
             <DatabaseBackup size={18} /> Backup do Banco
           </button>
           <button onClick={handleRestore} className="flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-100 px-4 py-2 rounded font-medium">
             <Database size={18} /> Restaurar Banco
           </button>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">Logs do Sistema</h2>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar logs..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
        </div>
      </div>
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 w-40 text-slate-600 font-medium">Data/Hora</th>
              <th className="p-3 text-slate-600 font-medium">Usuário</th>
              <th className="p-3 text-slate-600 font-medium">Ação</th>
              <th className="p-3 text-slate-600 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  Nenhum log encontrado para esta pesquisa.
                </td>
              </tr>
            ) : (
              filteredData.map(d => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(d.data_hora).toLocaleString('pt-BR', { timeZone: 'UTC' })}</td>
                  <td className="p-3 font-medium text-slate-800">{d.username}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md inline-block whitespace-nowrap border border-slate-200">
                      {d.acao}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 max-w-md truncate" title={d.detalhes}>{d.detalhes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
