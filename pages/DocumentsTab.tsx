import React, { useState, useEffect } from 'react';
import { PasswordEntry, ReportTemplate, ElectrodeModel, User } from '../types';
import {
    getPasswords, savePassword, deletePassword, subscribeToPasswords,
    getReportTemplates, saveReportTemplates, subscribeToReports,
    getElectrodeModels, saveElectrodeModels, subscribeToElectrodes
} from '../services/storage';
import { generateReportTemplateFromProcedure } from '../services/gemini';
import { isAdminUser } from '../constants';

export const DocumentsTab: React.FC<{ isDarkMode: boolean; currentUser?: User | null }> = ({ isDarkMode, currentUser }) => {
    const isCamarinhaMember = currentUser?.team_id === 'camarinha' || currentUser?.financial_config?.pricing_model === 'legacy_camarinha' || (currentUser?.email && isAdminUser(currentUser.email));
    const [activeSubTab, setActiveSubTab] = useState<'passwords' | 'reports' | 'electrodes'>(isCamarinhaMember ? 'passwords' : 'reports');

    // Passwords
    const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
    const [pwForm, setPwForm] = useState<Partial<PasswordEntry>>({});
    const [showPwForm, setShowPwForm] = useState(false);

    // Reports
    const [reports, setReports] = useState<ReportTemplate[]>([]);
    const [repForm, setRepForm] = useState<Partial<ReportTemplate>>({});
    const [showRepForm, setShowRepForm] = useState(false);
    const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);

    const handleGenerateAiReport = async () => {
        if (!repForm.name || !repForm.name.trim()) {
            alert('Por favor, informe primeiro o Nome da Cirurgia (ex: Artrodese Cervical) para a IA gerar a sugestão.');
            return;
        }
        setIsGeneratingAiReport(true);
        try {
            const generated = await generateReportTemplateFromProcedure(repForm.name.trim());
            setRepForm(prev => ({ ...prev, text: generated }));
        } catch (err) {
            console.error(err);
            alert('Erro ao gerar modelo com IA.');
        } finally {
            setIsGeneratingAiReport(false);
        }
    };

    // Electrodes
    const [electrodes, setElectrodes] = useState<ElectrodeModel[]>([]);
    const [elecForm, setElecForm] = useState<Partial<ElectrodeModel>>({});
    const [showElecForm, setShowElecForm] = useState(false);

    useEffect(() => {
        const unsubP = subscribeToPasswords(setPasswords);
        const unsubR = subscribeToReports(setReports);
        const unsubE = subscribeToElectrodes(setElectrodes);
        return () => { unsubP(); unsubR(); unsubE(); };
    }, []);

    const handleSavePassword = async () => {
        if (!pwForm.hospital?.trim()) {
            alert('O hospital é obrigatório para cadastrar uma senha.');
            return;
        }
        const newEntry: PasswordEntry = {
            id: pwForm.id || Math.random().toString(36).substr(2, 9),
            hospital: pwForm.hospital.trim(),
            system: pwForm.system?.trim() || '-',
            login: pwForm.login?.trim() || '-',
            pass: pwForm.pass?.trim() || '-'
        };
        await savePassword(newEntry); // O listener cuidará do setPasswords
        setPwForm({});
    };

    const handleSaveReport = () => {
        if (!repForm.name || !repForm.text) return;
        const newEntry: ReportTemplate = {
            id: repForm.id || Math.random().toString(36).substr(2, 9),
            name: repForm.name,
            text: repForm.text
        };
        const updated = repForm.id ? reports.map(r => r.id === repForm.id ? newEntry : r) : [...reports, newEntry];
        saveReportTemplates(updated);
        setRepForm({});
        setShowRepForm(false);
    };

    const handleSaveElectrode = () => {
        if (!elecForm.surgery || !elecForm.details) return;
        const newEntry: ElectrodeModel = {
            id: elecForm.id || Math.random().toString(36).substr(2, 9),
            surgery: elecForm.surgery,
            details: elecForm.details
        };
        const updated = elecForm.id ? electrodes.map(e => e.id === elecForm.id ? newEntry : e) : [...electrodes, newEntry];
        saveElectrodeModels(updated);
        setElecForm({});
        setShowElecForm(false);
    };

    const handleDeletePassword = async (id: string) => {
        if (!window.confirm('Excluir senha?')) return;
        await deletePassword(id);
    };

    const deleteReport = (id: string) => {
        if (!window.confirm('Excluir relatório?')) return;
        const updated = reports.filter(r => r.id !== id);
        saveReportTemplates(updated);
    };

    const deleteElectrode = (id: string) => {
        if (!window.confirm('Excluir modelo?')) return;
        const updated = electrodes.filter(e => e.id !== id);
        saveElectrodeModels(updated);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copiado para a área de transferência!');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Sub Tabs */}
            <div className="flex bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-1 w-full max-w-2xl mx-auto overflow-x-auto">
                {isCamarinhaMember && (
                    <button
                        onClick={() => setActiveSubTab('passwords')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'passwords' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-icons text-sm sm:text-base">vpn_key</span> Senhas (Camarinha)
                    </button>
                )}
                <button
                    onClick={() => setActiveSubTab('reports')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'reports' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <span className="material-icons text-sm sm:text-base">description</span> Relatórios
                </button>
                <button
                    onClick={() => setActiveSubTab('electrodes')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'electrodes' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <span className="material-icons text-sm sm:text-base">memory</span> Eletrodos
                </button>
            </div>

            {/* Passwords Content - Restrito a membros da Equipe Camarinha */}
            {isCamarinhaMember && activeSubTab === 'passwords' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Senhas de Hospitais</h3>
                            {pwForm.id && (
                                <button
                                    onClick={() => setPwForm({})}
                                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200"
                                >
                                    <span className="material-icons text-sm">close</span> Cancelar Edição
                                </button>
                            )}
                        </div>

                        {/* Password Form - Always visible but context-aware */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700">
                            <input type="text" placeholder="Hospital" value={pwForm.hospital || ''} onChange={e => setPwForm({ ...pwForm, hospital: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white" />
                            <input type="text" placeholder="Sistema" value={pwForm.system || ''} onChange={e => setPwForm({ ...pwForm, system: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white" />
                            <input type="text" placeholder="Login" value={pwForm.login || ''} onChange={e => setPwForm({ ...pwForm, login: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white" />
                            <input type="text" placeholder="Senha" value={pwForm.pass || ''} onChange={e => setPwForm({ ...pwForm, pass: e.target.value })} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white" />
                            <button onClick={handleSavePassword} className="bg-primary text-white rounded-xl py-3 px-4 font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                                <span className="material-icons text-sm">{pwForm.id ? 'update' : 'save'}</span> {pwForm.id ? 'Atualizar' : 'Salvar'}
                            </button>
                        </div>

                        <div className="mt-8 overflow-x-auto">
                            {passwords.length === 0 ? (
                                <p className="text-center text-slate-400 font-medium py-4">Nenhuma senha cadastrada.</p>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 border-dashed text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">
                                            <th className="pb-3 pr-4">Hospital</th>
                                            <th className="pb-3 pr-4">Sistema</th>
                                            <th className="pb-3 pr-4">Login</th>
                                            <th className="pb-3 pr-4">Senha</th>
                                            <th className="pb-3 w-20">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...passwords].sort((a, b) => a.hospital.localeCompare(b.hospital)).map(p => (
                                            <tr key={p.id} className={`border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${pwForm.id === p.id ? 'bg-primary/5 border-primary/20' : ''}`}>
                                                <td className="py-4 pr-4 text-sm font-bold text-slate-900 dark:text-white">{p.hospital}</td>
                                                <td className="py-4 pr-4 text-sm text-slate-600 dark:text-slate-400">{p.system}</td>
                                                <td className="py-4 pr-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    <button onClick={() => copyToClipboard(p.login)} className="flex items-center gap-2 hover:text-primary transition-colors">
                                                        {p.login} <span className="material-icons text-xs opacity-0 group-hover:opacity-100 transition-opacity">content_copy</span>
                                                    </button>
                                                </td>
                                                <td className="py-4 pr-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    <button onClick={() => copyToClipboard(p.pass)} className="flex items-center gap-2 hover:text-primary transition-colors">
                                                        {p.pass} <span className="material-icons text-xs opacity-0 group-hover:opacity-100 transition-opacity">content_copy</span>
                                                    </button>
                                                </td>
                                                <td className="py-4 flex items-center gap-2">
                                                    <button onClick={() => setPwForm(p)} className={`p-1.5 rounded-lg transition-colors ${pwForm.id === p.id ? 'text-primary bg-primary/20' : 'text-slate-400 hover:text-primary hover:bg-primary/10'}`}><span className="material-icons text-sm">edit</span></button>
                                                    <button onClick={() => handleDeletePassword(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><span className="material-icons text-sm">delete</span></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reports Content */}
            {activeSubTab === 'reports' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Modelos de Relatórios</h3>
                            <button
                                onClick={() => { setShowRepForm(!showRepForm); !showRepForm && setRepForm({}); }}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${showRepForm ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'}`}
                            >
                                <span className="material-icons text-sm">{showRepForm ? 'close' : 'add'}</span>
                                {showRepForm ? 'Cancelar' : 'Novo Modelo'}
                            </button>
                        </div>

                        {showRepForm && (
                            <div className="space-y-4 mb-10 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <input 
                                        type="text" 
                                        placeholder="Nome da Cirurgia (ex: Artrodese Cervical)" 
                                        value={repForm.name || ''} 
                                        onChange={e => setRepForm({ ...repForm, name: e.target.value })} 
                                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white font-bold" 
                                    />
                                    <button
                                        type="button"
                                        disabled={isGeneratingAiReport}
                                        onClick={handleGenerateAiReport}
                                        className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer shadow-sm active:scale-95"
                                    >
                                        <span className="material-icons text-sm">{isGeneratingAiReport ? 'hourglass_top' : 'auto_awesome'}</span>
                                        {isGeneratingAiReport ? 'Gerando com IA...' : 'Sugerir com IA'}
                                    </button>
                                </div>
                                <textarea placeholder="Texto do Relatório Operatório..." value={repForm.text || ''} onChange={e => setRepForm({ ...repForm, text: e.target.value })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white min-h-[150px] resize-y" />
                                <div className="flex justify-end">
                                    <button onClick={handleSaveReport} className="bg-primary text-white rounded-xl py-3 px-8 font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition flex items-center gap-2">
                                        <span className="material-icons text-sm">save</span> Salvar Modelo
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reports.length === 0 ? (
                                <p className="text-center text-slate-400 font-medium py-4 col-span-full">Nenhum modelo cadastrado.</p>
                            ) : (
                                reports.map(r => (
                                    <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col group hover:border-primary/50 transition-colors bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm line-clamp-2">{r.name}</h4>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setRepForm(r); setShowRepForm(true); }} className="p-1 text-slate-400 hover:text-primary bg-white dark:bg-slate-900 rounded shadow-sm"><span className="material-icons text-xs">edit</span></button>
                                                <button onClick={() => deleteReport(r.id)} className="p-1 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-900 rounded shadow-sm"><span className="material-icons text-xs">delete</span></button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-4 flex-grow">{r.text}</p>
                                        <button onClick={() => copyToClipboard(r.text)} className="mt-auto w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2">
                                            <span className="material-icons text-sm">content_copy</span> Copiar Relatório
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Electrodes Content */}
            {activeSubTab === 'electrodes' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Montagem de Eletrodos</h3>
                            <button
                                onClick={() => { setShowElecForm(!showElecForm); !showElecForm && setElecForm({}); }}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${showElecForm ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'}`}
                            >
                                <span className="material-icons text-sm">{showElecForm ? 'close' : 'add'}</span>
                                {showElecForm ? 'Cancelar' : 'Novo Modelo'}
                            </button>
                        </div>

                        {showElecForm && (
                            <div className="space-y-4 mb-10 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                                <input type="text" placeholder="Nome da Cirurgia (ex: DBS Parkinson)" value={elecForm.surgery || ''} onChange={e => setElecForm({ ...elecForm, surgery: e.target.value })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white font-bold" />
                                <textarea placeholder="Detalhes da Montagem do Eletrodo..." value={elecForm.details || ''} onChange={e => setElecForm({ ...elecForm, details: e.target.value })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white min-h-[100px] resize-y" />
                                <div className="flex justify-end">
                                    <button onClick={handleSaveElectrode} className="bg-primary text-white rounded-xl py-3 px-8 font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition flex items-center gap-2">
                                        <span className="material-icons text-sm">save</span> Salvar Modelo
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {electrodes.length === 0 ? (
                                <p className="text-center text-slate-400 font-medium py-4 col-span-full">Nenhum modelo cadastrado.</p>
                            ) : (
                                electrodes.map(e => (
                                    <div key={e.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col group hover:border-primary/50 transition-colors bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm line-clamp-2">{e.surgery}</h4>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setElecForm(e); setShowElecForm(true); }} className="p-1 text-slate-400 hover:text-primary bg-white dark:bg-slate-900 rounded shadow-sm"><span className="material-icons text-xs">edit</span></button>
                                                <button onClick={() => deleteElectrode(e.id)} className="p-1 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-900 rounded shadow-sm"><span className="material-icons text-xs">delete</span></button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap mb-4 flex-grow">{e.details}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
