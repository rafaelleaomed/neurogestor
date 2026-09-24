# Documento de Design: Rebranding, Onboarding Multi-Usuário, Modelo Financeiro Flexível e Conformidade LGPD/CFM

**Data:** 23/09/2026  
**Status:** Aprovado  
**Versão:** NeuroGestor 2.5 (Transição para Ecossistema Aberto de Neurofisiologia)

---

## 1. Visão Geral e Objetivos

O **NeuroGestor** evolui de um sistema interno da Equipe Camarinha para uma **plataforma independente e completa para neurofisiologistas e equipes cirúrgicas de todo o Brasil**.

### Objetivos Principais:
1. **Rebranding da Interface de Acesso**:
   - Eliminar termos restritivos internos ("Equipe Camarinha") na apresentação pública.
   - Posicionar o sistema como a plataforma definitiva de gestão cirúrgica, IA e neurofisiologia clínica.
   - Adicionar rodapé institucional com links de **Termos e Privacidade (LGPD)**, **Conformidade CFM** e **Suporte** (`medleaobh@gmail.com`).
2. **Onboarding Inteligente e Flexível para Novos Membros**:
   - Ao entrar via Google pela primeira vez, o profissional configura seu perfil e sua tabela de honorários.
   - Modelos suportados: **Por Convênio / Particular (personalizável)**, **Valor Fixo por Cirurgia** e **Por Complexidade/Categoria**.
3. **Preservação 100% Retroativa dos Usuários e Cirurgias Atuais**:
   - Usuários atuais continuam vinculados ao modelo pré-existente (`legacy_camarinha`: R$ 1.100 coluna/crânio, R$ 800 periférico) sem qualquer alteração indesejada em suas cirurgias e relatórios históricos.
4. **Campo de Convênio e Cálculo Automático no Cadastro de Cirurgias**:
   - Novo campo `convenio` no formulário e leitura automática pelo OCR com IA.
5. **Fundamentos do NeuroGestor 3.0**:
   - Arquitetura documentada para o futuro módulo de treinamento (mapas anatômicos de agulhas e músculos), agente de IA multimodal para ressonâncias magnéticas e comunidade/SaaS por assinatura.

---

## 2. Arquitetura de Dados (`types.ts`)

### 2.1 Extensão da Interface `User`
```typescript
export type PricingModelType = 'legacy_camarinha' | 'convenio' | 'fixed' | 'category';

export interface UserFinancialConfig {
  pricing_model: PricingModelType;
  default_price?: number; // Ex: 1100
  particular_price?: number; // Ex: 1800
  convenios?: Record<string, number>; // Ex: { 'Unimed': 1000, 'Bradesco': 1100, 'SulAmérica': 1100, 'Outros': 900 }
  category_pricing?: {
    [Category.COLUNA]?: number;
    [Category.CRANIO]?: number;
    [Category.NERVO_PERIFERICO]?: number;
  };
  confirm_per_surgery?: boolean; // Se verdadeiro, destaca o valor para confirmação
}

export interface User {
  email: string;
  name: string;
  picture?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  role?: 'user' | 'admin' | 'assistant' | 'owner';
  fcmToken?: string;
  rememberMe?: boolean;
  // Novos campos de onboarding e personalização
  crm?: string;
  uf?: string;
  onboarding_completed?: boolean;
  financial_config?: UserFinancialConfig;
}
```

### 2.2 Extensão da Interface `Surgery`
```typescript
export interface Surgery {
  // ... campos existentes mantidos integralmente ...
  convenio?: string; // Ex: 'Unimed', 'Bradesco Saúde', 'Particular', 'SulAmérica'
}
```

---

## 3. Telas e Fluxos de Usuário

### 3.1 Tela de Login (`pages/Login.tsx`)
- **Copywriting**:
  - *Título*: **NeuroGestor** — *Tecnologia e Inteligência para Neurofisiologia Cirúrgica*
  - *Subtítulo*: *"Do leitor inteligente de etiquetas ao fechamento financeiro por convênio: automatize seus laudos com IA, elimine glosas e construa seu portfólio cirúrgico de alta performance."*
