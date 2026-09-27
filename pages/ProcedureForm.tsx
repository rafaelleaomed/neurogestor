import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getSurgeries, saveSurgery, getDoctors, addDoctor, getHospitals, addHospital, uploadImage, getSession } from '../services/storage';
import { performOCR, generateMnioReport } from '../services/gemini';
import { Category, Status, Surgery, ComplexityLevel } from '../types';
import { calculatePrice, formatCurrency, getCategoryFromText, learnCategory, compressImage, normalizeName, normalizeDoctorName, normalizeHospitalName, estimateScrews, classifySurgeryProcedure, normalizeCategory } from '../utils';
import { SUBTYPES, COMPLEXITY_CONFIG, PORTFOLIO_TAG_SUGGESTIONS, TECNICAS_MNIO, CONDUTAS_ALARME, CODIGOS_TUSS_SUGESTOES, CID10_SUGESTOES } from '../constants';

const ProcedureForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);
  const simpleFileInputRef = useRef<HTMLInputElement>(null);
  const simpleFileInputGalleryRef = useRef<HTMLInputElement>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);
  const reportInputGalleryRef = useRef<HTMLInputElement>(null);

  const currentUser = getSession();
  const configuredConvenios = Object.keys(currentUser?.financial_config?.convenios || {});
  const availableConvenios = Array.from(new Set([...configuredConvenios, 'Particular', 'Unimed', 'Bradesco Saúde', 'SulAmérica', 'Amil', 'Cassi', 'Allianz', 'Porto Seguro']));

  const locationState = location.state as { filterYearSurgeries?: string, filterMonthSurgeries?: string } | null;
  const filterYearSurgeries = locationState?.filterYearSurgeries;
  const filterMonthSurgeries = locationState?.filterMonthSurgeries;

  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    paciente: '',
    procedimento: '',
    categoria: Category.COLUNA,
    subtipo: '',
    medico: '',
    hospital: '',
    convenio: '',
    codigo_tuss: '',
    cid_10: '',
    numero_guia: '',
    observacoes: '',
    status: Status.REALIZADO,
    report_text: '',
    label_images: [] as string[],
    report_images: [] as string[],
    valor_personalizado: undefined as number | undefined,
    // Neurogestor 2.0
    is_portfolio: false,
    complexity_level: '' as ComplexityLevel | '',
    portfolio_tags: [] as string[],
    portfolio_notes: '',
    niveis_operados: '',
    // Laudo MNIO
    tecnicas_mnio: [] as string[],
    houve_alarme: false,
    condutas_alarme: [] as string[],
    clinical_images: [] as string[],
  });

  const [useCustomPrice, setUseCustomPrice] = useState(false);

  const [doctors, setDoctors] = useState(getDoctors());
  const [hospitals, setHospitals] = useState(getHospitals());

  useEffect(() => {
    if (id) {
      const surgery = getSurgeries().find(s => s.id === id);
      if (surgery) {
        const hasCustom = surgery.valor_personalizado != null && surgery.valor_personalizado > 0;
        setUseCustomPrice(hasCustom);
        setFormData({
          ...surgery,
          categoria: normalizeCategory(surgery.categoria),
          label_images: surgery.label_images || [],
          report_images: surgery.report_images || [],
          convenio: surgery.convenio || '',
          codigo_tuss: surgery.codigo_tuss || '',
          cid_10: surgery.cid_10 || '',
          numero_guia: surgery.numero_guia || '',
          observacoes: surgery.observacoes || surgery.report_text || '',
          valor_personalizado: surgery.valor_personalizado,
          subtipo: surgery.subtipo || '',
          is_portfolio: surgery.is_portfolio || false,
          complexity_level: surgery.complexity_level || '',
          portfolio_tags: surgery.portfolio_tags || [],
          portfolio_notes: surgery.portfolio_notes || '',
          niveis_operados: surgery.niveis_operados || '',
          tecnicas_mnio: surgery.tecnicas_mnio || [],
          houve_alarme: surgery.houve_alarme || false,
          condutas_alarme: surgery.condutas_alarme || [],
          clinical_images: surgery.clinical_images || [],
        } as any);
      }
    }
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'procedimento' && value) {
        const auto = classifySurgeryProcedure(value);
        updated.categoria = auto.categoria;
        if (auto.subtipo) updated.subtipo = auto.subtipo;
        if (auto.niveis_operados && (!prev.niveis_operados || prev.niveis_operados === '')) {
          updated.niveis_operados = auto.niveis_operados;
        }
      }
      return updated;
    });
  };

  const toggleArrayItem = (field: 'tecnicas_mnio' | 'condutas_alarme', value: string) => {
    setFormData(prev => {
      const current = prev[field] || [];
      const updated = current.includes(value) 
        ? current.filter(item => item !== value) 
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = e.target;
    const files = Array.from(inputElement.files || []) as File[];
    if (files.length === 0) return;

    setOcrLoading(true);
    let totalSuccess = 0;
    let totalPartial = 0;

    try {
      for (const file of files) {
        let b64 = '';
        try {
          b64 = await compressImage(file, 1600, 0.85);
        } catch (compErr) {
          console.error("[NeuroGestor] Erro ao comprimir imagem:", compErr);
          alert("Erro ao processar o arquivo da imagem.");
          continue;
        }

        try {
          const result = await performOCR(b64);
          const hasIdentifiedFields = !!(result?.paciente || result?.procedimento || result?.medico || result?.hospital || result?.data);
          const auto = result?.procedimento ? classifySurgeryProcedure(result.procedimento) : null;

          setFormData(p => ({
            ...p,
            paciente: result?.paciente ? result.paciente : p.paciente,
            procedimento: result?.procedimento ? result.procedimento : p.procedimento,
            medico: result?.medico ? result.medico.toUpperCase() : p.medico,
            hospital: result?.hospital ? result.hospital.toUpperCase() : p.hospital,
            convenio: result?.convenio ? result.convenio : p.convenio,
            data: result?.data ? result.data : p.data,
            categoria: auto ? auto.categoria : (result?.procedimento ? getCategoryFromText(result.procedimento) : p.categoria),
            subtipo: auto?.subtipo ? auto.subtipo : p.subtipo,
            niveis_operados: auto?.niveis_operados ? auto.niveis_operados : p.niveis_operados,
            label_images: [...p.label_images, b64]
          }));

          if (result?.paciente && result?.procedimento) {
            totalSuccess++;
          } else if (hasIdentifiedFields) {
            totalPartial++;
          }
        } catch (err: any) {
          console.error("[NeuroGestor] Erro no OCR:", err);
          // Garante que a foto capturada seja sempre anexada, sem perda de dados
          setFormData(p => ({
            ...p,
            label_images: [...p.label_images, b64]
          }));

          const msg = (err?.message || '').toLowerCase();
          if (msg.includes('429') || msg.includes('quota') || msg.includes('limite')) {
            alert("A IA está ocupada neste instante. A imagem foi anexada como etiqueta.");
          } else if (msg.includes('25s') || msg.includes('tempo limite')) {
            alert("A leitura da IA demorou além do esperado. A imagem foi anexada para conferência.");
          } else {
            alert("Não foi possível ler todos os dados da etiqueta automaticamente, mas a imagem foi anexada com sucesso. Você pode preencher os campos restantes.");
          }
        }
      }

      if (totalSuccess > 0) {
        alert("✅ Dados da etiqueta preenchidos com sucesso!");
      } else if (totalPartial > 0) {
        alert("⚠️ Etiqueta anexada! Alguns campos foram preenchidos pela IA. Por favor, confira os dados.");
      }
    } finally {
      setOcrLoading(false);
      if (inputElement) inputElement.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
    }
  };

  const handleSimpleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = e.target;
    const files = Array.from(inputElement.files || []) as File[];
    if (files.length === 0) return;
    try {
      for (const file of files) {
        try {
          const b64 = await compressImage(file, 1600, 0.85);
          setFormData(p => ({
            ...p,
            label_images: [...p.label_images, b64]
          }));
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      if (inputElement) inputElement.value = '';
      if (simpleFileInputRef.current) simpleFileInputRef.current.value = '';
      if (simpleFileInputGalleryRef.current) simpleFileInputGalleryRef.current.value = '';
    }
  };

  const handleReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = e.target;
    const files = Array.from(inputElement.files || []) as File[];
    if (files.length === 0) return;
    setReportLoading(true);
    try {
      for (const file of files) {
        try {
          const b64 = await compressImage(file, 1600, 0.85);
          setFormData(p => ({
            ...p,
            report_images: [...(p.report_images || []), b64]
          }));
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      setReportLoading(false);
      if (inputElement) inputElement.value = '';
      if (reportInputRef.current) reportInputRef.current.value = '';
      if (reportInputGalleryRef.current) reportInputGalleryRef.current.value = '';
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const surgeryId = id || crypto.randomUUID();

      // Upload imagens para Firebase Storage (substitui base64 por URLs)
      const uploadedLabels: string[] = [];
      for (let i = 0; i < formData.label_images.length; i++) {
        const img = formData.label_images[i];
        const url = await uploadImage(img, `surgeries/${surgeryId}/labels`, `label_${i}_${Date.now()}.jpg`);
        uploadedLabels.push(url);
      }

      const uploadedReports: string[] = [];
      for (let i = 0; i < (formData.report_images || []).length; i++) {
        const img = formData.report_images[i];
        const url = await uploadImage(img, `surgeries/${surgeryId}/reports`, `report_${i}_${Date.now()}.jpg`);
        uploadedReports.push(url);
      }

      const uploadedClinical: string[] = [];
      for (let i = 0; i < (formData.clinical_images || []).length; i++) {
        const img = formData.clinical_images[i];
        const url = await uploadImage(img, `surgeries/${surgeryId}/clinical`, `clinical_${i}_${Date.now()}.jpg`);
        uploadedClinical.push(url);
      }

      // Normaliza nomes antes de salvar (MAIÚSCULAS, sem acentos, sem Dr., aliases canônicos)
      const normalizedMedico = normalizeDoctorName(formData.medico);
      const normalizedHospital = normalizeHospitalName(formData.hospital);

      // Calcula valor: usa personalizado se ativado, senão calcula de acordo com o modelo financeiro do usuário
      const finalPrice = useCustomPrice && formData.valor_personalizado
        ? formData.valor_personalizado
        : calculatePrice(formData.procedimento, formData.categoria, currentUser, formData.convenio);

      // Monta o objeto base da cirurgia
      const surgeryBase: Record<string, any> = {
        id: surgeryId,
        ...formData,
        medico: normalizedMedico,
        hospital: normalizedHospital,
        convenio: formData.convenio ? formData.convenio.trim() : undefined,
        label_images: uploadedLabels,
        report_images: uploadedReports,
        clinical_images: uploadedClinical,
        valor_estimado: finalPrice,
        created_at: id ? getSurgeries().find(s => s.id === id)?.created_at || Date.now() : Date.now()
      };

      if (!surgeryBase.convenio) {
        delete surgeryBase.convenio;
      }
      if (!surgeryBase.codigo_tuss) delete surgeryBase.codigo_tuss;
      if (!surgeryBase.cid_10) delete surgeryBase.cid_10;
      if (!surgeryBase.numero_guia) delete surgeryBase.numero_guia;

      // Só inclui valor_personalizado se realmente tiver um valor (Firestore não aceita undefined)
      if (useCustomPrice && formData.valor_personalizado) {
        surgeryBase.valor_personalizado = formData.valor_personalizado;
      } else {
        delete surgeryBase.valor_personalizado;
      }

      // Limpa campos opcionais vazios de portfólio e subtipo
      if (!surgeryBase.subtipo) delete surgeryBase.subtipo;
      if (!surgeryBase.complexity_level) delete surgeryBase.complexity_level;
      if (!surgeryBase.portfolio_notes) delete surgeryBase.portfolio_notes;
      if (!surgeryBase.portfolio_tags || surgeryBase.portfolio_tags.length === 0) delete surgeryBase.portfolio_tags;
      if (!surgeryBase.is_portfolio) delete surgeryBase.is_portfolio;
      
      const isSpineOrTrauma = surgeryBase.subtipo && (
        surgeryBase.subtipo.toLowerCase().includes('artrodese') ||
        surgeryBase.subtipo.toLowerCase().includes('escoliose') ||
        surgeryBase.subtipo.toLowerCase().includes('fratura') ||
        surgeryBase.subtipo.toLowerCase().includes('trauma')
      );
      const isCervical = surgeryBase.subtipo?.toLowerCase().includes('cervical') || surgeryBase.procedimento?.toLowerCase().includes('cervical');

      if (!isSpineOrTrauma || !surgeryBase.niveis_operados) {
        delete surgeryBase.niveis_operados;
        delete surgeryBase.estimated_screws;
      } else if (isCervical) {
        // Artrodeses cervicais não possuem estimulação de parafusos
        surgeryBase.estimated_screws = 0;
      } else if (surgeryBase.niveis_operados) {
        // Calcular parafusos automaticamente: 2 por nível vertebral (exclui cervicais)
        const screws = estimateScrews(surgeryBase.niveis_operados, surgeryBase.subtipo);
        if (screws > 0) surgeryBase.estimated_screws = screws;
        else surgeryBase.estimated_screws = 0;
      }

      // Remove qualquer campo undefined restante (Firestore rejeita undefined)
      Object.keys(surgeryBase).forEach(key => {
        if (surgeryBase[key] === undefined) {
          delete surgeryBase[key];
        }
      });

      const surgery = surgeryBase as Surgery;

      await saveSurgery(surgery);
      if (normalizedMedico) addDoctor(normalizedMedico);
      if (normalizedHospital) addHospital(normalizedHospital);

      // Auto-aprender a categoria selecionada pelo usuário para este procedimento
      if (formData.procedimento && formData.categoria) {
        learnCategory(formData.procedimento, formData.categoria);
      }

      // Feedback visual e navegação para a aba de registros
      setTimeout(() => {
        setLoading(false);
        navigate('/dashboard', { state: { activeTab: 'surgeries', filterYearSurgeries, filterMonthSurgeries } });
      }, 500);
    } catch (err) {
      console.error('[NeuroGestor] Erro ao salvar cirurgia:', err);
      setLoading(false);
      alert("Ocorreu um erro ao salvar a cirurgia. Verifique sua conexão e tente novamente.");
    }
  };

  const requiresLevels = formData.subtipo && (
    formData.subtipo.toLowerCase().includes('artrodese') ||
    formData.subtipo.toLowerCase().includes('escoliose') ||
    formData.subtipo.toLowerCase().includes('fratura') ||
    formData.subtipo.toLowerCase().includes('trauma')
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 p-4 lg:p-10 flex justify-center items-start font-display">
      <div className="max-w-4xl w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 duration-500">

        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard', { state: { activeTab: 'surgeries', filterYearSurgeries, filterMonthSurgeries } })}
              className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-slate-500 hover:text-primary transition-colors border border-slate-100 dark:border-slate-700"
            >
              <span className="material-icons">arrow_back</span>
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{id ? 'Editar' : 'Nova'} Cirurgia</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Gestão Equipe Camarinha</p>
            </div>
          </div>
        </div>

        {/* Smart Scan Section - HIGH PROMINENCE */}
        <div className="px-8 pt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center justify-between p-6 bg-emerald-500 text-white rounded-[2rem] shadow-2xl shadow-emerald-500/20 group relative overflow-hidden">
            <div className="flex flex-col items-center justify-center mb-4 mt-2">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <span className="material-icons text-2xl">{ocrLoading ? 'sync' : 'auto_awesome'}</span>
              </div>
              <span className="text-base font-black uppercase tracking-tight text-center whitespace-pre-line">{ocrLoading ? 'Sincronizando...' : 'Scan IA de\nEtiqueta'}</span>
              <span className="text-[8px] font-bold opacity-80 uppercase mt-2 tracking-widest text-center">Preenchimento Automático</span>
            </div>
            <div className="flex gap-2 w-full mt-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-colors"
                disabled={ocrLoading}
              >
                <span className="material-icons text-xl mb-1">photo_camera</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Câmera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputGalleryRef.current?.click()}
                className="flex-1 py-3 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-colors"
                disabled={ocrLoading}
              >
                <span className="material-icons text-xl mb-1">collections</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Galeria</span>
              </button>
            </div>
            {ocrLoading && <div className="absolute inset-0 bg-emerald-500/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div></div>}
          </div>

          <div className="flex flex-col items-center justify-between p-6 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
            <div className="flex flex-col items-center justify-center mb-4 mt-2">
              <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                <span className="material-icons text-2xl text-slate-400">attach_file</span>
              </div>
              <span className="text-base font-black uppercase tracking-tight text-center whitespace-pre-line text-slate-700 dark:text-slate-200">Adicionar<br />Etiqueta</span>
              <span className="text-[8px] font-bold opacity-70 uppercase mt-2 tracking-widest text-center">Apenas Foto (Sem IA)</span>
            </div>
            <div className="flex gap-2 w-full mt-auto">
              <button
                type="button"
                onClick={() => simpleFileInputRef.current?.click()}
                className="flex-1 py-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl flex flex-col items-center justify-center transition-colors shadow-sm"
              >
                <span className="material-icons text-xl mb-1">photo_camera</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Câmera</span>
              </button>
              <button
                type="button"
                onClick={() => simpleFileInputGalleryRef.current?.click()}
                className="flex-1 py-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl flex flex-col items-center justify-center transition-colors shadow-sm"
              >
                <span className="material-icons text-xl mb-1">collections</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Galeria</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between p-6 bg-primary text-white rounded-[2rem] shadow-2xl shadow-primary/20 relative overflow-hidden sm:col-span-2 md:col-span-1">
            <div className="flex flex-col items-center justify-center mb-4 mt-2">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <span className="material-icons text-2xl">article</span>
              </div>
              <span className="text-base font-black uppercase tracking-tight text-center whitespace-pre-line">Anexar<br />Relatório</span>
              <span className="text-[8px] font-bold opacity-80 uppercase mt-2 tracking-widest text-center">Apenas Foto (Sem IA)</span>
            </div>
            <div className="flex gap-2 w-full mt-auto">
              <button
                type="button"
                onClick={() => reportInputRef.current?.click()}
                className="flex-1 py-3 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-colors"
                disabled={reportLoading}
              >
                <span className="material-icons text-xl mb-1">photo_camera</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Câmera</span>
              </button>
              <button
                type="button"
                onClick={() => reportInputGalleryRef.current?.click()}
                className="flex-1 py-3 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-colors"
                disabled={reportLoading}
              >
                <span className="material-icons text-xl mb-1">collections</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Galeria</span>
              </button>
            </div>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" multiple className="hidden" />
          <input type="file" ref={fileInputGalleryRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

          <input type="file" ref={simpleFileInputRef} onChange={handleSimpleUpload} accept="image/*" capture="environment" multiple className="hidden" />
          <input type="file" ref={simpleFileInputGalleryRef} onChange={handleSimpleUpload} accept="image/*" multiple className="hidden" />

          <input type="file" ref={reportInputRef} onChange={handleReportUpload} accept="image/*" capture="environment" multiple className="hidden" />
          <input type="file" ref={reportInputGalleryRef} onChange={handleReportUpload} accept="image/*" multiple className="hidden" />
        </div>

        {/* Preview of Labels */}
        {formData.label_images.length > 0 && (
          <div className="px-8 mt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Etiquetas Scaneadas</h3>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {formData.label_images.map((img, i) => (
                <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                  <img src={img} className="w-full h-full object-cover" alt="Label" />
                  <button onClick={() => setFormData(p => ({ ...p, label_images: p.label_images.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"><span className="material-icons text-[12px]">close</span></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview of Reports */}
        {(formData.report_images?.length ?? 0) > 0 && (
          <div className="px-8 mt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Relatórios Anexados</h3>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {formData.report_images!.map((img, i) => (
                <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                  <img src={img} className="w-full h-full object-cover" alt="Report" />
                  <button onClick={() => setFormData(p => ({ ...p, report_images: p.report_images!.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"><span className="material-icons text-[12px]">close</span></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Data da Cirurgia</label>
              <input type="date" name="data" value={formData.data} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all" required />
            </div>
            <div className="space-y-2 flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Hora Início</label>
                <input type="time" name="hora_inicio" value={formData.hora_inicio || ''} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Hora Fim</label>
                <input type="time" name="hora_fim" value={formData.hora_fim || ''} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Categoria Automática</label>
              <select name="categoria" value={normalizeCategory(formData.categoria)} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all">
                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Subtipo</label>
              <select name="subtipo" value={formData.subtipo} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all">
                <option value="">— Selecione —</option>
                {(SUBTYPES[normalizeCategory(formData.categoria)] || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            {requiresLevels && (
              <div className="md:col-span-2 space-y-2 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Níveis Operados <span className="text-primary normal-case font-bold tracking-normal">(Para estimativa de parafusos)</span>
                  </label>
                  {formData.subtipo?.toLowerCase().includes('cervical') ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold">
                      <span className="material-icons text-sm">info</span>
                      Sem estimulação de parafusos (Cervical)
                    </div>
                  ) : formData.niveis_operados && estimateScrews(formData.niveis_operados, formData.subtipo) > 0 ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black">
                      <span className="material-icons text-sm">hardware</span>
                      ~{estimateScrews(formData.niveis_operados, formData.subtipo)} parafusos estimados
                    </div>
                  ) : null}
                </div>
                <input 
                  type="text" 
                  name="niveis_operados" 
                  value={formData.niveis_operados || ''} 
                  onChange={handleInputChange} 
                  placeholder="Ex: L4-S1, T2-T10, C3-C7, T11-L4..." 
                  className="w-full bg-primary/5 dark:bg-primary/10 border-none rounded-2xl p-5 font-bold uppercase text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/30 transition-all" 
                />
              </div>
            )}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nome do Paciente</label>
              <input type="text" name="paciente" value={formData.paciente} onChange={handleInputChange} placeholder="NOME DO PACIENTE" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-black uppercase text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all" required />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Procedimento Realizado</label>
              <input type="text" name="procedimento" value={formData.procedimento} onChange={handleInputChange} placeholder="EX: ARTRODESE C3-C5, MICROVASCULAR..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all" required />
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Convênio / Fonte Pagadora</label>
                {formData.convenio && currentUser?.financial_config?.convenios?.[formData.convenio] && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="material-icons text-sm">verified</span>
                    Tabela configurada: {formatCurrency(currentUser.financial_config.convenios[formData.convenio])}
                  </span>
                )}
              </div>
              <input
                list="convenios-list"
                name="convenio"
                value={formData.convenio || ''}
                onChange={handleInputChange}
                placeholder="Ex: Particular, Unimed, Bradesco Saúde, Amil..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all"
              />
              <datalist id="convenios-list">
                {availableConvenios.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Médico Responsável (Sem Dr.)</label>
              <input
                list="doctors-list"
                name="medico"
                value={formData.medico}
                onChange={handleInputChange}
                onBlur={(e) => {
                  if (e.target.value) {
                    setFormData(prev => ({ ...prev, medico: normalizeDoctorName(e.target.value) }));
                  }
                }}
                placeholder="NOME DO CIRURGIÃO"
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold uppercase text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all"
                required
              />
              <datalist id="doctors-list">
                {doctors.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Unidade Hospitalar</label>
              <input
                list="hospitals-list"
                name="hospital"
                value={formData.hospital}
                onChange={handleInputChange}
                onBlur={(e) => {
                  if (e.target.value) {
                    setFormData(prev => ({ ...prev, hospital: normalizeHospitalName(e.target.value) }));
                  }
                }}
                placeholder="HOSPITAL"
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold uppercase text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all"
                required
              />
              <datalist id="hospitals-list">
                {hospitals.map(h => <option key={h} value={h} />)}
              </datalist>
            </div>

            {/* ─── Faturamento & Padrão TISS (ANS) ─── */}
            <div className="md:col-span-2 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-primary dark:text-blue-400 flex items-center justify-center">
                  <span className="material-icons text-xl">receipt_long</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Faturamento & Padrão TISS (ANS)</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Códigos TUSS e CID-10 para faturamento de convênios e auditoria</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Código TUSS */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Código TUSS (ANS)</label>
                  <input
                    type="text"
                    list="tuss-list"
                    name="codigo_tuss"
                    value={formData.codigo_tuss || ''}
                    onChange={handleInputChange}
                    placeholder="Ex: 4.01.03.54-5"
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all uppercase"
                  />
                  <datalist id="tuss-list">
                    {CODIGOS_TUSS_SUGESTOES.map(t => (
                      <option key={t.codigo} value={t.codigo}>{t.descricao}</option>
                    ))}
                  </datalist>
                </div>

                {/* CID-10 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">CID-10 Diagnóstico</label>
                  <input
                    type="text"
                    list="cid10-list"
                    name="cid_10"
                    value={formData.cid_10 || ''}
                    onChange={handleInputChange}
                    placeholder="Ex: M48.0, M43.1..."
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all uppercase"
                  />
                  <datalist id="cid10-list">
                    {CID10_SUGESTOES.map(c => (
                      <option key={c.codigo} value={c.codigo}>{c.descricao}</option>
                    ))}
                  </datalist>
                </div>

                {/* Número da Guia TISS */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nº Guia de Autorização (TISS)</label>
                  <input
                    type="text"
                    name="numero_guia"
                    value={formData.numero_guia || ''}
                    onChange={handleInputChange}
                    placeholder="Nº da Guia (Opcional)"
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white shadow-inner focus:ring-2 ring-primary/20 transition-all uppercase"
                  />
                </div>
              </div>
            </div>

            {/* ─── Neurogestor 2.0 - Laudo MNIO ─── */}
            <div className="md:col-span-2 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-icons">medical_information</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-sm">Laudo Estruturado MNIO</h3>
                  <p className="text-xs font-bold text-slate-400">Preencha para estruturar seu relatório pós-cirúrgico</p>
                </div>
              </div>
              
              <div className="space-y-6 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem]">
                
                {/* Técnicas */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Técnicas Utilizadas</label>
                  <div className="flex flex-wrap gap-2">
                    {TECNICAS_MNIO.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleArrayItem('tecnicas_mnio', t)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          (formData.tecnicas_mnio || []).includes(t)
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alarme Toggle */}
                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Houve Alarme Intraoperatório?</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Queda significativa de amplitude, aumento de latência, etc.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, houve_alarme: !p.houve_alarme }))}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      formData.houve_alarme ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      formData.houve_alarme ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Condutas (só se alarme) */}
                {formData.houve_alarme && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      Condutas Realizadas
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CONDUTAS_ALARME.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleArrayItem('condutas_alarme', c)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            (formData.condutas_alarme || []).includes(c)
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* File Upload Exames */}
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Imagens Clínicas / Exames (Opcional)</label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => document.getElementById('clinical-upload')?.click()} className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                      <span className="material-icons text-3xl text-slate-400 group-hover:text-primary transition-colors mb-2">add_photo_alternate</span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Adicionar Exame (RM, TC, RX)</span>
                    </button>
                    <input id="clinical-upload" type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      try {
                        for (const file of files) {
                          const b64 = await compressImage(file, 1600, 0.85);
                          setFormData(p => ({ ...p, clinical_images: [...(p.clinical_images || []), b64] }));
                        }
                      } catch (err) { console.error(err); }
                      e.target.value = '';
                    }} />
                  </div>
                  {(formData.clinical_images?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-3 overflow-x-auto py-2 scrollbar-hide">
                      {formData.clinical_images?.map((img, i) => (
                        <div key={i} className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                          <img src={img} className="w-full h-full object-cover" alt="Exame" />
                          <button type="button" onClick={() => setFormData(p => ({ ...p, clinical_images: p.clinical_images?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center"><span className="material-icons text-[14px]">close</span></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Observações / Relatório Final</label>
                <button
                  type="button"
                  disabled={reportLoading}
                  onClick={async () => {
                    setReportLoading(true);
                    try {
                      const generated = await generateMnioReport(formData, formData.observacoes);
                      setFormData(p => ({ ...p, observacoes: generated }));
                    } catch (err) {
                      console.error(err);
                      alert("Erro ao gerar laudo com IA.");
                    } finally {
                      setReportLoading(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors disabled:opacity-50"
                >
                  <span className="material-icons text-[14px]">auto_awesome</span>
                  {reportLoading ? "Gerando..." : "Gerar com IA"}
                </button>
              </div>
              <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows={6} placeholder="O relatório gerado pela IA aparecerá aqui. Você pode editá-lo livremente..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[2.5rem] p-6 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-inner focus:ring-2 ring-primary/20 transition-all leading-relaxed resize-none" />
            </div>

            {/* ─── Neurogestor 2.0 — Portfólio ─── */}
            <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-6 mt-2">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="material-icons text-base text-amber-500">star</span> Portfólio & Complexidade
                </h3>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, is_portfolio: !p.is_portfolio }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    formData.is_portfolio
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="material-icons text-sm">{formData.is_portfolio ? 'bookmark' : 'bookmark_border'}</span>
                  {formData.is_portfolio ? 'No portfólio' : 'Adicionar ao portfólio'}
                </button>
              </div>

              {/* Complexidade */}
              <div className="space-y-2 mb-5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nível de Complexidade</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(COMPLEXITY_CONFIG) as [ComplexityLevel, typeof COMPLEXITY_CONFIG[keyof typeof COMPLEXITY_CONFIG]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, complexity_level: p.complexity_level === key ? '' : key }))}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${
                        formData.complexity_level === key
                          ? `bg-${cfg.color}-50 dark:bg-${cfg.color}-900/30 border-${cfg.color}-300 dark:border-${cfg.color}-700 text-${cfg.color}-700 dark:text-${cfg.color}-300 shadow-sm`
                          : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span>{cfg.emoji}</span> {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags de portfólio */}
              <div className="space-y-2 mb-5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tags do Caso</label>
                <div className="flex flex-wrap gap-2">
                  {PORTFOLIO_TAG_SUGGESTIONS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setFormData(p => ({
                          ...p,
                          portfolio_tags: p.portfolio_tags.includes(tag)
                            ? p.portfolio_tags.filter(t => t !== tag)
                            : [...p.portfolio_tags, tag]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                        formData.portfolio_tags.includes(tag)
                          ? 'bg-primary/10 border-primary/30 text-primary dark:text-blue-300 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nota narrativa do portfólio */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nota de Portfólio (opcional)</label>
                <textarea
                  name="portfolio_notes"
                  value={formData.portfolio_notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Descreva brevemente o que torna esse caso relevante para seu portfólio..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-inner focus:ring-2 ring-primary/20 transition-all leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* ─── Honorário Estimado Dinâmico ─── */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                  <span className="material-icons text-2xl">payments</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Honorário Estimado</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {formatCurrency(useCustomPrice && formData.valor_personalizado ? formData.valor_personalizado : calculatePrice(formData.procedimento, formData.categoria, currentUser, formData.convenio))}
                  </div>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {useCustomPrice ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-xl">
                    <span className="material-icons text-sm">flight</span> Valor de Viagem / Personalizado
                  </span>
                ) : formData.convenio && currentUser?.financial_config?.convenios?.[formData.convenio] ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl">
                    <span className="material-icons text-sm">price_check</span> Baseado no Convênio ({formData.convenio})
                  </span>
                ) : currentUser?.financial_config?.pricing_model === 'fixed_per_surgery' && currentUser.financial_config.fixed_price ? (
                  <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-3 py-1.5 rounded-xl">
                    <span className="material-icons text-sm">tune</span> Valor fixo por cirurgia
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="material-icons text-sm">table_rows</span> Tabela de Categoria ({normalizeCategory(formData.categoria)})
                  </span>
                )}
              </div>
            </div>

            {/* Valor Personalizado (Viagem) */}
            <div className="md:col-span-2 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setUseCustomPrice(!useCustomPrice);
                  if (useCustomPrice) {
                    setFormData(p => ({ ...p, valor_personalizado: undefined }));
                  }
                }}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold text-sm transition-all w-full ${
                  useCustomPrice
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-2 ring-amber-200 dark:ring-amber-800'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="material-icons text-xl">{useCustomPrice ? 'flight' : 'flight'}</span>
                <div className="flex-1 text-left">
                  <span className="block text-xs font-black uppercase tracking-widest">Cirurgia Fora de BH</span>
                  <span className="block text-[10px] font-medium opacity-70 mt-0.5">Ative para informar o valor combinado</span>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 ${useCustomPrice ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${useCustomPrice ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>

              {useCustomPrice && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] ml-1">Valor Combinado (R$)</label>
                  <input
                    type="number"
                    name="valor_personalizado"
                    value={formData.valor_personalizado || ''}
                    onChange={(e) => setFormData(p => ({ ...p, valor_personalizado: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Ex: 4000"
                    min="0"
                    step="100"
                    className="w-full bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-5 font-black text-2xl text-amber-700 dark:text-amber-300 focus:ring-2 ring-amber-400/30 transition-all placeholder:text-amber-300 dark:placeholder:text-amber-700"
                    required
                  />
                  <p className="text-[9px] text-amber-500 font-bold mt-2 ml-1">Este valor substituirá o cálculo automático da tabela padrão.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-slate-950 text-white font-black rounded-[2rem] shadow-2xl hover:bg-black active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-sm flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {loading ? 'FINALIZANDO REGISTRO...' : 'FINALIZAR E SALVAR NA TABELA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProcedureForm;
