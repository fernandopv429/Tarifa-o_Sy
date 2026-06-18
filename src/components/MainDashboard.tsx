import React, { useState } from 'react';
import { AuthUser } from '../types';
import LocadorDashboard from './LocadorDashboard';
import LocatarioDashboard from './LocatarioDashboard';
import { LogOut, User, Menu, X } from 'lucide-react';

export default function MainDashboard({ user, onLogout }: { user: AuthUser, onLogout: () => void }) {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <img src="/logo_logi.png" alt="VC Green Sustentabilidade & Inovação" className="h-10 object-contain max-w-[200px]" onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                }
              }} />
              <h1 className="text-xl font-bold text-slate-800 hidden">SmartOS</h1>
              <span className="ml-4 px-2 py-1 bg-slate-100 text-slate-800 text-xs font-medium rounded hidden sm:block">
                {user.role}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-1" />
                {user.nome || user.user}
              </div>
              <button onClick={onLogout} className="text-gray-500 hover:text-red-500 p-2">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {(user.role === 'LOCADOR_MASTER' || user.role === 'LOCADOR') ? (
           <LocadorDashboard user={user} />
        ) : (
           <LocatarioDashboard user={user} />
        )}
      </main>
    </div>
  );
}