- **Badges de Destaque**:
  - Leitura de Etiquetas com IA (Gemini)
  - Gestão de Convênios & Particular sem Glosas
  - Portfólio Clínico e Laudos Inteligentes
  - Criptografia & Conformidade LGPD / CFM
- **Rodapé Institucional**:
  - `Termos e Privacidade (LGPD)` (abre modal com os termos de privacidade médica)
  - `Conformidade CFM` (destaca resolução CFM 2.314/2022 sobre IA e sigilo)
  - `Suporte` (abre modal de suporte ou link `mailto:medleaobh@gmail.com`)

### 3.2 Modal de Onboarding (Novo Neurofisiologista)
Exibido automaticamente apenas para usuários recém-chegados (`!user.onboarding_completed`):
- **Passo 1: Identificação Profissional**:
  - Nome completo
  - CRM / UF
  - Especialidade / Função (Neurofisiologista Clínico, Residente, Técnico)
- **Passo 2: Modelo de Faturamento**:
  - Seleção do modelo:
    - *Opção 1: Por Convênio e Particular (Recomendado)*: Lista editável com Particular (R$ 1.800), Unimed (R$ 1.000), Bradesco (R$ 1.100), SulAmérica (R$ 1.100), Outros (R$ 900) + botão para adicionar convênios regionais.
    - *Opção 2: Valor Fixo*: Input para valor único por cirurgia (ex: R$ 1.100).
    - *Opção 3: Por Categoria*: Valores distintos para Coluna, Crânio e Nervo.
  - Checkbox: *"Sempre destacar o valor para conferência antes de salvar"*.
- **Passo 3: Conclusão**:
  - Salva as preferências no Firestore e libera o Dashboard.

### 3.3 Formulário de Cirurgia (`pages/ProcedureForm.tsx`)
- Campo seletor de **Convênio / Pagador**:
  - Opções pré-carregadas a partir da lista do médico (`convenios` do usuário + "Particular" + campo livre).
  - Atualização imediata do `valor_estimado` com base na tabela do usuário logado.
  - Integração no `performOCR` para extrair convênio da etiqueta cirúrgica.

---

## 4. Preservação Retroativa de Usuários Existentes

No startup da aplicação (`App.tsx`):
- Se o usuário logado for o admin (`rafaelleaobh@gmail.com`) ou um usuário já existente sem `financial_config`, ele recebe:
  - `onboarding_completed: true`
  - `financial_config.pricing_model: 'legacy_camarinha'`
- A função de cálculo `calculatePrice` respeita a precedência:
  1. Se for `legacy_camarinha` ou não configurado -> mantém regra histórica (R$ 1.100 / R$ 800).
  2. Se o usuário tiver tabela personalizada -> consulta o convênio ou categoria configurada.
  3. Se `useCustomPrice` estiver ativo -> usa `valor_personalizado`.

---

## 5. Próximos Passos: Estrutura do NeuroGestor 3.0 (Roadmap)

### 5.1 NeuroAcademy (Treinamento Técnico & Atlas Anatômico)
- Mapeamento vetorial de músculos para agulhas:
  - Nervos cranianos (VII, XI, XII).
  - Miótomos cervicais (C5 a T1) e lombossacrais (L2 a S4).
  - Guia visual de eletrodos monopolares vs subdermicos.
- Agente RAG especializado em neurofisiologia (literatura canônica ISIN / SBNC) para análise de ressonâncias de tumores cranianos/medulares e indicação de montagens anti-alucinação.

### 5.2 NeuroCommunity & Modelo SaaS
- Fórum de discussão de traçados e casos clínicos.
- Classificados de aparelhos de MNIO.
- Vagas e oportunidades cirúrgicas.
- Assinaturas recorrentes (Free, Pro, Equipe/Academy).
