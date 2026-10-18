import React, { useState } from 'react';
import { TermsAndPrivacyModal, CfmComplianceModal, SupportModal } from '../components/LegalModals';

interface LoginProps {
  onGoogleLogin: (rememberMe: boolean) => void;
  onDemoLogin?: () => void;
  errorMessage?: string | null;
  isLoading: boolean;
}

const Login: React.FC<LoginProps> = ({ onGoogleLogin, onDemoLogin, errorMessage, isLoading }) => {
  const [rememberMe, setRememberMe] = useState(true);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isCfmOpen, setIsCfmOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-display text-slate-800 dark:text-slate-100 antialiased overflow-x-hidden justify-between">
      <div className="absolute inset-0 z-0 bg-neural-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 sm:px-6 py-10 safe-area-top">
        <div className="w-full max-w-lg space-y-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="w-28 h-28 sm:w-36 sm:h-36 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex items-center justify-center ring-2 ring-primary/20 dark:ring-slate-800 border border-white/60 p-4">
              <img src="/logo.png" alt="NeuroGestor" className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-md" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Neuro<span className="text-primary">Gestor</span></h1>
              <p className="text-xs sm:text-sm font-bold text-primary uppercase tracking-[0.2em]">Tecnologia e Inteligência para Neurofisiologia Cirúrgica</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm max-w-md mx-auto leading-relaxed pt-1">Acesso seguro ao seu painel de gestão cirúrgica.</p>
            </div>
          </div>

          <section className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-6 sm:p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acesso profissional protegido</p>
              </div>

              <button type="button" onClick={() => onGoogleLogin(rememberMe)} disabled={isLoading} className="w-full bg-slate-950 dark:bg-white dark:text-slate-950 text-white rounded-2xl py-4 flex items-center justify-center space-x-3 shadow-xl hover:shadow-primary/20 hover:scale-[1.01] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer">
                <span className="font-bold text-base sm:text-lg">{isLoading ? 'Autenticando...' : 'Entrar com Google'}</span>
              </button>

              {errorMessage && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs font-semibold text-red-700">{errorMessage}</div>}

              <div className="flex items-center space-x-2 px-1">
                <input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary dark:bg-slate-700 dark:border-slate-600" />
                <label htmlFor="remember" className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">Permanecer conectado neste dispositivo</label>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ou experimente agora</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              <button type="button" onClick={onDemoLogin} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-amber-500/10 hover:from-blue-600/20 hover:to-amber-500/20 text-slate-900 dark:text-white border-2 border-primary/30 hover:border-primary rounded-2xl py-3.5 px-4 flex items-center justify-center shadow-lg transition-all disabled:opacity-50 cursor-pointer">
                <span className="font-extrabold text-sm sm:text-base">Acessar modo demonstração</span>
              </button>
            </div>
          </section>

          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 text-[10px] font-bold uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50">
              <span className="material-icons text-xs text-emerald-500">lock</span>
              Autenticação Firebase • LGPD & CFM
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md safe-area-bottom">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center space-y-3">
          <div className="flex items-center justify-center space-x-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <button onClick={() => setIsTermsOpen(true)} className="hover:text-primary transition-colors cursor-pointer">Termos e Privacidade (LGPD)</button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button onClick={() => setIsCfmOpen(true)} className="hover:text-primary transition-colors cursor-pointer">Conformidade CFM</button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button onClick={() => setIsSupportOpen(true)} className="hover:text-primary transition-colors cursor-pointer">Suporte</button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">© 2026 NeuroGestor • Plataforma Médica de Gestão Cirúrgica</p>
        </div>
      </footer>

      <TermsAndPrivacyModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <CfmComplianceModal isOpen={isCfmOpen} onClose={() => setIsCfmOpen(false)} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
};

export default Login;
