import React, { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsAndPrivacyModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-icons text-2xl">policy</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Termos de Uso e Privacidade (LGPD)
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Segurança e Proteção de Dados Médicos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="overflow-y-auto py-5 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pr-2">
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
            <span className="material-icons text-xl flex-shrink-0 text-emerald-600">verified_user</span>
            <div>
              <p className="font-bold text-xs uppercase tracking-wider mb-0.5">Conformidade com a Lei 13.709/2018 (LGPD)</p>
              <p className="text-xs leading-normal">
                O NeuroGestor adota medidas técnicas, administrativas e de segurança aptas a proteger os dados pessoais e sensíveis da saúde contra acessos não autorizados.
              </p>
            </div>
          </div>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            1. Finalidade do Tratamento de Dados
          </h3>
          <p>
            A plataforma processa dados cirúrgicos, prontuários, registros de monitorização neurofisiológica intraoperatória (MNIO) e dados de faturamento unicamente para a gestão profissional, elaboração de laudos, portfólio clínico e controle de honorários do próprio neurofisiologista cadastrado.
          </p>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            2. Anonimização e Modo Privacidade LGPD
          </h3>
          <p>
            A plataforma conta nativamente com o recurso <strong>Modo Privacidade LGPD</strong> no painel de controle, permitindo ocultar nomes de pacientes e valores em apresentações públicas, telas abertas ou conferências, salvaguardando a intimidade e a confidencialidade do paciente.
          </p>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            3. Segurança e Criptografia
          </h3>
          <p>
            Todas as comunicações e transmissões de dados são criptografadas via protocolo HTTPS/TLS em repouso e em trânsito com infraestrutura de nuvem segura do Google Cloud/Firebase. O acesso é restrito aos membros autorizados com autenticação segura.
          </p>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            4. Direitos do Titular
          </h3>
          <p>
            Em cumprimento ao art. 18 da LGPD, os usuários podem a qualquer momento solicitar a visualização, correção, portabilidade em formato aberto (JSON/Excel) ou exclusão definitiva de seus dados e registros pelo e-mail oficial de suporte: <span className="font-bold text-primary">medleaobh@gmail.com</span>.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export const CfmComplianceModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <span className="material-icons text-2xl">health_and_safety</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Conformidade com Normas do CFM
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Ética Médica e Tecnologias de Suporte à Decisão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="overflow-y-auto py-5 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pr-2">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <span className="material-icons text-xl flex-shrink-0 text-amber-600">gavel</span>
            <div>
              <p className="font-bold text-xs uppercase tracking-wider mb-0.5">Resolução CFM nº 2.314/2022 & Código de Ética Médica</p>
              <p className="text-xs leading-normal">
                O NeuroGestor atua estritamente como ferramenta tecnológica de apoio, organização e produtividade, em total respeito à autonomia do médico assistente.
              </p>
            </div>
          </div>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            1. Autonomia Profissional e Não Substituição do Médico
          </h3>
          <p>
            As ferramentas de Inteligência Artificial disponibilizadas (leitura e OCR de etiquetas cirúrgicas, sugestão de categorização, laudos preliminares e resumos clínicos) têm finalidade exclusivamente instrumental e de suporte à decisão. Elas <strong>não substituem em hipótese alguma</strong> o julgamento clínico, o diagnóstico, a interpretação de potenciais evocados ou as condutas do médico neurofisiologista.
          </p>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            2. Revisão Humana Obrigatória
          </h3>
          <p>
            Todo laudo, resumo ou dado extraído automaticamente deve ser revisado, validado e ratificado pelo médico responsável antes de sua emissão, impressão ou compartilhamento com a equipe cirúrgica e hospitalar.
          </p>

          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mt-4">
            3. Sigilo e Guarda de Documentos Médicos
          </h3>
          <p>
            Em conformidade com a Resolução CFM nº 1.821/2007, a plataforma disponibiliza mecanismos seguros para armazenamento e exportação de dados clínicos e imagens de exames para fins de prontuário, auditoria e portfólio profissional.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export const SupportModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const supportEmail = 'medleaobh@gmail.com';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <span className="material-icons text-2xl">support_agent</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Suporte & Contato
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Canal Oficial de Atendimento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <p className="leading-relaxed">
            Precisa de ajuda com o seu cadastro, dúvidas de faturamento, sugestões ou suporte técnico no <strong>NeuroGestor</strong>?
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              E-mail de Suporte
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white select-all">
                {supportEmail}
              </span>
              <button
                onClick={handleCopy}
                title="Copiar e-mail"
                className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <span className="material-icons text-sm">{copied ? 'check' : 'content_copy'}</span>
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Tempo médio de resposta: até 24 horas em dias úteis.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <a
            href={`mailto:${supportEmail}?subject=Suporte%20NeuroGestor%20-%20Dúvida%20ou%20Solicitação`}
            className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider text-center hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
          >
            <span className="material-icons text-sm">mail</span>
            <span>Enviar E-mail</span>
          </a>
          <button
            onClick={onClose}
            className="py-3 px-5 text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
