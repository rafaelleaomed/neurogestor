import React, { useState } from 'react';
import { TermsAndPrivacyModal, CfmComplianceModal, SupportModal } from '../components/LegalModals';

interface LoginProps {
  onLogin: (email: string, name?: string, rememberMe?: boolean) => void;
  onDemoLogin?: () => void;
  isLoading: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, onDemoLogin, isLoading }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Modais de conformidade e suporte
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isCfmOpen, setIsCfmOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onLogin(email, isRegistering ? name : undefined, rememberMe);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-display text-slate-800 dark:text-slate-100 antialiased overflow-x-hidden justify-between">
      <div className="absolute inset-0 z-0 bg-neural-pattern opacity-30 pointer-events-none"></div>

      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 sm:px-6 py-10 safe-area-top">
        <div className="w-full max-w-lg space-y-8">
          {/* Brand Header */}
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="w-28 h-28 sm:w-36 sm:h-36 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex items-center justify-center ring-2 ring-primary/20 dark:ring-slate-800 border border-white/60 p-4 transition-transform hover:scale-105 duration-300">
              <img src="/logo.png" alt="NeuroGestor" className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-md" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Neuro<span className="text-primary">Gestor</span>
              </h1>
              <p className="text-xs sm:text-sm font-bold text-primary uppercase tracking-[0.2em]">
                Tecnologia e Inteligência para Neurofisiologia Cirúrgica
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm max-w-md mx-auto leading-relaxed pt-1">
                Do leitor inteligente de etiquetas ao fechamento financeiro por convênio: automatize seus laudos com IA, elimine glosas e construa seu portfólio cirúrgico de alta performance.
              </p>
            </div>

            {/* Destaques / Badges de Recursos */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                ⚡ Leitor de Etiquetas com IA
              </span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                📊 Gestão por Convênio & Particular
              </span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                ⭐ Portfólio & Laudos MNIO
              </span>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-6 sm:p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 space-y-6">
            {!showEmailInput ? (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Acesso Profissional
                  </p>
                </div>

                <button 
                  onClick={() => setShowEmailInput(true)}
                  disabled={isLoading}
                  className="w-full group bg-slate-950 dark:bg-white dark:text-slate-950 text-white rounded-2xl py-4 flex items-center justify-center space-x-3 shadow-xl hover:shadow-primary/20 hover:scale-[1.01] transition-all duration-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  <span className="font-bold text-base sm:text-lg">
                    {isLoading ? 'Conectando...' : 'Entrar com Google'}
                  </span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ou experimente agora</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                </div>

                <button 
                  type="button"
                  onClick={onDemoLogin}
                  disabled={isLoading}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-amber-500/10 hover:from-blue-600/20 hover:to-amber-500/20 text-slate-900 dark:text-white border-2 border-primary/30 hover:border-primary rounded-2xl py-3.5 px-4 flex items-center justify-between shadow-lg transition-all duration-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center space-x-3 text-left">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center shadow-md shadow-primary/30 group-hover:scale-105 transition-transform flex-shrink-0">
                      <span className="material-icons text-2xl">auto_awesome</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          Acessar Modo Demonstração
                        </span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white tracking-wider">
                          Sem Cadastro
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Explore gráficos, leitor de etiquetas e portfólio cirúrgico
                      </p>
                    </div>
                  </div>
                  <span className="material-icons text-primary group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>

                <div className="text-center pt-1">
                  <button 
                    onClick={() => { setShowEmailInput(true); setIsRegistering(true); }}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    Novo usuário? Cadastre-se aqui
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {isRegistering ? 'Cadastro de Neurofisiologista' : 'Acesso com E-mail'}
                </p>
                {isRegistering && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Como quer ser chamado?</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr(a). Seu Nome ou Nome Profissional"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3.5 text-sm font-medium shadow-inner focus:ring-2 ring-primary/20 transition-all outline-none"
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail do Google</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3.5 text-sm font-medium shadow-inner focus:ring-2 ring-primary/20 transition-all outline-none"
                    required
                  />
                </div>
                
                <div className="flex items-center space-x-2 px-1">
                  <input 
                    type="checkbox" 
                    id="remember" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary dark:bg-slate-700 dark:border-slate-600" 
                  />
                  <label htmlFor="remember" className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">Permanecer conectado</label>
                </div>

                <div className="flex flex-col space-y-2 pt-1">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm uppercase tracking-wider"
                  >
                    {isLoading ? 'Conectando...' : isRegistering ? 'Continuar Cadastro' : 'Acessar Painel'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowEmailInput(false); setIsRegistering(false); }}
                    className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold py-2 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Voltar
                  </button>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button
                      type="button"
                      onClick={onDemoLogin}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <span className="material-icons text-sm">visibility</span>
                      Apenas conhecendo o app? Acessar demonstração
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
          
          {/* Security & Compliance Callout */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 text-[10px] font-bold uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50">
              <span className="material-icons text-xs text-emerald-500">lock</span>
              Ambiente Seguro • Criptografia Médica • LGPD & CFM
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Footer (Reference from bingo2gether) */}
      <footer className="relative z-10 py-6 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md safe-area-bottom">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center space-y-3">
          <div className="flex items-center justify-center space-x-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setIsTermsOpen(true)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Termos e Privacidade (LGPD)
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={() => setIsCfmOpen(true)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Conformidade CFM
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={() => setIsSupportOpen(true)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Suporte
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            © 2026 NeuroGestor • Plataforma Médica de Gestão Cirúrgica
          </p>
        </div>
      </footer>

      {/* Modais Legais e Suporte */}
      <TermsAndPrivacyModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <CfmComplianceModal isOpen={isCfmOpen} onClose={() => setIsCfmOpen(false)} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
};

export default Login;
