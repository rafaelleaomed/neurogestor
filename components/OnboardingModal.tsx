import React, { useState } from 'react';
import { User, PricingModelType, UserFinancialConfig } from '../types';

interface OnboardingModalProps {
  user: User;
  onSave: (updatedUser: User) => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onSave }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Etapa 1: Perfil Profissional
  const [name, setName] = useState(user.name || '');
  const [roleTitle, setRoleTitle] = useState(user.role_title || 'Médico Neurofisiologista');
  const [crm, setCrm] = useState(user.crm || '');
  const [uf, setUf] = useState(user.uf || 'MG');

  // Etapa 2: Modelo Financeiro
  const [pricingModel, setPricingModel] = useState<PricingModelType>('convenio');
  const [defaultPrice, setDefaultPrice] = useState<string>('');
  const [particularPrice, setParticularPrice] = useState<string>('');
  const [convenios, setConvenios] = useState<Array<{ name: string; price: string }>>([
    { name: 'Unimed', price: '' },
    { name: 'Bradesco Saúde', price: '' },
    { name: 'SulAmérica', price: '' },
    { name: 'Outros Convênios', price: '' },
  ]);
  const [newConvenioName, setNewConvenioName] = useState('');

  // Por Categoria
  const [colunaPrice, setColunaPrice] = useState<string>('');
  const [cranioPrice, setCranioPrice] = useState<string>('');
  const [nervoPrice, setNervoPrice] = useState<string>('');

  const [confirmPerSurgery, setConfirmPerSurgery] = useState<boolean>(true);

  // Adicionar novo convênio na lista
  const handleAddConvenio = () => {
    if (newConvenioName.trim()) {
      setConvenios(prev => [...prev, { name: newConvenioName.trim(), price: '' }]);
      setNewConvenioName('');
    }
  };

  const handleRemoveConvenio = (index: number) => {
    setConvenios(prev => prev.filter((_, i) => i !== index));
  };

  const handleConvenioPriceChange = (index: number, val: string) => {
    setConvenios(prev => {
      const next = [...prev];
      next[index].price = val;
      return next;
    });
  };

  const handleFinish = () => {
    // Monta mapa de convênios preenchidos
    const conveniosMap: Record<string, number> = {};
    convenios.forEach(c => {
      const p = parseFloat(c.price.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (c.name && !isNaN(p) && p > 0) {
        conveniosMap[c.name] = p;
      }
    });

    const parsedDefault = parseFloat(defaultPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
    const parsedParticular = parseFloat(particularPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
    const parsedColuna = parseFloat(colunaPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
    const parsedCranio = parseFloat(cranioPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
    const parsedNervo = parseFloat(nervoPrice.replace(/[^\d.,]/g, '').replace(',', '.'));

    const financialConfig: UserFinancialConfig = {
      pricing_model: pricingModel,
      default_price: !isNaN(parsedDefault) && parsedDefault > 0 ? parsedDefault : undefined,
      particular_price: !isNaN(parsedParticular) && parsedParticular > 0 ? parsedParticular : undefined,
      convenios: Object.keys(conveniosMap).length > 0 ? conveniosMap : undefined,
      category_pricing: {
        Coluna: !isNaN(parsedColuna) && parsedColuna > 0 ? parsedColuna : undefined,
        Crânio: !isNaN(parsedCranio) && parsedCranio > 0 ? parsedCranio : undefined,
        'Nervo Periférico': !isNaN(parsedNervo) && parsedNervo > 0 ? parsedNervo : undefined,
      },
      confirm_per_surgery: confirmPerSurgery,
    };

    const updatedUser: User = {
      ...user,
      name: name.trim() || user.name,
      role_title: roleTitle,
      crm: crm.trim() || undefined,
      uf: crm.trim() ? uf : undefined,
      onboarding_completed: true,
      financial_config: financialConfig,
    };

    onSave(updatedUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header com Stepper */}
        <div className="pb-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-icons text-lg">medical_services</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Boas-vindas ao NeuroGestor
                </h2>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                  Configuração Inicial de Perfil & Honorários
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-primary px-3 py-1 rounded-full bg-primary/10">
              Passo {step} de 3
            </span>
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-6 flex-1 pr-1 space-y-6">
          {/* PASSO 1: Identificação Profissional */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  1. Dados do Profissional
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Como você quer ser identificado nos laudos e relatórios cirúrgicos.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Nome Completo / Nome de Exibição
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Dr(a). Rafael Leão"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3.5 text-sm font-semibold shadow-inner focus:ring-2 ring-primary/20 transition-all outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Função / Atuação
                </label>
                <select
                  value={roleTitle}
                  onChange={e => setRoleTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3.5 text-sm font-semibold shadow-inner focus:ring-2 ring-primary/20 transition-all outline-none text-slate-700 dark:text-slate-200"
                >
                  <option value="Médico Neurofisiologista">Médico Neurofisiologista</option>
                  <option value="Técnico de MNIO">Técnico de MNIO</option>
                  <option value="Residente / Fellow">Residente / Fellow</option>
                  <option value="Médico Cirurgião">Médico Cirurgião</option>
                  <option value="Outro Profissional da Saúde">Outro Profissional da Saúde</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      CRM
                    </label>
                    <span className="text-[10px] text-slate-400 italic">Opcional para técnicos</span>
                  </div>
                  <input
                    type="text"
                    value={crm}
                    onChange={e => setCrm(e.target.value)}
                    placeholder="Deixe em branco se não tiver"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3.5 text-sm font-semibold shadow-inner focus:ring-2 ring-primary/20 transition-all outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    UF
                  </label>
                  <select
                    value={uf}
                    onChange={e => setUf(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-3.5 text-sm font-semibold shadow-inner focus:ring-2 ring-primary/20 transition-all outline-none text-slate-700 dark:text-slate-200"
                  >
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2: Configuração Financeira */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  2. Como você cobra suas cirurgias?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Defina suas regras de honorários. Você poderá alterar e ajustar valores a qualquer momento.
                </p>
              </div>

              {/* Seletor de Modelo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPricingModel('convenio')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    pricingModel === 'convenio'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'
                  }`}
                >
                  <span className="material-icons text-lg mb-1 block">account_balance_wallet</span>
                  <p className="font-bold text-xs uppercase tracking-wider leading-tight">Por Convênio / Particular</p>
                  <p className="text-[10px] text-slate-400 mt-1">Valores por operadora</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingModel('fixed')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    pricingModel === 'fixed'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'
                  }`}
                >
                  <span className="material-icons text-lg mb-1 block">attach_money</span>
                  <p className="font-bold text-xs uppercase tracking-wider leading-tight">Valor Fixo Padrão</p>
                  <p className="text-[10px] text-slate-400 mt-1">Preço único por cirurgia</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingModel('category')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    pricingModel === 'category'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'
                  }`}
                >
                  <span className="material-icons text-lg mb-1 block">view_list</span>
                  <p className="font-bold text-xs uppercase tracking-wider leading-tight">Por Categoria</p>
                  <p className="text-[10px] text-slate-400 mt-1">Coluna, Crânio, Nervo</p>
                </button>
              </div>

              {/* Detalhes do Modelo Selecionado */}
              {pricingModel === 'convenio' && (
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Cirurgias Particulares (R$)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={particularPrice}
                      onChange={e => setParticularPrice(e.target.value)}
                      placeholder="Digite o valor particular (ex: 1500)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold shadow-sm focus:ring-2 ring-primary/20 outline-none"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                      Tabela de Convênios Principais (R$)
                    </span>

                    {convenios.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-36 truncate">
                          {c.name}
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={c.price}
                          onChange={e => handleConvenioPriceChange(i, e.target.value)}
                          placeholder="Valor em R$"
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold shadow-sm focus:ring-2 ring-primary/20 outline-none"
                        />
                        {i > 3 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveConvenio(i)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                          >
                            <span className="material-icons text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Adicionar convênio extra */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newConvenioName}
                        onChange={e => setNewConvenioName(e.target.value)}
                        placeholder="Nome do convênio (ex: CASSI)"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-medium shadow-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddConvenio}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-300 transition-colors"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {pricingModel === 'fixed' && (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Valor Fixo Padrão por Cirurgia (R$)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={defaultPrice}
                    onChange={e => setDefaultPrice(e.target.value)}
                    placeholder="Digite o valor padrão por caso (ex: 1000)"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold shadow-sm focus:ring-2 ring-primary/20 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 italic">
                    Esse valor será sugerido automaticamente para qualquer cirurgia cadastrada.
                  </p>
                </div>
              )}

              {pricingModel === 'category' && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                    Valores por Categoria Cirúrgica (R$)
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-500 w-32">Coluna:</span>
                      <input
                        type="number"
                        step="any"
                        value={colunaPrice}
                        onChange={e => setColunaPrice(e.target.value)}
                        placeholder="Valor para Coluna"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-500 w-32">Crânio:</span>
                      <input
                        type="number"
                        step="any"
                        value={cranioPrice}
                        onChange={e => setCranioPrice(e.target.value)}
                        placeholder="Valor para Crânio"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-500 w-32">Nervo Periférico:</span>
                      <input
                        type="number"
                        step="any"
                        value={nervoPrice}
                        onChange={e => setNervoPrice(e.target.value)}
                        placeholder="Valor para Nervo"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Checkbox de confirmação por cirurgia */}
              <div className="flex items-center gap-2.5 px-1 pt-1">
                <input
                  type="checkbox"
                  id="confirm_price"
                  checked={confirmPerSurgery}
                  onChange={e => setConfirmPerSurgery(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600"
                />
                <label htmlFor="confirm_price" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  Sempre exibir o valor para conferência ao cadastrar uma cirurgia
                </label>
              </div>
            </div>
          )}

          {/* PASSO 3: Resumo e Conclusão */}
          {step === 3 && (
            <div className="space-y-5 text-center animate-in fade-in slide-in-from-right-4 duration-300 py-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <span className="material-icons text-3xl">task_alt</span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Tudo Pronto, {name || 'Doutor(a)'}!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Seu perfil profissional e suas regras de honorários foram registrados com sucesso.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Profissional:</span>
                  <span className="font-black text-slate-800 dark:text-white">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Função:</span>
                  <span className="font-black text-slate-800 dark:text-white">{roleTitle}</span>
                </div>
                {crm && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">CRM:</span>
                    <span className="font-black text-slate-800 dark:text-white">{crm}/{uf}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Cobrança:</span>
                  <span className="font-black text-primary uppercase">
                    {pricingModel === 'convenio' ? 'Por Convênio / Particular' : pricingModel === 'fixed' ? 'Valor Fixo' : 'Por Categoria'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Você poderá alterar essas configurações a qualquer momento no menu de Configurações.
              </p>
            </div>
          )}
        </div>

        {/* Footer com Botões de Navegação */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(prev => (prev - 1) as any)}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              Voltar
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(prev => (prev + 1) as any)}
              className="px-6 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <span className="material-icons text-base">rocket_launch</span>
              <span>Acessar o Painel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
