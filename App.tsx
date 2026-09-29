import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProcedureForm from './pages/ProcedureForm';
import AdminPanel from './pages/AdminPanel';
import OnboardingModal from './components/OnboardingModal';
import { getSession, setSession, getUsers, saveUser, initStorage, getSurgeries, updateSurgeriesBatch, updateUserFcmToken } from './services/storage';
import { User } from './types';
import { requestFirebaseNotificationPermission } from './services/notifications';
import { ADMIN_EMAIL, ADMIN_EMAILS, MASTER_ADMIN_EMAIL, isAdminUser, isMasterAdmin, DEMO_USER, isDemoUser } from './constants';
import { importData2025 } from './services/import2025';
import { getCategoryFromText, classifySurgeryProcedure } from './utils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(getSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se o visitante acessou via #/demo ou ?demo=true, inicializa imediatamente a sessão de demonstração
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isEnteringDemo = hash.includes('/demo') || search.includes('demo=true');
    if (isEnteringDemo && (!getSession() || !isDemoUser(getSession()))) {
      setSession(DEMO_USER);
      setUser(DEMO_USER);
    }

    // Inicializa modo escuro
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const currentSession = getSession();
    const isDemo = isDemoUser(currentSession) || isEnteringDemo;

    // SE ESTIVER EM MODO DEMONSTRAÇÃO: ISOLAMENTO TOTAL!
    // Não conecta ao Firestore, não altera usuários, não reprocessa dados reais.
    if (isDemo) {
      console.log('[NeuroGestor] 🛡️ Modo Demonstração: Isolamento ativo contra acesso a dados reais.');
      return;
    }

    // Inicializa Firestore listeners e migra dados do localStorage
    initStorage();

    // Auto-migração retroativa de usuários existentes (mantém 100% de integridade com o modelo anterior)
    const existingUsers = getUsers();
    existingUsers.forEach(u => {
      let changed = false;
      if (u.onboarding_completed === undefined) {
        u.onboarding_completed = true;
        changed = true;
      }
      if (!u.financial_config) {
        u.financial_config = { pricing_model: 'legacy_camarinha' };
        changed = true;
      }
      // Coloca os usuários pré-existentes na Equipe Camarinha
      if (!u.team_id) {
        u.team_id = 'camarinha';
        u.team_name = 'Equipe Camarinha';
        changed = true;
      }
      if (changed) {
        saveUser(u);
      }
    });

    const activeSession = getSession();
    if (activeSession && !activeSession.is_demo) {
      let sessionChanged = false;
      if (activeSession.onboarding_completed === undefined) {
        activeSession.onboarding_completed = true;
        sessionChanged = true;
      }
      if (!activeSession.financial_config) {
        activeSession.financial_config = { pricing_model: 'legacy_camarinha' };
        sessionChanged = true;
      }
      if (!activeSession.team_id) {
        activeSession.team_id = 'camarinha';
        activeSession.team_name = 'Equipe Camarinha';
        sessionChanged = true;
      }
      if (sessionChanged) {
        setSession(activeSession);
        setUser(activeSession);
      }
    }

    // Configuração inicial dos administradores: medleaobh (Master) e rafaelleaobh (Pessoal/Admin)
    const currentUsers = getUsers();
    
    // Master Admin medleaobh@gmail.com
    const medleaoUser = currentUsers.find(u => u.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase());
    if (!medleaoUser) {
      saveUser({
        email: MASTER_ADMIN_EMAIL.toLowerCase(),
        name: 'Administrador Master',
        status: 'APPROVED',
        role: 'owner',
        onboarding_completed: true,
        financial_config: { pricing_model: 'legacy_camarinha' },
        team_id: 'camarinha',
        team_name: 'Equipe Camarinha'
      });
    } else if (medleaoUser.status !== 'APPROVED' || medleaoUser.role !== 'owner' || medleaoUser.team_id !== 'camarinha') {
      medleaoUser.status = 'APPROVED';
      medleaoUser.role = 'owner';
      medleaoUser.onboarding_completed = true;
      medleaoUser.team_id = 'camarinha';
      medleaoUser.team_name = 'Equipe Camarinha';
      saveUser(medleaoUser);
    }

    // Admin rafaelleaobh@gmail.com
    const rafaelUser = currentUsers.find(u => u.email.toLowerCase() === 'rafaelleaobh@gmail.com');
    if (!rafaelUser) {
      saveUser({
        email: 'rafaelleaobh@gmail.com',
        name: 'Rafael Leão',
        status: 'APPROVED',
        role: 'owner',
        onboarding_completed: true,
        financial_config: { pricing_model: 'legacy_camarinha' },
        team_id: 'camarinha',
        team_name: 'Equipe Camarinha'
      });
    } else {
      let rafaelNeedsUpdate = false;
      if (rafaelUser.name === 'Administrador Camarinha') {
        rafaelUser.name = 'Rafael Leão';
        rafaelNeedsUpdate = true;
      }
      if (rafaelUser.status !== 'APPROVED' || rafaelUser.role !== 'owner') {
        rafaelUser.status = 'APPROVED';
        rafaelUser.role = 'owner';
        rafaelNeedsUpdate = true;
      }
      if (!rafaelUser.team_id) {
        rafaelUser.team_id = 'camarinha';
        rafaelUser.team_name = 'Equipe Camarinha';
        rafaelNeedsUpdate = true;
      }
      if (rafaelNeedsUpdate) {
        saveUser(rafaelUser);
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

      // Auto-aprova o admin master e garante papel de owner e equipe
      if (currentSession && isAdminUser(currentSession.email)) {
        if (currentSession.status !== 'APPROVED' || currentSession.role !== 'owner' || !currentSession.team_id) {
          const updated: User = {
            ...currentSession,
            status: 'APPROVED',
            role: 'owner',
            team_id: currentSession.team_id || 'camarinha',
            team_name: currentSession.team_name || 'Equipe Camarinha'
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
        const isOwnerAdmin = isAdminUser(email);
        foundUser = {
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          status: isOwnerAdmin ? 'APPROVED' : 'PENDING',
          role: isOwnerAdmin ? 'owner' : 'user',
          rememberMe: !!rememberMe,
          onboarding_completed: isOwnerAdmin ? true : false,
          financial_config: isOwnerAdmin ? { pricing_model: 'legacy_camarinha' } : undefined,
          team_id: isOwnerAdmin ? 'camarinha' : undefined,
          team_name: isOwnerAdmin ? 'Equipe Camarinha' : undefined
        };
        saveUser(foundUser);
      } else {
        const isOwnerAdmin = isAdminUser(email);

        let needsUpdate = false;
        if (isOwnerAdmin && foundUser.status !== 'APPROVED') {
          foundUser.status = 'APPROVED';
          needsUpdate = true;
        }

        if (isOwnerAdmin && foundUser.role !== 'owner') {
          foundUser.role = 'owner';
          needsUpdate = true;
        }

        if (isOwnerAdmin && !foundUser.team_id) {
          foundUser.team_id = 'camarinha';
          foundUser.team_name = 'Equipe Camarinha';
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
      if (!isDemoUser(foundUser)) {
        initStorage();
      }
    }, 1000);
  };

  const handleDemoLogin = () => {
    setLoading(true);
    setSession(DEMO_USER);
    setUser(DEMO_USER);
    setLoading(false);
  };

  const handleLogout = () => {
    setSession(null);
    setUser(null);
    if (window.location.hash.includes('/demo')) {
      window.location.hash = '#/login';
    }
  };

  const ProtectedRoute = ({ children, adminOnly = false }: { children?: React.ReactNode, adminOnly?: boolean }) => {
    if (!user) return <Navigate to="/login" replace />;

    if (adminOnly) {
      const isAuthorized = !user.is_demo && (user.role === 'admin' || user.role === 'owner' || isAdminUser(user.email));
      if (!isAuthorized) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    if (user.status === 'DENIED' && !isAdminUser(user.email)) {
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
      {user && user.status === 'APPROVED' && !user.onboarding_completed && !user.is_demo && (
        <OnboardingModal
          user={user}
          onSave={(updated) => {
            saveUser(updated);
            setSession(updated);
            setUser(updated);
          }}
        />
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} onDemoLogin={handleDemoLogin} isLoading={loading} />} />
        <Route
          path="/demo"
          element={(() => {
            if (!user) {
              setSession(DEMO_USER);
              setUser(DEMO_USER);
            }
            return <Navigate to="/dashboard" replace />;
          })()}
        />
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
