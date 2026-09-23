import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProcedureForm from './pages/ProcedureForm';
import AdminPanel from './pages/AdminPanel';
import { getSession, setSession, getUsers, saveUser, initStorage, getSurgeries, updateSurgeriesBatch, updateUserFcmToken } from './services/storage';
import { User } from './types';
import { requestFirebaseNotificationPermission } from './services/notifications';
import { ADMIN_EMAIL } from './constants';
import { importData2025 } from './services/import2025';
import { getCategoryFromText, classifySurgeryProcedure } from './utils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(getSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Inicializa modo escuro
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Inicializa Firestore listeners e migra dados do localStorage
    initStorage();

    // Initial setup if admin not exists
    const users = getUsers();
    const adminExists = users.some(u => u.email === ADMIN_EMAIL);
    if (!adminExists) {
      saveUser({
        email: ADMIN_EMAIL,
        name: 'Rafael Leão',
        status: 'APPROVED'
      });
    } else {
      // Forçar atualização do nome do admin se estiver com o nome antigo
      const adminUser = users.find(u => u.email === ADMIN_EMAIL);
      if (adminUser && (adminUser.name === 'Administrador Camarinha' || adminUser.role !== 'owner')) {
        adminUser.name = 'Rafael Leão';
        adminUser.role = 'owner';
        saveUser(adminUser);

        const session = getSession();
        if (session && session.email === ADMIN_EMAIL) {
          session.name = 'Rafael Leão';
          setSession(session);
          setUser(session);
        }
      }
    }

    // Importar dados de 2025 (apenas uma vez)
    const already2025 = localStorage.getItem('neuro_2025_imported');
    if (!already2025) {
      importData2025().then(count => {
        console.log(`[NeuroGestor] ✅ ${count} cirurgias de 2025 importadas com sucesso!`);
        localStorage.setItem('neuro_2025_imported', 'true');
      }).catch(err => {
        console.error('[NeuroGestor] Erro ao importar dados 2025:', err);
      });
    }

    // Reprocessar cirurgias existentes sem subtipo ou com categoria desatualizada (uma vez por sessão)
    setTimeout(() => {
      const allSurgeries = getSurgeries();
      let hasChanges = false;
      const reprocessed = allSurgeries.map(s => {
        const isCervical = (s.subtipo || '').toLowerCase().includes('cervical') || (s.procedimento || '').toLowerCase().includes('cervical');
        if (isCervical && s.estimated_screws && s.estimated_screws > 0) {
          hasChanges = true;
          return {
            ...s,
            estimated_screws: 0
          };
        }
        if (!s.subtipo || !s.categoria) {
          const auto = classifySurgeryProcedure(s.procedimento || '');
          hasChanges = true;
          return {
            ...s,
            categoria: auto.categoria,
            subtipo: s.subtipo || auto.subtipo,
            niveis_operados: s.niveis_operados || auto.niveis_operados,
            estimated_screws: isCervical ? 0 : (s.estimated_screws ?? auto.estimated_screws)
          };
        }
        return s;
      });
      if (hasChanges) {
        updateSurgeriesBatch(reprocessed);
        console.log('[NeuroGestor] 📦 Categorias, subtipos e parafusos sincronizados com sucesso!');
      }
    }, 2000);
  }, []);

  // Sync state with storage periodically or when session updates
  useEffect(() => {
    const checkSession = () => {
      const currentSession = getSession();

      // Se temos um usuário na memória mas getSession retornou null, 
      // pode ser um erro temporário de storage. Não deslogamos imediatamente.
      if (!currentSession && user) {
        console.warn('[NeuroGestor] Sessão sumiu do storage, mantendo em memória.');
        return;
      }

      // Auto-aprova o admin e garante papel de owner
      if (currentSession && currentSession.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        if (currentSession.status !== 'APPROVED' || currentSession.role !== 'owner') {
          const updated: User = {
            ...currentSession,
            status: 'APPROVED',
            role: 'owner'
          };
          saveUser(updated);
          setSession(updated);
          setUser(updated);
          return;
        }
      }

      if (JSON.stringify(currentSession) !== JSON.stringify(user)) {
        setUser(currentSession);
      }
    };

    const setupNotifications = async () => {
      if (user && user.status === 'APPROVED') {
        const token = await requestFirebaseNotificationPermission();
        if (token && token !== user.fcmToken) {
          await updateUserFcmToken(user.email, token);
        }
      }
    };

    setupNotifications();

    const interval = setInterval(checkSession, 2000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = (email: string, name?: string, rememberMe?: boolean) => {
    setLoading(true);
    setTimeout(() => {
      const users = getUsers();
      let foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!foundUser) {
        const isOwnerAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        foundUser = {
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          status: isOwnerAdmin ? 'APPROVED' : 'PENDING',
          role: 'user',
          rememberMe: !!rememberMe
        };
        saveUser(foundUser);
      } else {
        const isOwnerAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        let needsUpdate = false;
        if (isOwnerAdmin && foundUser.status !== 'APPROVED') {
          foundUser.status = 'APPROVED';
          needsUpdate = true;
        }

        if (foundUser.rememberMe !== !!rememberMe) {
          foundUser.rememberMe = !!rememberMe;
          needsUpdate = true;
        }

        if (needsUpdate) {
          saveUser(foundUser);
        }
      }

      setSession(foundUser);
      setUser(foundUser);
      setLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    setSession(null);
    setUser(null);
  };

  const ProtectedRoute = ({ children, adminOnly = false }: { children?: React.ReactNode, adminOnly?: boolean }) => {
    if (!user) return <Navigate to="/login" replace />;

    if (adminOnly) {
      const isAuthorized = user.role === 'admin' || user.role === 'owner' || user.email === ADMIN_EMAIL;
      if (!isAuthorized) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    if (user.status === 'DENIED' && user.email !== ADMIN_EMAIL) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-red-500">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons text-3xl">block</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Negado</h2>
            <p className="text-slate-600 mb-6">Desculpe, seu acesso foi negado por um administrador.</p>
            <button onClick={handleLogout} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition-colors">Sair</button>
          </div>
        </div>
      );
    }

    if (user.status === 'PENDING') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-display">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border-t-8 border-primary">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-icons text-4xl">hourglass_empty</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-4">Acesso Pendente</h2>
            <p className="text-slate-500 mb-8 leading-relaxed font-medium">Olá <strong>{user.name}</strong>, sua solicitação foi enviada. Aguarde a aprovação.</p>
            <button onClick={handleLogout} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95">Sair</button>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} isLoading={loading} />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard onLogout={handleLogout} /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminPanel /></ProtectedRoute>} />
        <Route path="/add" element={<ProtectedRoute><ProcedureForm /></ProtectedRoute>} />
        <Route path="/edit/:id" element={<ProtectedRoute><ProcedureForm /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
