import React, { useState, useEffect } from 'react';
import { AuthUser } from './types';
import LoginScreen from './components/LoginScreen';
import ChangePasswordScreen from './components/ChangePasswordScreen';
import MainDashboard from './components/MainDashboard';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('smartos_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const handleLogin = (u: AuthUser) => {
    localStorage.setItem('smartos_user', JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('smartos_user');
    setUser(null);
  };

  const handlePasswordChanged = () => {
    if (user) {
      const u = { ...user, requireChangePassword: false };
      localStorage.setItem('smartos_user', JSON.stringify(u));
      setUser(u);
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (user.requireChangePassword) {
    return <ChangePasswordScreen user={user} onSuccess={handlePasswordChanged} onCancel={handleLogout} />;
  }

  return <MainDashboard user={user} onLogout={handleLogout} />;
}
