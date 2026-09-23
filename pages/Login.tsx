
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (email: string, name?: string, rememberMe?: boolean) => void;
  isLoading: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, isLoading }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onLogin(email, isRegistering ? name : undefined, rememberMe);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-display text-slate-800 dark:text-slate-100 antialiased overflow-hidden">
      <div className="absolute inset-0 z-0 bg-neural-pattern opacity-30 pointer-events-none"></div>
      
      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>

      <div className="relative z-10 flex flex-col h-full safe-area-top safe-area-bottom px-6 py-12 items-center justify-center">
        <div className="w-full max-w-md space-y-10">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex items-center justify-center ring-1 ring-slate-100 dark:ring-slate-800">
              <span className="material-icons text-primary text-5xl">biotech</span>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Neuro<span className="text-primary">Gestor</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-[320px] mx-auto leading-tight">
                Gestão inteligente para membros da equipe <span className="text-primary font-bold">Camarinha</span>.
              </p>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 space-y-8">
            {!showEmailInput ? (
              <div className="space-y-6">
                <p className="text-center text-sm text-slate-400 font-semibold uppercase tracking-widest">
                  Acesso Restrito
                </p>
                <button 
                  onClick={() => setShowEmailInput(true)}
                  disabled={isLoading}
                  className="w-full group bg-slate-950 dark:bg-white dark:text-slate-950 text-white rounded-2xl py-4 flex items-center justify-center space-x-3 shadow-xl hover:shadow-primary/20 hover:scale-[1.02] transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  <span className="font-bold text-lg">
                    {isLoading ? 'Conectando...' : 'Entrar com Google'}
                  </span>
                </button>
                <div className="text-center">
                  <button 
                    onClick={() => { setShowEmailInput(true); setIsRegistering(true); }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Solicitar novo acesso
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {isRegistering ? 'Solicitar Acesso' : 'Identificação'}
                </p>
                {isRegistering && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Como quer ser chamado?</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu Nome"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 shadow-inner focus:ring-2 ring-primary/20 transition-all"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail do Google</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 shadow-inner focus:ring-2 ring-primary/20 transition-all"
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
                  <label htmlFor="remember" className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">Permanecer logado</label>
                </div>

                <div className="flex flex-col space-y-3">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isLoading ? 'Enviando...' : isRegistering ? 'Enviar Solicitação' : 'Acessar Painel'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowEmailInput(false); setIsRegistering(false); }}
                    className="w-full text-slate-500 text-sm font-bold py-2 hover:text-slate-800 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
          
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-slate-400">
              <span className="material-icons text-xs">verified_user</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Conexão Segura Equipe Camarinha</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
