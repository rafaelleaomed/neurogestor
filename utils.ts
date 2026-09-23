
import { Surgery, Category, User } from './types';
import { PRICING, COMPLEX_KEYWORDS, PERIPHERAL_KEYWORDS, TUMOR_KEYWORDS, HOSPITAL_ALIASES, DOCTOR_ALIASES } from './constants';
import { getGlobalLearnedCategories, saveLearnedCategoryGlobal } from './services/storage';
import * as XLSX from 'xlsx';

/**
 * Normaliza um nome genérico: MAIÚSCULAS, sem acentos, espaços compactados.
 */
export const normalizeName = (name: string): string => {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');           // Compacta espaços
};

/**
 * Normaliza nome de médico: MAIÚSCULAS, sem acentos, sem DR/DRA, mapeando para o nome canônico oficial.
 */
export const normalizeDoctorName = (name: string): string => {
  if (!name) return '';
  const clean = normalizeName(name);

  if (DOCTOR_ALIASES[clean]) {
    return DOCTOR_ALIASES[clean];
  }

  // Remove prefixos DR/DRA e sufixos de parentesco para tentar encontrar
  const withoutDr = clean
    .replace(/^(DR|DRA)\.?\s+/i, '')
    .replace(/\s+(JUNIOR|JR\.?|FILHO|NETO|SOBRINHO)$/i, '')
    .trim();

  if (DOCTOR_ALIASES[withoutDr]) {
    return DOCTOR_ALIASES[withoutDr];
  }

  for (const [key, canonical] of Object.entries(DOCTOR_ALIASES)) {
    if (withoutDr === key || (withoutDr.length >= 6 && (withoutDr.startsWith(key) || key.startsWith(withoutDr)))) {
      return canonical;
    }
  }

  return clean.replace(/^(DR|DRA)\.?\s+/i, '').trim();
};

/**
 * Normaliza hospital: aplica normalização + resolve aliases canônicos conhecidos.
 */
export const normalizeHospitalName = (name: string): string => {
  if (!name) return '';
  const clean = normalizeName(name);

  if (HOSPITAL_ALIASES[clean]) {
    return HOSPITAL_ALIASES[clean];
  }

  const withoutHosp = clean.replace(/^(HOSPITAL|HOSP\.?|HP)\s+/i, '').trim();
  if (HOSPITAL_ALIASES[withoutHosp]) {
    return HOSPITAL_ALIASES[withoutHosp];
  }

  for (const [alias, canonical] of Object.entries(HOSPITAL_ALIASES)) {
    if (clean === alias || withoutHosp === alias) {
      return canonical;
    }
  }

  return clean;
};

/**
 * Normaliza qualquer valor ou variação de string de categoria para o enum canônico oficial Category.
 */
export const normalizeCategory = (cat: any): Category => {
  if (!cat) return Category.COLUNA;
  const clean = String(cat).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  if (clean.includes('CRANIO')) return Category.CRANIO;
  if (clean.includes('NERVO') || clean.includes('PERIFERICO')) return Category.NERVO_PERIFERICO;
  return Category.COLUNA;
};

export const normalizeForGrouping = (name: string, type: 'doctor' | 'hospital' = 'doctor'): string => {
  if (!name) return 'NÃO INFORMADO';
  if (type === 'doctor') {
    return normalizeDoctorName(name);
  } else {
    return normalizeHospitalName(name);
  }
};

