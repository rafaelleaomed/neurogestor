
export enum Category {
  CRANIO = 'Crânio',
  COLUNA = 'Coluna',
  NERVO_PERIFERICO = 'Nervo Periférico'
}

export enum Status {
  AGENDADO = 'Agendado',
  REALIZADO = 'Realizado',
  FATURADO = 'Faturado'
}

export type ComplexityLevel = 'routine' | 'challenging' | 'complex' | 'landmark';

export interface Surgery {
  id: string;
  data: string;
  paciente: string;
  procedimento: string;
  categoria: Category;
  subtipo?: string;
  medico: string;
  hospital: string;
  observacoes?: string;
  anexo_url?: string; // Legacy field
  label_images?: string[]; // Multiple labels
  report_text?: string;
  report_images?: string[]; // Scan dos relatórios como imagens (sem IA)
  hora_inicio?: string;
  hora_fim?: string;
  valor_estimado: number;
  valor_personalizado?: number; // Valor combinado para cirurgias fora de BH
  status: Status;
  created_at: number;
  possivel_duplicata?: boolean;
  owner_email?: string;
  // Neurogestor 2.0 — Portfólio
  is_portfolio?: boolean;
  complexity_level?: ComplexityLevel;
  portfolio_tags?: string[];
  portfolio_notes?: string;
  niveis_operados?: string; // Ex: L4-S1, T2-T10
  estimated_screws?: number; // Estimativa calculada automaticamente (2 por nível)
  // Neurogestor 2.0 — Laudo MNIO (Fase 2)
  tecnicas_mnio?: string[];
  houve_alarme?: boolean;
  condutas_alarme?: string[];
  clinical_images?: string[];
  convenio?: string; // Convênio ou Particular (ex: 'Unimed', 'Bradesco', 'Particular')
  // Faturamento TISS / TUSS (Saúde Suplementar ANS)
  codigo_tuss?: string; // Ex: '4.01.03.54-5' (Procedimento MNIO) ou '4.01.03.55-3' (Horas adicionais)
  cid_10?: string; // Ex: 'M48.0' (Estenose), 'M43.1' (Espondilolistese)
  numero_guia?: string; // Número da guia de autorização / TISS
}

export type PricingModelType = 'legacy_camarinha' | 'convenio' | 'fixed' | 'category';

export interface UserFinancialConfig {
  pricing_model: PricingModelType;
  default_price?: number;
  particular_price?: number;
  convenios?: Record<string, number>; // Ex: { 'Unimed': 800, 'Bradesco': 1000 }
  category_pricing?: {
    [Category.COLUNA]?: number;
    [Category.CRANIO]?: number;
    [Category.NERVO_PERIFERICO]?: number;
  };
  confirm_per_surgery?: boolean; // Se true, destaca o valor para confirmação
}

export interface User {
  email: string;
  name: string;
  picture?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  role?: 'user' | 'admin' | 'assistant' | 'owner';
  fcmToken?: string;
  rememberMe?: boolean;
  // Perfil profissional e Onboarding
  crm?: string; // Opcional (técnicos não possuem CRM)
  uf?: string;
  role_title?: string; // 'Neurofisiologista', 'Técnico de MNIO', 'Residente', etc.
  onboarding_completed?: boolean;
  financial_config?: UserFinancialConfig;
  team_id?: string; // Ex: 'camarinha'
  team_name?: string; // Ex: 'Equipe Camarinha'
  is_demo?: boolean; // Usuário visitante em modo demonstração
}

export interface OCRResult {
  paciente?: string;
  procedimento?: string;
  medico?: string;
  hospital?: string;
  data?: string;
  convenio?: string;
}

export interface PasswordEntry {
  id: string;
  hospital: string;
  system: string;
  login: string;
  pass: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  text: string;
}

export interface ElectrodeModel {
  id: string;
  surgery: string;
  details: string;
}
export interface LearnedCategory {
  id: string; // The procedure name (lowercase/trimmed) as ID
  category: Category;
  updated_at: number;
}
