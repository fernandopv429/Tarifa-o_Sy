import React, { useState } from 'react';
import { AuthUser } from '../types';
import ViewLocatarios from './views/ViewLocatarios';
import ViewEquipamentos from './views/ViewEquipamentos';
import ViewTipoEquipamento from './views/ViewTipoEquipamento';
import ViewUsuarios from './views/ViewUsuarios';
import ViewLogs from './views/ViewLogs';
import ViewTelemetria from './views/ViewTelemetria';
import ViewDashboardIndex from './views/ViewDashboardIndex';
import ViewRelatorios from './views/ViewRelatorios';

export default function LocadorDashboard({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState('DASHBOARD');

  const tabs = [
    { id: 'DASHBOARD', label: 'Dashboard' },
    { id: 'LOCATARIOS', label: 'Locatários' },
    { id: 'EQUIPAMENTOS', label: 'Equipamentos' },
    { id: 'TIPO_EQUIP', label: 'Tipos de Equip.' },
    { id: 'USUARIOS', label: 'Usuários' },
    { id: 'TELEMETRIA', label: 'Lista OS' },
    { id: 'RELATORIOS', label: 'Relatórios' },
    { id: 'LOGS', label: 'Logs Sistema' }
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 overflow-x-auto no-scrollbar">
        <nav className="-mb-px flex space-x-6 min-w-max px-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${tab === t.id ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        {tab === 'DASHBOARD' && <ViewDashboardIndex user={user} />}
        {tab === 'LOCATARIOS' && <ViewLocatarios user={user} />}
        {tab === 'EQUIPAMENTOS' && <ViewEquipamentos user={user} />}
        {tab === 'TIPO_EQUIP' && <ViewTipoEquipamento user={user} />}
        {tab === 'USUARIOS' && <ViewUsuarios user={user} />}
        {tab === 'TELEMETRIA' && <ViewTelemetria user={user} />}
        {tab === 'RELATORIOS' && <ViewRelatorios user={user} />}
        {tab === 'LOGS' && <ViewLogs user={user} />}
      </div>
    </div>
  );
}