export const calculatePrice = (procedimento: string, categoria?: Category): number => {
  // Override de Categoria: Se o usuário selecionou Nervo Periférico explicitly, o preço base é 800
  if (categoria === Category.NERVO_PERIFERICO) {
    return PRICING.PERIPHERAL;
  }

  const p = procedimento.toLowerCase();

  // Regra de Tumor de Nervo
  const isTumor = TUMOR_KEYWORDS.every(key => p.includes(key));
  if (isTumor || (p.includes('tumor') && PERIPHERAL_KEYWORDS.some(k => p.includes(k)))) {
    return PRICING.TUMOR_NERVE;
  }

  // Alta Complexidade
  if (COMPLEX_KEYWORDS.some(k => p.includes(k))) {
    return PRICING.HIGH_COMPLEXITY;
  }

  // Periférico
  if (PERIPHERAL_KEYWORDS.some(k => p.includes(k))) {
    return PRICING.PERIPHERAL;
  }

  return PRICING.DEFAULT;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '--/--/----';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

export const exportToExcel = (surgeries: Surgery[], user: User | null, month: string, year: string) => {
  // Ordenar por data em ordem crescente (01 -> 31)
  const sortedSurgeries = [...surgeries].sort((a, b) => {
    return new Date(a.data).getTime() - new Date(b.data).getTime();
  });

  const data = sortedSurgeries.map(s => ({
    'Data': formatDate(s.data),
    'Paciente': s.paciente,
    'Procedimento': s.procedimento,
    'Categoria': s.categoria,
    'Médico': s.medico,
    'Hospital': s.hospital,
    'Valor Estimado': s.valor_estimado,
    'Etiqueta': Array.isArray(s.label_images) && s.label_images.length > 0 ? '✅ SIM' : '❌ NÃO',
    'Relatório': Array.isArray(s.report_images) && s.report_images.length > 0 ? '✅ SIM' : '❌ NÃO'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-ajustar largura das colunas
  const colWidths = [
    { wch: 12 }, // Data
    { wch: 30 }, // Paciente
    { wch: 40 }, // Procedimento
    { wch: 18 }, // Categoria
    { wch: 25 }, // Médico
    { wch: 25 }, // Hospital
    { wch: 15 }, // Valor
    { wch: 10 }, // Etiqueta
    { wch: 10 }, // Relatório
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cirurgias');

  // Aba de Fotos com links das imagens
  // Limite do Excel: 32767 caracteres por célula. URLs base64 excedem facilmente isso.
  const MAX_CELL_LENGTH = 32000;
  const sanitizeUrl = (url: string): string => {
    if (!url) return '(sem link)';
    // Se for base64, não incluir na planilha (string enorme demais)
    if (url.startsWith('data:')) return '(imagem armazenada localmente - ver no app)';
    // Truncar qualquer URL que ainda ultrapasse o limite
    if (url.length > MAX_CELL_LENGTH) return url.substring(0, MAX_CELL_LENGTH);
    return url;
  };

  const photoRows: { Paciente: string; Data: string; Tipo: string; 'Link da Foto': string }[] = [];
  sortedSurgeries.forEach(s => {
    if (Array.isArray(s.label_images) && s.label_images.length > 0) {
      s.label_images.forEach((url, i) => {
        photoRows.push({
          'Paciente': s.paciente,
          'Data': formatDate(s.data),
          'Tipo': `Etiqueta ${i + 1}`,
          'Link da Foto': sanitizeUrl(url)
        });
      });
    }
    if (Array.isArray(s.report_images) && s.report_images.length > 0) {
      s.report_images.forEach((url, i) => {
        photoRows.push({
          'Paciente': s.paciente,
          'Data': formatDate(s.data),
          'Tipo': `Relatório ${i + 1}`,
          'Link da Foto': sanitizeUrl(url)
        });
      });
    }
  });

  if (photoRows.length > 0) {
    const photoSheet = XLSX.utils.json_to_sheet(photoRows);
    photoSheet['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, photoSheet, 'Fotos');
  }

  const userName = user?.name || 'Usuario';
  // Padronização: Usuário (Ex Rafael Leão - Mês - ANO)
  const fileName = `${userName} - ${month.toUpperCase()} - ${year}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const getLearnedCategories = (): Record<string, Category> => {
  return getGlobalLearnedCategories();
};

export const learnCategory = (procedureName: string, category: Category) => {
  if (!procedureName) return;
  saveLearnedCategoryGlobal(procedureName, category);
};

export const getCategoryFromText = (text: string): Category => {
  if (!text) return Category.COLUNA;
  const t = text.toLowerCase().trim();

  // 1. Dicionário de Aprendizado (Prioridade Máxima)
  const learned = getLearnedCategories();
  if (learned[t]) {
    return learned[t];
  }

  // 2. Classificação Automática Completa
  const classification = classifySurgeryProcedure(text);
  return classification.categoria;
};

export const normalizeDateToISO = (dateStr?: string): string => {
  if (!dateStr) return '';
  const clean = dateStr.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD/MM/YY or DD-MM-YY
  const shortYearMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2})$/);
  if (shortYearMatch) {
    const [, day, month, shortYear] = shortYearMatch;
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return '';
};

export const compressImage = (file: File, maxWidth = 1600, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Compress
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const VERTEBRAE_MAP: Record<string, number> = {};
let _vIndex = 0;
for (let i = 1; i <= 7; i++) VERTEBRAE_MAP['C' + i] = _vIndex++;
for (let i = 1; i <= 12; i++) VERTEBRAE_MAP['T' + i] = _vIndex++;
for (let i = 1; i <= 5; i++) VERTEBRAE_MAP['L' + i] = _vIndex++;
for (let i = 1; i <= 5; i++) VERTEBRAE_MAP['S' + i] = _vIndex++;

/**
 * Extrai níveis vertebrais (ex: C3-C5, L4-S1, T11-L4, L3-L4-L5 -> L3-L5)
 */
export const extractSpineLevels = (text: string): string | null => {
  if (!text) return null;
  const clean = normalizeName(text);

  // Vértebras individuais no texto: ex C3, C4, C5, L4, L5, S1
  const matches = clean.match(/\b([CTL]\d{1,2}|S[1-5])\b/g);
  if (matches && matches.length >= 2) {
    const valid = matches.filter(v => VERTEBRAE_MAP[v] !== undefined);
    if (valid.length >= 2) {
      let minV = valid[0];
      let maxV = valid[0];
      for (const v of valid) {
        if (VERTEBRAE_MAP[v] < VERTEBRAE_MAP[minV]) minV = v;
        if (VERTEBRAE_MAP[v] > VERTEBRAE_MAP[maxV]) maxV = v;
      }
      if (minV !== maxV) return `${minV}-${maxV}`;
    }
  }

  // Range com hífen abreviado: ex C3-5, L4-1, etc.
  const rangeMatch = clean.match(/\b([CTL]\d{1,2}|S[1-5])\s*(?:-|A|ATE|\/)\s*([CTL]\d{1,2}|S[1-5]|\d{1,2})\b/);
  if (rangeMatch) {
    let start = rangeMatch[1];
    let end = rangeMatch[2];
    if (/^\d+$/.test(end)) {
      end = start.charAt(0) + end;
    }
    if (VERTEBRAE_MAP[start] !== undefined && VERTEBRAE_MAP[end] !== undefined) {
      if (VERTEBRAE_MAP[start] > VERTEBRAE_MAP[end]) {
        return `${end}-${start}`;
      }
      return `${start}-${end}`;
    }
  }

  return null;
};

/**
 * Estima o número de parafusos pediculares a partir do campo niveis_operados.
 * Lógica: 2 parafusos por nível vertebral instrumentado (1 esquerdo + 1 direito).
 * IMPORTANTE: Artrodeses cervicais NÃO possuem estimulação de parafusos (via anterior / massa lateral).
 * Níveis puramente cervicais (C1-C7) retornam 0.
 * Ex: "L4-S1" => 3 vértebras (L4, L5, S1) => 6 parafusos
 *     "T11-L4" => 6 vértebras (T11, T12, L1, L2, L3, L4) => 12 parafusos
 *     "C3-C7" => 0 parafusos (cervical)
 */
export const estimateScrews = (niveisOperados: string, subtipoOrProc?: string): number => {
  if (!niveisOperados || niveisOperados.trim() === '') return 0;
  
  if (subtipoOrProc) {
    const norm = normalizeName(subtipoOrProc);
    if (norm.includes('CERVICAL')) return 0;
  }

  const clean = normalizeName(niveisOperados);

  // Se todos os níveis forem exclusivamente cervicais (C1 a C7), retorna 0
  const vertebrae = clean.match(/\b([CTL]\d{1,2}|S[1-5])\b/g);
  if (vertebrae && vertebrae.length > 0) {
    const isAllCervical = vertebrae.every(v => v.startsWith('C'));
    if (isAllCervical) return 0;
  }

  const parts = clean.split('-');
  if (parts.length === 2 && VERTEBRAE_MAP[parts[0]] !== undefined && VERTEBRAE_MAP[parts[1]] !== undefined) {
    // Se for intervalo inteiramente cervical, não há estimulação de parafusos
    if (parts[0].startsWith('C') && parts[1].startsWith('C')) return 0;

    // Se for transição cérvico-torácica (ex: C5-T3), conta apenas a partir de T1
    let startIdx = VERTEBRAE_MAP[parts[0]];
    const endIdx = VERTEBRAE_MAP[parts[1]];
    if (parts[0].startsWith('C')) {
      startIdx = VERTEBRAE_MAP['T1'];
    }
    const count = endIdx - startIdx + 1;
    return count > 0 ? count * 2 : 0;
  }

  // Caso contenha múltiplos separados por vírgula ou espaço (ignora níveis cervicais)
  const multi = clean.match(/\b([CTL]\d{1,2}|S[1-5])\b/g);
  if (multi && multi.length > 0) {
    const nonCervical = multi.filter(v => VERTEBRAE_MAP[v] !== undefined && !v.startsWith('C'));
    const unique = new Set(nonCervical);
    return unique.size * 2;
  }

  return 0;
};

/**
 * Classifica automaticamente o procedimento cirúrgico com base na descrição,
 * determinando Categoria, Subtipo e Níveis Operados / Parafusos estimados.
 */
export const classifySurgeryProcedure = (procText: string): {
  categoria: Category;
  subtipo: string;
  niveis_operados?: string;
  estimated_screws?: number;
} => {
  const text = normalizeName(procText);
  const levels = extractSpineLevels(text);

  // 1. NERVO PERIFÉRICO
  if (text.includes('PAROTIDA') || text.includes('PAROTIDECTOMIA')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Facial — Parotidectomia', estimated_screws: 0 };
  }
  if (text.includes('MASTOIDECTOMIA') || text.includes('TIMPANOPLASTIA') || text.includes('COCLEAR') || text.includes('OTORRINO')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Facial — Otorrino', estimated_screws: 0 };
  }
  if (text.includes('BUCOMAXILO') || text.includes('ORTOGNATICA') || text.includes('MANDIBULA') || text.includes('MAXILAR')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Facial — Bucomaxilo', estimated_screws: 0 };
  }
  if (text.includes('LARINGEO') || text.includes('TIREOIDECTOMIA') || text.includes('TIREOIDE') || text.includes('TIROIDECTOMIA')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Laríngeo Recorrente', estimated_screws: 0 };
  }
  if (text.includes('PLEXO BRAQUIAL')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Plexo Braquial', estimated_screws: 0 };
  }
  if (text.includes('PLEXO LOMBOSSACRO') || text.includes('LOMBOSSACRAL')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Plexo Lombossacro', estimated_screws: 0 };
  }
  if (text.includes('TUMOR DE NERVO') || text.includes('TUMOR NERVO') || text.includes('TUMOR CIATICO') || text.includes('TUMOR PLEXO') || text.includes('SCHWANNOMA CIATICO') || text.includes('TUMOR SARTORIO')) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Tumor de Nervo Periférico', estimated_screws: 0 };
  }
  if (text.includes('NEUROLISE') || text.includes('TUNEL DO CARPO') || text.includes('NERVO ULNAR') || text.includes('NERVO MEDIANO') || text.includes('NERVO FIBULAR') || text.includes('NERVO TIBIAL') || text.includes('FACIAL BILATERAL') || text.includes('FACIAL DIREITO') || text.includes('FACIAL ESQUERDO') || (text.includes('FACIAL') && !text.includes('ESPASMO'))) {
    return { categoria: Category.NERVO_PERIFERICO, subtipo: 'Descompressão Microvascular', estimated_screws: 0 };
  }

  // 2. CRÂNIO
  if (text.includes('DBS') || text.includes('SUBTALAMICO') || text.includes('ESTIMULACAO CEREBRAL') || (text.includes('ESTIMUL') && (text.includes('CEREBRAL') || text.includes('ENCEFAL')))) {
    return { categoria: Category.CRANIO, subtipo: 'DBS / Neuroestimulador', estimated_screws: 0 };
  }
  if (text.includes('ESPASMO') || text.includes('TRIGEMEO') || text.includes('TRIGEMIO') || text.includes('JANETTA') || text.includes('DESCOMPRESSAO NEUROVASCULAR') || text.includes('DESCOMPRESSAO DE TRIGEMEO') || text.includes('DESCOMPRESSAO TRIGEMEO')) {
    return { categoria: Category.CRANIO, subtipo: 'Espasmo Hemifacial / Trigêmeo', estimated_screws: 0 };
  }
  if (text.includes('ANEURISMA') || text.includes('CAVERNOMA') || text.includes('MAV') || text.includes('MALFORMACAO ARTERIOVENOSA') || text.includes('CLIPAGEM') || text.includes('BYPASS')) {
    return { categoria: Category.CRANIO, subtipo: 'Aneurisma / Cavernoma', estimated_screws: 0 };
  }
  if (text.includes('NEURINOMA') || text.includes('SCHWANNOMA VESTIBULAR') || text.includes('ANGULO PONTO')) {
    return { categoria: Category.CRANIO, subtipo: 'Neurinoma Acústico', estimated_screws: 0 };
  }
  if (text.includes('GLOMUS')) {
    return { categoria: Category.CRANIO, subtipo: 'Glomus Jugular', estimated_screws: 0 };
  }
  if (text.includes('HIPOFISE') || text.includes('SELA TURCICA') || text.includes('SELA') || text.includes('ADENOMA') || text.includes('MACROADENOMA')) {
    return { categoria: Category.CRANIO, subtipo: 'Hipófise / Sellar', estimated_screws: 0 };
  }
  if (text.includes('MENINGIOMA') || text.includes('MENINGEOMA')) {
    return { categoria: Category.CRANIO, subtipo: 'Meningeoma', estimated_screws: 0 };
  }
  if (text.includes('GBM') || text.includes('GLIOBLASTOMA') || text.includes('ASTROCITOMA') || text.includes('GLIOMA') || text.includes('RECIDIVA GBM')) {
    return { categoria: Category.CRANIO, subtipo: 'GBM / Glioma Alto Grau', estimated_screws: 0 };
  }
  if (text.includes('AWAKE') || text.includes('MAP CORTICAL') || text.includes('MAPEAMENTO CORTICAL')) {
    return { categoria: Category.CRANIO, subtipo: 'Mapeamento Cortical (Awake)', estimated_screws: 0 };
  }
  if (text.includes('MAP SUBCORTICAL') || text.includes('MAPEAMENTO SUBCORTICAL')) {
    return { categoria: Category.CRANIO, subtipo: 'Mapeamento Subcortical', estimated_screws: 0 };
  }
  if (text.includes('BASE DE CRANIO') || text.includes('BASE DO CRANIO') || text.includes('PETROCLIVAL') || text.includes('CLIVUS') || text.includes('FOSSA POSTERIOR') || text.includes('CRANIO') || text.includes('CRANIOTOMIA') || text.includes('TUMOR CEREBRAL') || text.includes('TUMOR CRANIANO') || text.includes('TUMOR CEREBELAR') || text.includes('TUMOR FRONTAL') || text.includes('TUMOR TEMPORAL') || text.includes('TUMOR PARIETAL') || text.includes('TUMOR OCCIPITAL') || text.includes('ENDARTERECTOMIA') || text.includes('CHIARI')) {
    return { categoria: Category.CRANIO, subtipo: 'Tumor Base de Crânio', estimated_screws: 0 };
  }

  // 3. COLUNA
  if (text.includes('NEUROESTIMULADOR') || text.includes('ESTIMULADOR MEDULAR') || text.includes('ELETRODO MEDULAR') || text.includes('ESTIMULACAO MEDULAR') || text.includes('GERADOR PARA NEUROESTIMULACAO') || text.includes('SISTEMA DE NEUROESTIMULACAO') || text.includes('ELETRODO EPIDURAL')) {
    return { categoria: Category.COLUNA, subtipo: 'Neuroestimulador', niveis_operados: levels || undefined, estimated_screws: 0 };
  }
  const isArthrodesis = text.includes('ARTRODESE') || text.includes('TLIF') || text.includes('XLIF') || text.includes('OLIF') || text.includes('ALIF') || text.includes('FUSAO') || text.includes('FIXA') || text.includes('PARAFUSO') || text.includes('INSTRUMENTA');

  if (text.includes('ESCOLIOSE') || text.includes('CIFOSE') || text.includes('DEFORMIDADE')) {
    return { categoria: Category.COLUNA, subtipo: 'Escoliose / Cifose', niveis_operados: levels || undefined, estimated_screws: levels ? estimateScrews(levels) : 0 };
  }
  if (text.includes('ENDOSCOP')) {
    return { categoria: Category.COLUNA, subtipo: 'Cirurgia Endoscópica', niveis_operados: levels || undefined, estimated_screws: isArthrodesis && levels ? estimateScrews(levels) : 0 };
  }
  if (text.includes('FRATURA') || text.includes('TRAUMA') || text.includes('TRM') || text.includes('ODONTOIDE')) {
    return { categoria: Category.COLUNA, subtipo: 'Trauma Vertebral / Fratura', niveis_operados: levels || undefined, estimated_screws: levels ? estimateScrews(levels) : 0 };
  }
  if (text.includes('TUMOR') && (text.includes('INTRADURAL') || text.includes('MEDULAR') || text.includes('EPENDIMOMA') || text.includes('MEDULA'))) {
    return { categoria: Category.COLUNA, subtipo: 'Tumor de Coluna - Intradural', niveis_operados: levels || undefined, estimated_screws: isArthrodesis && levels ? estimateScrews(levels) : 0 };
  }
  if (text.includes('TUMOR') && (text.includes('EXTRADURAL') || text.includes('METASTASE') || text.includes('VERTEBRAL') || text.includes('OSSEO') || text.includes('CORDOMA'))) {
    return { categoria: Category.COLUNA, subtipo: 'Tumor de Coluna - Extradural', niveis_operados: levels || undefined, estimated_screws: levels ? estimateScrews(levels) : 0 };
  }
  if (text.includes('TUMOR')) {
    return { categoria: Category.COLUNA, subtipo: 'Tumor de Coluna - Intradural', niveis_operados: levels || undefined, estimated_screws: isArthrodesis && levels ? estimateScrews(levels) : 0 };
  }
  if (text.includes('CORPECTOMIA')) {
    return { categoria: Category.COLUNA, subtipo: 'Corpectomia / Laminectomia', niveis_operados: levels || undefined, estimated_screws: levels ? estimateScrews(levels) : 0 };
  }
  if (!isArthrodesis && (text.includes('LAMINECTOMIA') || text.includes('FLAVECTOMIA') || text.includes('FORAMINOTOMIA') || text.includes('DISCECTOMIA') || text.includes('HERNIA') || text.includes('DESCOMPRESS'))) {
    return { categoria: Category.COLUNA, subtipo: 'Corpectomia / Laminectomia', niveis_operados: levels || undefined, estimated_screws: 0 };
  }

  // Artrodeses de Coluna
  const hasC = levels ? levels.includes('C') : (text.includes('CERVICAL') || /\bC[1-7]\b/.test(text));
  const hasT = levels ? levels.includes('T') : (text.includes('TORACIC') || text.includes('TORACICO') || /\bT\d+\b/.test(text));
  const hasL = levels ? (levels.includes('L') || levels.includes('S')) : (text.includes('LOMBAR') || text.includes('SACR') || /\bL[1-5]\b/.test(text) || /\bS[1-5]\b/.test(text));

  let spineSubtipo = 'Artrodese Lombar (TLIF/XLIF/OLIF/ALIF)';
  if (hasT && hasL) {
    spineSubtipo = 'Artrodese Toracolombar';
  } else if (hasC && !hasL) {
    spineSubtipo = 'Artrodese Cervical';
  } else if (hasT && !hasL && !hasC) {
    spineSubtipo = 'Artrodese Torácica';
  } else if (hasL) {
    spineSubtipo = 'Artrodese Lombar (TLIF/XLIF/OLIF/ALIF)';
  } else if (text.includes('CERVICAL')) {
    spineSubtipo = 'Artrodese Cervical';
  } else if (text.includes('TORACO')) {
    spineSubtipo = 'Artrodese Toracolombar';
  } else if (text.includes('TORACIC')) {
    spineSubtipo = 'Artrodese Torácica';
  }

  const isCervicalArthrodesis = spineSubtipo === 'Artrodese Cervical' || text.includes('CERVICAL');

  return {
    categoria: Category.COLUNA,
    subtipo: spineSubtipo,
    niveis_operados: levels || undefined,
    estimated_screws: (isCervicalArthrodesis || !levels) ? 0 : estimateScrews(levels, spineSubtipo)
  };
};

