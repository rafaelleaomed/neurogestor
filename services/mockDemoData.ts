import { Surgery, PasswordEntry } from '../types';

/**
 * DADOS TOTALMENTE FICTÍCIOS / SINTÉTICOS PARA O MODO DEMONSTRAÇÃO
 * 
 * DIRETRIZES DE SEGURANÇA E GOVERNANÇA:
 * - 0% de dados de pacientes reais.
 * - 0% de nomes de médicos reais.
 * - 0% de nomes de hospitais reais.
 * - 0% de imagens, etiquetas ou exames reais.
 * - 0% de senhas ou credenciais reais.
 * - Dados 100% isolados em memória sem conexão com o Firestore de produção.
 */

export const DEMO_FICTITIOUS_PASSWORDS: PasswordEntry[] = [
  {
    id: 'demo-pw-1',
    hospital: 'Hospital Modelo (Fictício)',
    system: 'PEP Modelo',
    login: 'usuario.demonstracao',
    pass: '••••••••'
  },
  {
    id: 'demo-pw-2',
    hospital: 'Hospital Universitário Exemplo',
    system: 'Portal Cirúrgico Demo',
    login: 'medico.exemplo',
    pass: '••••••••'
  },
  {
    id: 'demo-pw-3',
    hospital: 'Centro Cirúrgico Demonstração',
    system: 'Laudos Online',
    login: 'neuro.demo',
    pass: '••••••••'
  }
];

