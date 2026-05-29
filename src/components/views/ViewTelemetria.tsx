
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { AuthUser, Telemetria } from '../../types';
import { Download, Edit2, Trash2 } from 'lucide-react';
import { formatDateUTC } from '../../lib/dateUtils';

export default function ViewTelemetria({ user, defaultSearch }: { user: AuthUser, defaultSearch?: string }) {
  const [data, setData] = useState<Telemetria[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState(defaultSearch || '');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const load = () => {
    setLoading(true);
    apiFetch('/api/telemetria', user.user)
      .then((res: any[]) => {
        setData(res);
        if (defaultSearch) {
          const matching = res.find(t => t.equipamento === defaultSearch);
          if (matching) {
             const group = {
               equipamento: matching.equipamento,
               latest: matching,
               logs: res.filter(t => t.equipamento === defaultSearch)
             };
             setSelectedGroup(group);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const generateCsv = () => {
     let csv = "ID,OS,Operador,Equipamento,Data,Hora,Lat,Lon\n";
     data.forEach(d => csv += `${d.id},${d.os},${d.operador},${d.equipamento},${formatDateUTC(d.data_leitura)},${d.hora_leitura},${d.lat},${d.lon}\n`);
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = 'telemetria.csv';
     a.click();
  };

  // Group by equipamento
  const groupsRecord: Record<string, any> = {};
  data.forEach(t => {
    if (!groupsRecord[t.equipamento]) {
      groupsRecord[t.equipamento] = {
        equipamento: t.equipamento,
        latest: t,
        logs: []
      };
    }
    groupsRecord[t.equipamento].logs.push(t);
  });
  const groups = Object.values(groupsRecord);

  const filteredGroups = groups.filter(g => 
    g.equipamento.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.latest.mac && g.latest.mac.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col flex-1 pb-2">
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-xl font-bold text-slate-800">Telemetria / OS</h2>
        <button onClick={generateCsv} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors">
          <Download size={16}/> Exportar CSV
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 gap-6 pb-6 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Menu Lateral de Dispositivos */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
             <div className="flex gap-3 items-center mb-4">
                <h3 className="text-slate-800 font-medium text-lg">Dispositivos</h3>
                {loading && <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>}
             </div>
             <div className="relative w-full">
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Buscar Equipamento..." 
                 className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 transition-all bg-white"
               />
               <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
             </div>
          </div>
          
          {filteredGroups.length === 0 ? (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-400 text-center">
              <p className="font-medium text-slate-500">{loading ? 'Carregando...' : 'Nenhum equipamento.'}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 no-scrollbar">
              {filteredGroups.map((group) => (
                <div 
                  key={group.equipamento} 
                  onClick={() => setSelectedGroup(group)} 
                  className={`p-4 cursor-pointer transition-colors ${selectedGroup?.equipamento === group.equipamento ? 'bg-slate-100 border-l-4 border-slate-800' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                      <h4 className="text-slate-900 font-medium truncate">{group.equipamento}</h4>
                      <p className="text-[11px] text-blue-600 truncate mt-0.5">{group.latest.locatario_nome || 'Empresa não vinculada'}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">{group.latest.mac || group.latest.os || 'N/A'}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                      {group.logs.length} OS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel Principal de Detalhes */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
           {!selectedGroup ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                 <h2 className="text-xl font-medium text-slate-600">Selecione um dispositivo</h2>
                 <p className="mt-2 text-sm text-slate-500 max-w-sm">Escolha um equipamento no menu lateral para visualizar seu histórico, status e gerenciar as Ordens de Serviço.</p>
              </div>
           ) : (
              <div className="flex flex-col h-full">
                 <div className="p-6 border-b border-slate-100 bg-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                       <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">{selectedGroup.equipamento}</h2>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {selectedGroup.latest.locatario_nome || 'Sem Vínculo'}
                          </span>
                       </div>
                       <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                             <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Com Registros
                          </span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 no-scrollbar">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Última Leitura</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Sistema (OS)</p>
                        <p className="font-medium text-slate-800 truncate">{selectedGroup.latest.os || 'N/A'}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Firmware</p>
                        <p className="font-medium text-slate-800 truncate">{selectedGroup.latest.fw || 'N/A'} {selectedGroup.latest.build_num ? `(${selectedGroup.latest.build_num})` : ''}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Operador / Placa</p>
                        <p className="font-medium text-slate-800 truncate">{selectedGroup.latest.operador || 'N/A'}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Data / Hora</p>
                        <p className="font-medium text-slate-800 truncate text-sm">{formatDateUTC(selectedGroup.latest.data_leitura)} {selectedGroup.latest.hora_leitura}</p>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Histórico de Eventos ({selectedGroup.logs.length})</h4>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                              <th className="p-3 pl-4">Data / Hora</th>
                              <th className="p-3">O.S.</th>
                              <th className="p-3">Operador</th>
                              <th className="p-3">Firmware</th>
                              <th className="p-3 pr-4">Lat / Lon</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedGroup.logs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 pl-4 whitespace-nowrap text-slate-700 font-medium text-[11px]">
                                  {formatDateUTC(log.data_leitura)} {log.hora_leitura}
                                </td>
                                <td className="p-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">
                                    {log.os || 'Sem OS'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-700 text-[11px] truncate max-w-[120px]">
                                  {log.operador || '-'}
                                </td>
                                <td className="p-3 text-slate-700 text-[11px]">
                                  {log.fw || '-'}
                                </td>
                                <td className="p-3 pr-4 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                                  {log.lat}, {log.lon}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
