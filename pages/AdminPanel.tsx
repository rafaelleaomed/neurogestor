
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, updateUserStatus, deleteUser, getSession, updateUserRole, exportFullBackup, deduplicateSurgeries, importSurgeriesFromJSON, reprocessSurgeriesPrices, getEntityClusters, mergeEntities, autoNormalizeAllNames } from '../services/storage';
import { User } from '../types';
import { ADMIN_EMAIL } from '../constants';

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>(getUsers());
  const currentUser = getSession();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ active: boolean; pct: number; count: number; total: number }>({ active: false, pct: 0, count: 0, total: 0 });
  const [entityType, setEntityType] = useState<'medico' | 'hospital'>('medico');
  const [clusters, setClusters] = useState<Record<string, string[]>>({});
  const [isMerging, setIsMerging] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);

  useEffect(() => {
    const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'owner' || currentUser?.email === ADMIN_EMAIL;
    if (!isAuthorized) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const refreshUsers = () => {
    setUsers(getUsers());
  };

  const loadClusters = (type: 'medico' | 'hospital') => {
    setClusters(getEntityClusters(type));
  };

  useEffect(() => {
    loadClusters(entityType);
  }, [entityType]);

  const handleApprove = (email: string) => {
    updateUserStatus(email, 'APPROVED');
    refreshUsers();
  };

  const handleDeny = (email: string) => {
    updateUserStatus(email, 'DENIED');
    refreshUsers();
  };

  const handleDelete = (email: string) => {
    if (window.confirm(`Excluir permanentemente o registro de ${email}?`)) {
      deleteUser(email);
      refreshUsers();
    }
  };

  const handleRoleChange = (email: string, newRole: User['role']) => {
    updateUserRole(email, newRole);
    refreshUsers();
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    const success = await exportFullBackup();
    setIsExporting(false);
    if (success) {
      alert("Backup exportado com sucesso!");
    } else {
      alert("Erro ao exportar backup.");
    }
  };

  const handleDedup = async () => {
    if (!window.confirm('Isso irá analisar TODOS os registros e excluir automaticamente as cópias duplicadas.\n\nDeseja continuar?')) return;
    setIsDeduplicating(true);
    try {
      const removed = await deduplicateSurgeries();
      alert(removed > 0 ? `✅ ${removed} duplicata(s) removida(s) com sucesso!` : 'Nenhuma duplicata encontrada. Tudo certo!');
    } catch (err) {
      alert('Erro ao limpar duplicatas. Consulte o console para detalhes.');
      console.error(err);
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleReprocessPrices = async () => {
    if (!window.confirm('Isso irá analisar TODAS as cirurgias e aplicar as novas regras de preço (Crânio, Coluna, etc) com base nos nomes dos procedimentos.\n\nDeseja continuar?')) return;
    setIsReprocessing(true);
    try {
      const updatedCount = await reprocessSurgeriesPrices((pct, count, total) => {
        setImportProgress({ active: true, pct, count, total });
      });
      setImportProgress(p => ({ ...p, active: false }));
      alert(`✅ ${updatedCount} cirurgias tiveram seus preços atualizados com base nas novas regras!`);
    } catch (err) {
      setImportProgress(p => ({ ...p, active: false }));
      alert('Erro ao reprocessar preços. Consulte o console.');
      console.error(err);
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const surgeries = data.surgeries ?? data;

      if (!Array.isArray(surgeries) || surgeries.length === 0) {
        alert('Arquivo inválido ou vazio. Use o arquivo surgeries_final.json gerado pelo sistema.');
        return;
      }

      if (!window.confirm(`Importar ${surgeries.length} cirurgias para o Firestore?\n\nEsta operação não pode ser desfeita automaticamente.`)) return;

      setImportProgress({ active: true, pct: 0, count: 0, total: surgeries.length });

      const imported = await importSurgeriesFromJSON(surgeries, (pct, count, total) => {
        setImportProgress({ active: true, pct, count, total });
      });

      setImportProgress(p => ({ ...p, active: false }));
      alert(`✅ ${imported} cirurgias importadas com sucesso!`);
    } catch (err) {
      setImportProgress(p => ({ ...p, active: false }));
      alert('Erro ao importar. Verifique se o arquivo é um JSON válido.');
      console.error(err);
    }
  };

  const handleMerge = async (canonical: string, variants: string[]) => {
    const total = variants.length;
    if (!window.confirm(`Substituir ${total} variações pelo nome canônico "${canonical}"?\n\nIsso atualizará todas as cirurgias vinculadas.`)) return;

    setIsMerging(true);
    try {
      const updated = await mergeEntities(entityType, canonical, variants);
      alert(`✅ Sucesso! ${updated} cirurgias foram atualizadas para "${canonical}".`);
      loadClusters(entityType);
    } catch (err) {
      alert('Erro ao mesclar entidades.');
      console.error(err);
    } finally {
      setIsMerging(false);
    }
  };

  const handleAutoNormalize = async () => {
    if (!window.confirm(
      'Isso irá padronizar TODOS os nomes de médicos e hospitais em TODAS as cirurgias:\n\n' +
      '• Converter para MAIÚSCULAS\n' +
      '• Remover acentos\n' +
      '• Resolver aliases de hospitais\n\n' +
      'Deseja continuar?'
    )) return;

    setIsNormalizing(true);
    setImportProgress({ active: true, pct: 0, count: 0, total: 0 });
    try {
      const updated = await autoNormalizeAllNames((pct, count, total) => {
        setImportProgress({ active: true, pct, count, total });
      });
      setImportProgress(p => ({ ...p, active: false }));
      if (updated > 0) {
        alert(`✅ ${updated} cirurgias foram padronizadas com sucesso!\n\nRecarregue a página para ver os nomes atualizados.`);
        loadClusters(entityType);
      } else {
        alert('✅ Todos os nomes já estão padronizados! Nada a alterar.');
      }
    } catch (err) {
      setImportProgress(p => ({ ...p, active: false }));
      alert('Erro ao padronizar. Consulte o console.');
      console.error(err);
    } finally {
      setIsNormalizing(false);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'PENDING');
  const otherUsers = users.filter(u => u.status !== 'PENDING');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background-dark pb-12">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <span className="material-icons text-slate-500">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestão de Acessos</h1>
          </div>

          {/* Backup Button */}
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${isExporting
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400'
              }`}
          >
            <span className={`material-icons text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
              {isExporting ? 'sync' : 'cloud_download'}
            </span>
            <span className="hidden sm:inline uppercase text-[10px] tracking-widest">
              {isExporting ? 'Gerando...' : 'Backup (.JSON)'}
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 lg:p-6 space-y-8">
        {/* Pending Requests */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-500">
            <span className="material-icons">hourglass_top</span>
            <h2 className="text-lg font-bold">Solicitações Pendentes ({pendingUsers.length})</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            {pendingUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Nenhuma solicitação pendente.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {pendingUsers.map(user => (
                  <li key={user.email} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApprove(user.email)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 transition-colors"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleDeny(user.email)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors"
                      >
                        Negar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Managed Users */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
            <span className="material-icons">people</span>
            <h2 className="text-lg font-bold">Usuários Gerenciados</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            {otherUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Nenhum outro usuário cadastrado.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {otherUsers.map(user => (
                  <li key={user.email} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${user.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                          {user.status === 'APPROVED' && (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.email, e.target.value as User['role'])}
                              className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md px-2 py-1 border-none focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                            >
                              <option value="user">Usuário Padrão</option>
                              <option value="assistant">Secretária</option>
                              <option value="owner">Dono (Visão Empresa)</option>
                              <option value="admin">Administrador</option>
                            </select>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {user.status === 'DENIED' ? (
                        <button
                          onClick={() => handleApprove(user.email)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs hover:bg-slate-200 transition-colors"
                        >
                          Reativar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeny(user.email)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs hover:bg-slate-200 transition-colors"
                        >
                          Revogar Acesso
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.email)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-icons text-xl">delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-red-500">
            <span className="material-icons">warning</span>
            <h2 className="text-lg font-bold">Manutenção de Dados</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-bold text-slate-900 dark:text-white">Recalcular Preços das Cirurgias</p>
              <p className="text-sm text-slate-500 mt-1">Aplica as novas categorias e tabelas de preços (Crânio, Nervo Periférico, etc) em todos os registros existentes. Ideal após importar dados antigos.</p>
            </div>
            <button
              onClick={handleReprocessPrices}
              disabled={isReprocessing}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isReprocessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40'
                }`}
            >
              <span className={`material-icons text-[18px] ${isReprocessing ? 'animate-spin' : ''}`}>
                {isReprocessing ? 'sync' : 'calculate'}
              </span>
              {isReprocessing ? 'Processando...' : 'Atualizar Preços'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Limpar Registros Duplicados</p>
              <p className="text-sm text-slate-500 mt-1">Detecta e remove automaticamente cirurgias duplicadas (mesmo médico, paciente, data e procedimento). Use após atualizações do app.</p>
            </div>
            <button
              onClick={handleDedup}
              disabled={isDeduplicating}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isDeduplicating
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                }`}
            >
              <span className={`material-icons text-[18px] ${isDeduplicating ? 'animate-spin' : ''}`}>
                {isDeduplicating ? 'sync' : 'auto_fix_high'}
              </span>
              {isDeduplicating ? 'Analisando...' : 'Limpar Duplicatas'}
            </button>
          </div>
        </section>

        {/* Import JSON */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-blue-500">
            <span className="material-icons">upload_file</span>
            <h2 className="text-lg font-bold text-slate-700 dark:text-white">Importação de Dados</h2>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Importar Cirurgias via JSON</p>
              <p className="text-sm text-slate-500 mt-1">Selecione o arquivo <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">surgeries_final.json</code> para importar cirurgias em lote diretamente para o banco de dados.</p>
            </div>
            <label className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-all">
              <span className="material-icons text-[18px]">upload</span>
              Selecionar Arquivo
              <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
            </label>
          </div>
        </section>

        {/* Entity Merging Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-500">
              <span className="material-icons">hands_clapping</span>
              <h2 className="text-lg font-bold">Padronização de Nomes</h2>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setEntityType('medico')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${entityType === 'medico' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}
              >
                Médicos
              </button>
              <button
                onClick={() => setEntityType('hospital')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${entityType === 'hospital' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}
              >
                Hospitais
              </button>
            </div>
          </div>

          {/* Botão Auto-Padronizar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-bold text-slate-900 dark:text-white">Auto-Padronizar Todos</p>
              <p className="text-sm text-slate-500 mt-1">Normaliza <strong>todos</strong> os nomes de médicos e hospitais: MAIÚSCULAS, sem acentos, aliases resolvidos. Novos registros já seguirão este padrão automaticamente.</p>
            </div>
            <button
              onClick={handleAutoNormalize}
              disabled={isNormalizing}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isNormalizing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40'
              }`}
            >
              <span className={`material-icons text-[18px] ${isNormalizing ? 'animate-spin' : ''}`}>
                {isNormalizing ? 'sync' : 'auto_fix_high'}
              </span>
              {isNormalizing ? 'Padronizando...' : 'Padronizar Tudo'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {Object.keys(clusters).length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-100 dark:border-slate-700 text-center">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Tudo organizado! Nenhum nome similar encontrado.</p>
              </div>
            ) : (
              (Object.entries(clusters) as [string, string[]][]).map(([key, variants]) => (
                <div key={key} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Agrupamento Sugerido</p>
                      <h3 className="font-bold text-slate-900 dark:text-white uppercase">{key}</h3>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-1 rounded-lg text-[9px] font-black uppercase">{variants.length} variações</span>
                  </div>

                  <div className="space-y-2 mb-6">
                    {variants.map((name: string) => (
                      <div key={name} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{name}</span>
                        <button
                          onClick={() => handleMerge(name, variants.filter((v: string) => v !== name))}
                          disabled={isMerging}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          Usar como Principal
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="text-[9px] text-slate-400 font-bold italic leading-relaxed">
                    * Ao escolher um nome como principal, todas as outras variações deste grupo serão substuídas por ele em todos os registros do banco.
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Import progress modal */}
        {importProgress.active && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-10 max-w-sm w-full flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-icons text-blue-500 text-xl">cloud_upload</span>
                </div>
              </div>
              <div className="w-full space-y-3">
                <p className="font-black text-slate-900 dark:text-white text-center uppercase text-[10px] tracking-widest">
                  Importando... {importProgress.count}/{importProgress.total}
                </p>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 rounded-full"
                    style={{ width: `${importProgress.pct}%` }}
                  />
                </div>
                <p className="text-center text-xs font-bold text-blue-500">{importProgress.pct}%</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
