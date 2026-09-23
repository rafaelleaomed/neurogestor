import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surgery, Category } from '../types';
import { COMPLEXITY_CONFIG } from '../constants';
import { generatePortfolioPDF, generatePortfolioPPTX } from '../services/export';

const CATEGORY_COLORS: Record<string, string> = {
  [Category.CRANIO]: '#ef4444', // red
  [Category.COLUNA]: '#3b82f6', // blue
  [Category.NERVO_PERIFERICO]: '#10b981' // green
};

interface PortfolioTabProps {
  mySurgeries: Surgery[];
  isDarkMode: boolean;
}

const PortfolioTab: React.FC<PortfolioTabProps> = ({ mySurgeries, isDarkMode }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Filter to only portfolio items
  const portfolioCases = useMemo(() => {
    return mySurgeries.filter(s => s.is_portfolio === true);
  }, [mySurgeries]);

  const filteredCases = useMemo(() => {
    return portfolioCases.filter(s => {
      const searchStr = `${s.subtipo || ''} ${s.procedimento || ''} ${(s.portfolio_tags || []).join(' ')} ${s.niveis_operados || ''}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [portfolioCases, searchTerm]);

  // Formatar ID do caso
  const getCaseId = (surgery: Surgery) => {
    const year = surgery.data.split('-')[0];
    const yearSurgeries = mySurgeries
      .filter(s => s.data.startsWith(year))
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    const index = yearSurgeries.findIndex(s => s.id === surgery.id) + 1;
    return `#${year}-${index.toString().padStart(3, '0')}`;
  };

  // Toggle de seleção de um caso individual
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selecionar todos os filtrados ou desmarcar todos
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredCases.length && filteredCases.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCases.map(s => s.id)));
    }
  };

  // Casos que entrarão na exportação (se nada selecionado, exporta todos os filtrados)
  const casesToExport = useMemo(() => {
    if (selectedIds.size > 0) {
      return filteredCases.filter(s => selectedIds.has(s.id));
    }
    return filteredCases;
  }, [filteredCases, selectedIds]);

  const handleExportPDF = async () => {
    if (casesToExport.length === 0) {
      alert('Nenhum caso disponível para exportação.');
      return;
    }
    setIsExporting(true);
    setExportProgress({ current: 0, total: casesToExport.length, message: 'Iniciando preparação com IA...' });
    try {
      const dataToExport = casesToExport.map(s => ({ ...s, caseId: getCaseId(s) }));
      await generatePortfolioPDF(dataToExport, isDarkMode, (curr, tot, msg) => {
        setExportProgress({ current: curr, total: tot, message: msg });
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportPPTX = async () => {
    if (casesToExport.length === 0) {
      alert('Nenhum caso disponível para exportação.');
      return;
    }
    setIsExporting(true);
    setExportProgress({ current: 0, total: casesToExport.length, message: 'Iniciando preparação com IA...' });
    try {
      const dataToExport = casesToExport.map(s => ({ ...s, caseId: getCaseId(s) }));
      await generatePortfolioPPTX(dataToExport, (curr, tot, msg) => {
        setExportProgress({ current: curr, total: tot, message: msg });
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar PPTX. Tente novamente.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  if (portfolioCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[3rem] border border-white/20 dark:border-slate-800/50 shadow-2xl shadow-slate-200/20 text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] flex items-center justify-center text-amber-500 mb-6">
          <span className="material-icons text-5xl">star_outline</span>
        </div>
        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-widest">Portfólio Vazio</h3>
        <p className="text-slate-500 font-medium">Você ainda não marcou nenhum caso como "Portfólio". Na hora de adicionar ou editar uma cirurgia, ative a opção "Adicionar ao Portfólio" para que ele apareça aqui.</p>
      </div>
    );
  }

  const isAllSelected = filteredCases.length > 0 && selectedIds.size === filteredCases.length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-10 duration-500 pb-24">
      {/* Modal de Progresso da IA e Exportação */}
      {isExporting && exportProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse">
              <span className="material-icons text-3xl">auto_awesome</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Gerando Portfólio Inteligente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {exportProgress.message}
              </p>
            </div>
            
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-amber-500 to-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, Math.round((exportProgress.current / exportProgress.total) * 100))}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
              <span>{exportProgress.current} de {exportProgress.total} casos</span>
              <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              A IA está sintetizando os resumos clínicos e compilando as imagens do caso.
            </p>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-white/20 dark:border-slate-800/50 shadow-2xl shadow-slate-200/20">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-3">
            <span className="w-2.5 h-8 bg-amber-500 rounded-full"></span>
            Meus Casos Notáveis
          </h2>
          <p className="text-slate-500 font-medium text-xs sm:text-sm">
            Clique no caso para editar. Selecione múltiplos casos para exportar com resumo por IA e imagens.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:min-w-[280px]">
            <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              placeholder="Buscar diagnóstico, procedimento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 ring-primary/20 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              title={`Exportar ${casesToExport.length} caso(s) em PDF`}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-sm"
            >
              <span className="material-icons text-base">picture_as_pdf</span>
              <span>PDF ({casesToExport.length})</span>
            </button>
            <button
              onClick={handleExportPPTX}
              disabled={isExporting}
              title={`Exportar ${casesToExport.length} caso(s) em PowerPoint`}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-sm"
            >
              <span className="material-icons text-base">co_present</span>
              <span>PPTX ({casesToExport.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips & Barra de Seleção Múltipla */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40 p-3 sm:px-5 sm:py-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          {[
            { label: 'Todos', query: '' },
            { label: 'Neuroestimulador', query: 'neuroestimulador' },
            { label: 'Déficit ao acordar', query: 'ao acordar' },
            { label: 'Déficit pré-operatório', query: 'pré-operatório' },
            { label: 'Alarme', query: 'alarme' },
          ].map(filter => {
            const isActive = filter.query === '' ? searchTerm === '' : searchTerm.toLowerCase().includes(filter.query);
            return (
              <button
                key={filter.label}
                onClick={() => setSearchTerm(isActive && filter.query !== '' ? '' : filter.query)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Controles de Seleção para Exportação */}
        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors"
          >
            <span className="material-icons text-base text-amber-500">
              {isAllSelected ? 'check_box' : selectedIds.size > 0 ? 'indeterminate_check_box' : 'check_box_outline_blank'}
            </span>
            <span>{isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}</span>
          </button>
          
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : `Todos (${filteredCases.length}) para exportar`}
          </span>
        </div>
      </div>

      {/* Grid of Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {filteredCases.map(s => {
          const comp = s.complexity_level ? COMPLEXITY_CONFIG[s.complexity_level] : null;
          const caseId = getCaseId(s);
          const isSelected = selectedIds.has(s.id);
          
          return (
            <div
              key={s.id}
              onClick={() => navigate(`/edit/${s.id}`)}
              className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-5 sm:p-7 rounded-2xl sm:rounded-[2.5rem] border transition-all group overflow-hidden relative cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.008] ${
                isSelected
                  ? 'border-amber-500 ring-2 ring-amber-500/20 dark:border-amber-500'
                  : 'border-white/40 dark:border-slate-800/60 hover:border-amber-400 dark:hover:border-amber-500/60'
              }`}
            >
              {/* Highlight bar superior */}
              <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: CATEGORY_COLORS[s.categoria] || '#3b82f6' }}></div>
              
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Checkbox de Seleção */}
                  <div
                    onClick={(e) => toggleSelect(s.id, e)}
                    className="p-1 -ml-1 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer flex-shrink-0"
                    title={isSelected ? 'Desmarcar caso' : 'Selecionar caso para exportação'}
                  >
                    <span className="material-icons text-2xl text-amber-500">
                      {isSelected ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1 block">
                      {s.data.split('-').reverse().join('/')}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight flex items-center flex-wrap gap-1.5">
                      <span className="text-amber-500">{caseId}</span>
                      <span>{s.subtipo || s.procedimento}</span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {comp && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-${comp.color}-50 text-${comp.color}-600 dark:bg-${comp.color}-900/20 dark:text-${comp.color}-400`}>
                      {comp.emoji} <span className="hidden sm:inline">{comp.label}</span>
                    </div>
                  )}
                  {/* Botão de Atalho para Edição */}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/edit/${s.id}`); }}
                    title="Editar Caso"
                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all"
                  >
                    <span className="material-icons text-xl">edit</span>
                  </button>
                </div>
              </div>

              {/* Informações cirúrgicas e níveis */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {s.niveis_operados && (
                  <div className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary dark:text-blue-300 font-bold text-xs">
                    Níveis: {s.niveis_operados}
                  </div>
                )}
                {s.medico && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                    <span className="material-icons text-xs">person</span>
                    {s.medico}
                  </div>
                )}
                {s.hospital && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                    <span className="material-icons text-xs">local_hospital</span>
                    {s.hospital}
                  </div>
                )}
              </div>

              {/* Tags */}
              {s.portfolio_tags && s.portfolio_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {s.portfolio_tags.map(tag => (
                    <span key={tag} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {s.portfolio_notes && (
                <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 mb-4">
                  <p className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200/70 italic">
                    "{s.portfolio_notes}"
                  </p>
                </div>
              )}

              {/* Clinical Images Gallery Preview */}
              {s.clinical_images && s.clinical_images.length > 0 && (
                <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Fotos e Imagens Clínicas ({s.clinical_images.length})
                    </span>
                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                      Incluídas no PDF/PPT
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {s.clinical_images.map((img, i) => (
                      <div key={i} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 relative group/img">
                        <img src={img} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" alt="Clinical" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rodapé do Card com indicação interativa */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 group-hover:text-amber-500 transition-colors">
                <span className="flex items-center gap-1">
                  <span className="material-icons text-xs">touch_app</span>
                  Clique no card para editar
                </span>
                <span className="material-icons text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
              </div>
            </div>
          );
        })}
        {filteredCases.length === 0 && searchTerm && (
          <div className="col-span-full py-10 text-center text-slate-500 font-bold">
            Nenhum caso encontrado para "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioTab;
