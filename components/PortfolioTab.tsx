import React, { useMemo, useState } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Inject Case IDs for export
      const dataToExport = filteredCases.map(s => ({ ...s, caseId: getCaseId(s) }));
      await generatePortfolioPDF(dataToExport, isDarkMode);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPPTX = async () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredCases.map(s => ({ ...s, caseId: getCaseId(s) }));
      await generatePortfolioPPTX(dataToExport);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar PPTX');
    } finally {
      setIsExporting(false);
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500 pb-24">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-white/20 dark:border-slate-800/50 shadow-2xl shadow-slate-200/20">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-3">
            <span className="w-2.5 h-8 bg-amber-500 rounded-full"></span>
            Meus Casos Notáveis
          </h2>
          <p className="text-slate-500 font-medium text-xs sm:text-sm">Visualize, filtre e exporte seus casos de destaque.</p>
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
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-sm"
            >
              <span className="material-icons text-base">picture_as_pdf</span>
              PDF
            </button>
            <button
              onClick={handleExportPPTX}
              disabled={isExporting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-sm"
            >
              <span className="material-icons text-base">co_present</span>
              PPTX
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                isActive
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Grid of Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {filteredCases.map(s => {
          const comp = s.complexity_level ? COMPLEXITY_CONFIG[s.complexity_level] : null;
          const caseId = getCaseId(s);
          
          return (
            <div key={s.id} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-white/40 dark:border-slate-800/60 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: CATEGORY_COLORS[s.categoria] || '#3b82f6' }}></div>
              
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1 block">
                    {s.data.split('-').reverse().join('/')}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                    <span className="text-amber-500 mr-2">{caseId}</span>
                    {s.subtipo || s.procedimento}
                  </h3>
                </div>
                {comp && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-${comp.color}-50 text-${comp.color}-600 dark:bg-${comp.color}-900/20 dark:text-${comp.color}-400`}>
                    {comp.emoji} <span className="hidden sm:inline">{comp.label}</span>
                  </div>
                )}
              </div>

              {s.niveis_operados && (
                <div className="mb-4 inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary dark:text-blue-300 font-bold text-xs">
                  Níveis: {s.niveis_operados}
                </div>
              )}

              {/* Tags */}
              {s.portfolio_tags && s.portfolio_tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {s.portfolio_tags.map(tag => (
                    <span key={tag} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {s.portfolio_notes && (
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 mb-6">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200/70 italic">"{s.portfolio_notes}"</p>
                </div>
              )}

              {/* Clinical Images Gallery Preview */}
              {s.clinical_images && s.clinical_images.length > 0 && (
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Imagens Clínicas</span>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {s.clinical_images.map((img, i) => (
                      <div key={i} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 relative group/img">
                        <img src={img} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" alt="Clinical" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          );
        })}
        {filteredCases.length === 0 && searchTerm && (
          <div className="col-span-full py-10 text-center text-slate-500 font-bold">Nenhum caso encontrado para "{searchTerm}".</div>
        )}
      </div>
    </div>
  );
};

export default PortfolioTab;
