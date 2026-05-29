
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { AuthUser } from '../../types';
import ViewTelemetria from './ViewTelemetria';
import { formatDateUTC, formatFullDateUTC } from '../../lib/dateUtils';

export default function ViewDashboardIndex({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<any[]>([]);
  const [globalTotals, setGlobalTotals] = useState({ equip: 0, ativos: 0, inativos: 0, os: 0 });
  const [equipamentosList, setEquipamentosList] = useState<any[]>([]);
  const [telemetriaList, setTelemetriaList] = useState<any[]>([]);
  
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/equipamentos', user.user),
      apiFetch('/api/telemetria', user.user)
    ]).then(([equipamentos, telemetria]) => {
      setEquipamentosList(equipamentos);
      setTelemetriaList(telemetria);
      
      const grouped: Record<string, any> = {};
      let totalEquip = 0, totalAtivos = 0, totalInativos = 0, totalOs = 0;

      equipamentos.forEach((e: any) => {
         const key = e.locatario_cnpj || 'Sem Empresa';
         if (!grouped[key]) grouped[key] = { razao: e.locatario_nome || key, cnpj: key, numEquip: 0, numOs: 0, numAtivos: 0, numInativos: 0 };
         grouped[key].numEquip++;
         totalEquip++;
         if (e.ativo) {
           grouped[key].numAtivos++;
           totalAtivos++;
         } else {
           grouped[key].numInativos++;
           totalInativos++;
         }
         
         const equipTels = telemetria.filter((t: any) => String(t.equipamento).trim().toLowerCase() === String(e.codigo).trim().toLowerCase());
         grouped[key].numOs += equipTels.length;
         totalOs += equipTels.length;
      });

      // Just in case we also want to catch OS that have NO equipment in the system
      const osWithoutEquipment = telemetria.filter((t: any) => !equipamentos.find((e:any) => String(e.codigo).trim().toLowerCase() === String(t.equipamento).trim().toLowerCase()));
      osWithoutEquipment.forEach((t: any) => {
         const key = t.locatario_cnpj || 'Sem Empresa';
         if (!grouped[key]) grouped[key] = { razao: t.locatario_nome || key, cnpj: key, numEquip: 0, numOs: 0, numAtivos: 0, numInativos: 0 };
         // Only increment if it wasn't already included in equipment counts, but wait, if it's orphan, we just increment. 
         grouped[key].numOs++;
         totalOs++;
      });
      setStats(Object.values(grouped));
      setGlobalTotals({ equip: totalEquip, ativos: totalAtivos, inativos: totalInativos, os: totalOs });
    });
  }, [user]);

  if (selectedEquipment) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
        <div className="flex items-center gap-4 mb-2 shrink-0">
          <button onClick={() => setSelectedEquipment(null)} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            &larr; Voltar
          </button>
        </div>
        <ViewTelemetria user={user} defaultSearch={selectedEquipment} />
      </div>
    );
  }

  if (selectedCompany) {
    const compStats = stats.find(s => s.cnpj === selectedCompany);
    const compsEquips = equipamentosList.filter(e => (e.locatario_cnpj || 'Sem Empresa') === selectedCompany).map(e => {
       const equipTels = telemetriaList.filter(t => String(t.equipamento).trim().toLowerCase() === String(e.codigo).trim().toLowerCase());
       const latest = equipTels.sort((a,b) => new Date(b.data_leitura).getTime() - new Date(a.data_leitura).getTime())[0];
       return { ...e, totalOs: equipTels.length, latest_data: latest?.data_leitura, latest_hora: latest?.hora_leitura };
    });
    
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedCompany(null)} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            &larr; Voltar
          </button>
          <h2 className="text-xl font-bold text-slate-800">Equipamentos: {compStats?.razao}</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {compsEquips.map((e, idx) => (
             <div key={idx} 
                  onClick={() => setSelectedEquipment(e.codigo)}
                  className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer relative flex flex-col">
                <div className="flex justify-between items-start mb-4">
                   <div>
                     <h3 className="font-bold text-slate-800 text-lg leading-tight">{e.codigo}</h3>
                     <p className="text-xs text-slate-500 mt-1">{compStats?.razao}</p>
                   </div>
                   <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold ${e.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {e.ativo ? 'Ativo' : 'Inativo'}
                   </span>
                </div>
                
                <div className="space-y-2 mt-auto">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Tipo</span>
                    <span className="font-medium text-slate-700">{e.tipo_nome}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total O.S.</span>
                    <span className="font-medium text-slate-700">{e.totalOs}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Data Cadastro</span>
                    <span className="font-medium text-slate-700">{formatFullDateUTC(e.data_cadastro)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-2 border-t border-slate-100 mt-2">
                    <span className="text-slate-500 font-medium">Última Atividade</span>
                    <span className="text-slate-700 text-right">
                      {e.latest_data ? `${formatDateUTC(e.latest_data)} ${e.latest_hora}` : 'Sem registros'}
                    </span>
                  </div>
                </div>
             </div>
          ))}
          {compsEquips.length === 0 && <p className="text-slate-500 col-span-full">Nenhum equipamento vinculado a esta empresa.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-xl font-bold mb-6 text-slate-800">Painel de Gestão</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-lg mb-4 truncate" title={s.razao}>{s.razao}</h3>
              <div className="space-y-2">
                <p className="text-sm text-slate-600 flex justify-between">
                  <span>Equipamentos:</span> <span className="font-semibold text-slate-800">{s.numEquip}</span>
                </p>
                <div className="flex gap-2">
                  <p className="text-xs text-slate-500 bg-emerald-50 px-2 py-1 rounded w-full flex justify-between border border-emerald-100">
                    <span className="text-emerald-700">Ativos:</span> <span className="font-semibold text-emerald-800">{s.numAtivos}</span>
                  </p>
                  <p className="text-xs text-slate-500 bg-red-50 px-2 py-1 rounded w-full flex justify-between border border-red-100">
                    <span className="text-red-700">Inativos:</span> <span className="font-semibold text-red-800">{s.numInativos}</span>
                  </p>
                </div>
                <p className="text-sm text-slate-600 flex justify-between pt-2 border-t border-slate-100 mt-2">
                  <span>Total O.S.:</span> <span className="font-semibold text-slate-800">{s.numOs}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedCompany(s.cnpj)}
              className="mt-6 w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg text-sm transition-colors"
            >
              Ver Equipamentos
            </button>
          </div>
        ))}
        {stats.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            Nenhuma empresa encontrada com registros ativos.
          </div>
        )}
      </div>
    </div>
  );
}
