import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProcedureForm from './pages/ProcedureForm';
import AdminPanel from './pages/AdminPanel';
import OnboardingModal from './components/OnboardingModal';
import {
  cleanupStorageSession,
  getOrCreateUserProfile,
  getSurgeries,
  initStorage,
  saveUser,
  setSession,
  updateSurgeriesBatch,
  updateUserFcmToken
} from './services/storage';
import { getAuthErrorMessage, observeAuth, signInWithGoogle, signOutUser } from './services/auth';
import { User } from './types';
import { requestFirebaseNotificationPermission } from './services/notifications';
import { isAdminUser, isDemoUser, DEMO_USER } from './constants';
import { classifySurgeryProcedure } from './utils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const unsubscribe = observeAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        const isDemoEntry = window.location.hash.includes('/demo') || window.location.search.includes('demo=true');
        if (isDemoEntry) {
          setSession(DEMO_USER);
          setUser(DEMO_USER);
          setAuthReady(true);
          return;
        }
        cleanupStorageSession();
        setSession(null);
        setUser(null);
        setAuthReady(true);
        return;
      }

      setLoading(true);
      setAuthError(null);
      try {
        const profile = await getOrCreateUserProfile(firebaseUser);
        setSession(profile);
        setUser(profile);
        await initStorage();
      } catch (error) {
        console.error('[NeuroGestor] Falha ao preparar a sessão autenticada.');
        setAuthError('Não foi possível preparar seu acesso. Tente novamente.');
        cleanupStorageSession();
        setSession(null);
        setUser(null);
        try {
          await signOutUser();
        } catch {
          // A mensagem de erro não deve expor detalhes do provedor.
        }
      } finally {
        setAuthReady(true);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !user || isDemoUser(user)) return;

    const setupNotifications = async () => {
      if (user.status !== 'APPROVED') return;
      try {
        const token = await requestFirebaseNotificationPermission();
        if (token && token !== user.fcmToken) await updateUserFcmToken(user.email, token);
      } catch {
        console.warn('[NeuroGestor] Notificações não disponíveis neste dispositivo.');
      }
    };

    setupNotifications();
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || isDemoUser(user)) return;

    const timer = window.setTimeout(() => {
      const surgeries = getSurgeries();
      let hasChanges = false;
      const reprocessed = surgeries.map((surgery) => {
        const procedure = (surgery.procedimento || '').toLowerCase();
        const subtype = (surgery.subtipo || '').toLowerCase();
        const isCervical = subtype.includes('cervical') || procedure.includes('cervical');
        if (isCervical && surgery.estimated_screws && surgery.estimated_screws > 0) {
          hasChanges = true;
          return { ...surgery, estimated_screws: 0 };
        }
        if (!surgery.subtipo || !surgery.categoria) {
          const automatic = classifySurgeryProcedure(surgery.procedimento || '');
          hasChanges = true;
          return {
            ...surgery,
            categoria: automatic.categoria,
            subtipo: surgery.subtipo || automatic.subtipo,
            niveis_operados: surgery.niveis_operados || automatic.niveis_operados,
            estimated_screws: isCervical ? 0 : (surgery.estimated_screws ?? automatic.estimated_screws)
          };
        }
        return surgery;
      });
      if (hasChanges) {
        updateSurgeriesBatch(reprocessed).catch(() => {
          console.warn('[NeuroGestor] Não foi possível gravar a reclassificação automática.');
        });
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [authReady, user?.email]);

  const handleGoogleLogin = async (rememberMe: boolean) => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle(rememberMe);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setAuthError(null);
    setSession(DEMO_USER);
    setUser(DEMO_USER);
    setAuthReady(true);
  };

  const handleLogout = async () => {
    cleanupStorageSession();
    setSession(null);
    setUser(null);
    try {
      await signOutUser();
    } catch {
      setAuthError('Não foi possível encerrar a sessão. Tente novamente.');
    }
  };

  const ProtectedRoute = ({ children, adminOnly = false }: { children?: React.ReactNode; adminOnly?: boolean }) => {
    if (!authReady) return null;
    if (!user) return <Navigate to="/login" replace />;

    if (adminOnly) {
      const isAuthorized = !user.is_demo && (user.role === 'admin' || user.role === 'owner' || isAdminUser(user.email));
      if (!isAuthorized) return <Navigate to="/dashboard" replace />;
    }

    if (user.status === 'DENIED' && !isAdminUser(user.email)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-red-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso negado</h2>
            <p className="text-slate-600 mb-6">Seu acesso foi negado por um administrador.</p>
            <button onClick={handleLogout} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl">Sair</button>
          </div>
        </div>
      );
    }

    if (user.status === 'PENDING') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-display">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border-t-8 border-primary">
            <h2 className="text-2xl font-black text-slate-900 mb-4">Acesso pendente</h2>
            <p className="text-slate-500 mb-8 leading-relaxed font-medium">Olá <strong>{user.name}</strong>, sua solicitação foi enviada. Aguarde a aprovação.</p>
            <button onClick={handleLogout} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">Sair</button>
          </div>
        </div>
      );
    }

    return <>{children}</>;
  };

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Verificando autenticação...</div>;
  }

  return (
    <HashRouter>
      {user && user.status === 'APPROVED' && !user.onboarding_completed && !user.is_demo && (
        <OnboardingModal user={user} onSave={(updated) => { saveUser(updated); setSession(updated); setUser(updated); }} />
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onGoogleLogin={handleGoogleLogin} onDemoLogin={handleDemoLogin} errorMessage={authError} isLoading={loading} />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard onLogout={handleLogout} /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
        <Route path="/add" element={<ProtectedRoute><ProcedureForm /></ProtectedRoute>} />
        <Route path="/edit/:id" element={<ProtectedRoute><ProcedureForm /></ProtectedRoute>} />
        <Route path="/demo" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
