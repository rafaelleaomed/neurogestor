
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
}

export interface User {
  email: string;
  name: string;
  picture?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  role?: 'user' | 'admin' | 'assistant' | 'owner';
  fcmToken?: string;
  rememberMe?: boolean;
}

export interface OCRResult {
  paciente?: string;
  procedimento?: string;
  medico?: string;
  hospital?: string;
  data?: string;
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
