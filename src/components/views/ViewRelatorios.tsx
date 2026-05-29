import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { formatDateUTC } from '../../lib/dateUtils';
import { AuthUser, Locatario, Equipamento } from '../../types';
import { Download } from 'lucide-react';

export default function ViewRelatorios({ user }: { user: AuthUser }) {
  const [data, setData] = useState<any[]>([]);
  const [locatarios, setLocatarios] = useState<Locatario[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  
  const [filtroLocatario, setFiltroLocatario] = useState("");
  const [filtroEquipamento, setFiltroEquipamento] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if(user.role.startsWith('LOCADOR')) {
      apiFetch('/api/locatarios', user.user).then(setLocatarios);
    }
    apiFetch('/api/equipamentos', user.user).then(setEquipamentos);
  }, [user]);

  const loadRelatorio = async () => {
    setLoading(true);
    let url = '/api/telemetria?';
    if (filtroLocatario) url += `locatario_cnpj=${filtroLocatario}&`;
    if (filtroEquipamento) url += `equipamento=${filtroEquipamento}&`;
    if (dataInicio) url += `data_inicio=${dataInicio}&`;
    if (dataFim) url += `data_fim=${dataFim}&`;
    
    try {
      const res = await apiFetch(url, user.user);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  const exportarCsv = () => {
     let csv = "ID O.S.,Equipamento,Data,Locatario CNPJ,Operador,OS Info\n";
     data.forEach(d => {
        csv += `"${d.id}","${d.equipamento}","${d.data_leitura ? formatDateUTC(d.data_leitura) : ''}","${d.locatario_cnpj||''}","${d.operador||''}","${d.os||''}"\n`;
     });
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `relatorio_os_${new Date().getTime()}.csv`;
     a.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Relatório de O.S.</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {user.role.startsWith('LOCADOR') && (
            <div>
              <label className="block text-sm text-slate-600 mb-1">Locatário</label>
              <select className="w-full border p-2 rounded" value={filtroLocatario} onChange={e => setFiltroLocatario(e.target.value)}>
                <option value="">Todos</option>
                {locatarios.map(l => <option key={l.cnpj_cpf} value={l.cnpj_cpf}>{l.nome}</option>)}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm text-slate-600 mb-1">Equipamento</label>
            <select className="w-full border p-2 rounded" value={filtroEquipamento} onChange={e => setFiltroEquipamento(e.target.value)}>
              <option value="">Todos</option>
              {equipamentos.filter(e => !filtroLocatario || e.locatario_cnpj === filtroLocatario).map(eq => (
                 <option key={eq.codigo} value={eq.codigo}>{eq.nome || eq.codigo}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Data Início</label>
            <input type="date" className="w-full border p-2 rounded" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Data Fim</label>
            <input type="date" className="w-full border p-2 rounded" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
           <button onClick={loadRelatorio} disabled={loading} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded font-medium disabled:opacity-50">
             {loading ? 'Gerando...' : 'Gerar Relatório'}
           </button>
           
           {data.length > 0 && (
              <button onClick={exportarCsv} className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded font-medium">
                <Download size={18} /> Exportar CSV
              </button>
           )}
        </div>
      </div>

      {data.length > 0 && (
         <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h3 className="text-lg font-bold mb-4">Resultados ({data.length})</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse text-sm">
               <thead>
                 <tr className="bg-gray-100 border-b">
                   <th className="p-3">Data</th>
                   <th className="p-3">Equipamento</th>
                   <th className="p-3">Operador</th>
                   <th className="p-3">Detalhes O.S.</th>
                 </tr>
               </thead>
               <tbody>
                 {data.map(d => (
                   <tr key={d.id} className="border-b">
                     <td className="p-3">{d.data_leitura ? formatDateUTC(d.data_leitura) : ''} {d.hora_leitura}</td>
                     <td className="p-3 font-mono">{d.equipamento}</td>
                     <td className="p-3">{d.operador}</td>
                     <td className="p-3 text-xs">{d.os}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}
    </div>
  );
}