export const DEMO_FICTITIOUS_SURGERIES: Surgery[] = [
  // 2026 - Mês 09 (Setembro)
  {
    id: 'demo-surg-1',
    paciente: 'PACIENTE DEMONSTRATIVO ALFA',
    hospital: 'HOSPITAL MODELO (DEMO)',
    medico: 'DR. CIRURGIÃO DEMONSTRATIVO',
    data: '2026-09-28',
    hora_inicio: '08:00',
    hora_fim: '12:30',
    procedimento: 'Artrodese Cervical Anterior C5-C6 (ACDF)',
    categoria: 'Coluna',
    subtipo: 'Cervical',
    niveis_operados: 1,
    estimated_screws: 0,
    valor_estimado: 1200,
    convenio: 'CONVÊNIO EXEMPLO SAÚDE',
    codigo_tuss: '4.01.03.54-5',
    cid_10: 'M50.1',
    numero_guia: 'TISS-998877',
    observacoes: 'Caso demonstrativo: Monitorização de PESS e PEM de membros superiores e inferiores sem intercorrências durante descompressão e colocação de cage.',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: true,
    complexity_level: 'desafiador',
    portfolio_tags: ['demonstrativo', 'coluna', 'acdf'],
    portfolio_notes: 'Demonstração de portfólio clínico: Potenciais evocados motores estáveis bilateralmente com alerta basal e recuperação imediata após alívio foraminal.'
  },
  {
    id: 'demo-surg-2',
    paciente: 'PACIENTE DEMONSTRATIVO BETA',
    hospital: 'HOSPITAL UNIVERSITÁRIO EXEMPLO',
    medico: 'DRA. NEUROCIRURGIÃ EXEMPLO',
    data: '2026-09-25',
    hora_inicio: '13:00',
    hora_fim: '18:45',
    procedimento: 'Ressecção de Neurinoma do Acústico (Ângulo Ponto-Cerebelar)',
    categoria: 'Crânio',
    subtipo: 'Base de Crânio',
    valor_estimado: 2400,
    convenio: 'PLANO SAÚDE MODELO',
    codigo_tuss: '4.01.03.61-8',
    cid_10: 'D33.3',
    numero_guia: 'TISS-998878',
    observacoes: 'Caso demonstrativo: Monitorização contínua de potenciais evocados auditivos de tronco encefálico (BAEP) e mapeamento do nervo facial (NC VII) por estimulação monopolar.',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: true,
    complexity_level: 'complexo',
    portfolio_tags: ['demonstrativo', 'base_de_cranio', 'nervo_facial'],
    portfolio_notes: 'Caso exemplo com preservação funcional anatômica e eletrofisiológica do nervo facial com limiar final de 0.05 mA.'
  },
  {
    id: 'demo-surg-3',
    paciente: 'PACIENTE DEMONSTRATIVO GAMA',
    hospital: 'HOSPITAL MODELO (DEMO)',
    medico: 'DR. ORTOPEDISTA DEMO',
    data: '2026-09-22',
    hora_inicio: '07:30',
    hora_fim: '11:00',
    procedimento: 'Artrodese Lombar L4-S1 (TLIF)',
    categoria: 'Coluna',
    subtipo: 'Lombar',
    niveis_operados: 2,
    estimated_screws: 6,
    valor_estimado: 1600,
    convenio: 'CONVÊNIO EXEMPLO SAÚDE',
    codigo_tuss: '4.01.03.55-3',
    cid_10: 'M51.2',
    numero_guia: 'TISS-998879',
    observacoes: 'Caso demonstrativo: Teste dinâmico de parafusos pediculares L4, L5 e S1 bilateralmente. Todos os limiares de estimulação acima de 12 mA, sem ruptura de pedículo.',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  },
  {
    id: 'demo-surg-4',
    paciente: 'PACIENTE DEMONSTRATIVO DELTA',
    hospital: 'CLÍNICA INTEGRADA DEMO',
    medico: 'DR. CIRURGIÃO DEMONSTRATIVO',
    data: '2026-09-18',
    hora_inicio: '14:00',
    hora_fim: '16:30',
    procedimento: 'Descompressão Microcirúrgica de Nervo Periférico',
    categoria: 'Nervo Periférico',
    subtipo: 'Membro Superior',
    valor_estimado: 900,
    convenio: 'PARTICULAR (EXEMPLO)',
    codigo_tuss: '4.01.03.66-9',
    cid_10: 'G56.0',
    observacoes: 'Caso demonstrativo: Mapeamento de condução trans-lesional do nervo mediano com registro de potencial de ação composto preservado.',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  },
  {
    id: 'demo-surg-5',
    paciente: 'PACIENTE DEMONSTRATIVO EPSILON',
    hospital: 'HOSPITAL UNIVERSITÁRIO EXEMPLO',
    medico: 'DRA. NEUROCIRURGIÃ EXEMPLO',
    data: '2026-09-12',
    hora_inicio: '08:00',
    hora_fim: '14:00',
    procedimento: 'Mapeamento Cortical e Subcortical para Ressecção de Glioma',
    categoria: 'Crânio',
    subtipo: 'Mapeamento Funcional',
    valor_estimado: 2100,
    convenio: 'PLANO SAÚDE MODELO',
    codigo_tuss: '4.01.03.61-8',
    cid_10: 'C71.1',
    observacoes: 'Caso demonstrativo: Estimulação cortical direta bipolar (técnica de Penfield) e monitorização de onda D corticospinal para ressecção tumoral em área eloquente.',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: true,
    complexity_level: 'complexo',
    portfolio_tags: ['demonstrativo', 'mapeamento_cortical', 'glioma'],
    portfolio_notes: 'Exemplo de preservação de via piramidal com amplitude da onda D mantida acima de 85% do valor basal.'
  },

  // 2026 - Mês 08 (Agosto)
  {
    id: 'demo-surg-6',
    paciente: 'PACIENTE DEMO - AGOSTO 1',
    hospital: 'HOSPITAL MODELO (DEMO)',
    medico: 'DR. CIRURGIÃO DEMONSTRATIVO',
    data: '2026-08-20',
    hora_inicio: '09:00',
    hora_fim: '13:00',
    procedimento: 'Artrodese Lombar L3-L5',
    categoria: 'Coluna',
    subtipo: 'Lombar',
    niveis_operados: 2,
    estimated_screws: 6,
    valor_estimado: 1500,
    convenio: 'CONVÊNIO EXEMPLO SAÚDE',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  },
  {
    id: 'demo-surg-7',
    paciente: 'PACIENTE DEMO - AGOSTO 2',
    hospital: 'HOSPITAL UNIVERSITÁRIO EXEMPLO',
    medico: 'DRA. NEUROCIRURGIÃ EXEMPLO',
    data: '2026-08-14',
    hora_inicio: '10:00',
    hora_fim: '15:30',
    procedimento: 'Meningeoma de Foice Cerebral',
    categoria: 'Crânio',
    subtipo: 'Tumor Cerebral',
    valor_estimado: 1800,
    convenio: 'PLANO SAÚDE MODELO',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  },

  // 2026 - Mês 07 (Julho)
  {
    id: 'demo-surg-8',
    paciente: 'PACIENTE DEMO - JULHO 1',
    hospital: 'CLÍNICA INTEGRADA DEMO',
    medico: 'DR. ORTOPEDISTA DEMO',
    data: '2026-07-10',
    hora_inicio: '08:30',
    hora_fim: '12:00',
    procedimento: 'Microdiscectomia L5-S1',
    categoria: 'Coluna',
    subtipo: 'Lombar',
    niveis_operados: 1,
    estimated_screws: 0,
    valor_estimado: 1000,
    convenio: 'CONVÊNIO EXEMPLO SAÚDE',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  },

  // 2025 - Amostra Histórica
  {
    id: 'demo-surg-9',
    paciente: 'PACIENTE DEMO - ANO 2025 (1)',
    hospital: 'HOSPITAL MODELO (DEMO)',
    medico: 'DR. CIRURGIÃO DEMONSTRATIVO',
    data: '2025-11-15',
    hora_inicio: '08:00',
    hora_fim: '13:00',
    procedimento: 'Artrodese Cervical C4-C6',
    categoria: 'Coluna',
    subtipo: 'Cervical',
    niveis_operados: 2,
    estimated_screws: 0,
    valor_estimado: 1400,
    convenio: 'CONVÊNIO EXEMPLO SAÚDE',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  },
  {
    id: 'demo-surg-10',
    paciente: 'PACIENTE DEMO - ANO 2025 (2)',
    hospital: 'HOSPITAL UNIVERSITÁRIO EXEMPLO',
    medico: 'DRA. NEUROCIRURGIÃ EXEMPLO',
    data: '2025-10-05',
    hora_inicio: '09:00',
    hora_fim: '16:00',
    procedimento: 'Descompressão Microvascular NC V',
    categoria: 'Crânio',
    subtipo: 'Nervos Cranianos',
    valor_estimado: 2000,
    convenio: 'PLANO SAÚDE MODELO',
    owner_email: 'visitante@neurogestor.demo',
    is_portfolio: false
  }
];

let inMemoryDemoSurgeries: Surgery[] = [...DEMO_FICTITIOUS_SURGERIES];

export const getDemoMockSurgeries = (): Surgery[] => {
  return [...inMemoryDemoSurgeries];
};

export const saveDemoMockSurgery = (surgery: Surgery): Surgery => {
  const existingIdx = inMemoryDemoSurgeries.findIndex(s => s.id === surgery.id);
  const updated: Surgery = {
    ...surgery,
    id: surgery.id || `demo-custom-${Date.now()}`,
    owner_email: 'visitante@neurogestor.demo'
  };

  if (existingIdx >= 0) {
    inMemoryDemoSurgeries[existingIdx] = updated;
  } else {
    inMemoryDemoSurgeries.unshift(updated);
  }
  return updated;
};

export const resetDemoMockSurgeries = () => {
  inMemoryDemoSurgeries = [...DEMO_FICTITIOUS_SURGERIES];
};
