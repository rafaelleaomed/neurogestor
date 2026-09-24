# Multi-User Onboarding & Flexible Finance Implementation Plan

> **For Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform NeuroGestor into an open, professional platform for neurophysiologists with rebranded login, LGPD/CFM compliance, support channel, flexible multi-user billing by health plan/private, and an onboarding wizard while 100% preserving existing legacy data and rules.

**Architecture:** Extend the `User` schema with onboarding status and financial preferences (`financial_config`). Provide an interactive Onboarding Modal on first Google sign-in. Update `ProcedureForm` with a `convenio` field linked to user pricing preferences, and update `Login.tsx` with high-impact copywriting, medical compliance badges, and footer links (Terms, CFM, Support). Auto-flag existing users as `legacy_camarinha` so their billing logic remains untouched.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Firebase Firestore & Hosting, Google GenAI (Gemini OCR).

---

### Task 1: Update Data Models (`types.ts`)
**Files:**
- Modify: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/types.ts`

**Steps:**
1. Add `PricingModelType` and `UserFinancialConfig` interfaces.
2. Extend `User` with `crm`, `uf`, `onboarding_completed`, and `financial_config`.
3. Extend `Surgery` with `convenio?: string`.
4. Extend `OCRResult` with `convenio?: string`.

---

### Task 2: Update Calculation Engine (`utils.ts`)
**Files:**
- Modify: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/utils.ts`

**Steps:**
1. Update `calculatePrice` signature to accept optional `user?: User | null` and `convenio?: string`.
2. If `user` has `financial_config.pricing_model === 'convenio'`, calculate price based on `convenios[convenio]` (with fallback to Particular, default_price, or PRICING.DEFAULT).
3. If `user` has `pricing_model === 'fixed'`, return `default_price`.
4. If `user` has `pricing_model === 'category'`, return corresponding category price.
5. If `user` has `pricing_model === 'legacy_camarinha'` or is undefined, maintain the exact historical rules (R$ 1.100 / R$ 800).

---

### Task 3: Legal, CFM & Support Modals (`components/LegalModals.tsx`)
**Files:**
- Create: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/components/LegalModals.tsx`

**Steps:**
1. Implement modal for **Termos de Uso e Privacidade (LGPD)**:
   - Respeito à Lei 13.709/2018 (Arts. 7 e 11).
   - Anonimização de dados de pacientes (Modo Privacidade).
   - Criptografia e controle de acesso.
2. Implement modal for **Conformidade Ética e Resoluções CFM**:
   - Resolução CFM 2.314/2022 (Uso ético de IA em Medicina como auxílio de decisão).
   - Não substituição do parecer do neurofisiologista.
3. Implement modal for **Suporte ao Usuário**:
   - Email oficial: `medleaobh@gmail.com`.
   - Botão de envio direto `mailto:` e botão de cópia de e-mail com feedback visual.

---

### Task 4: Rebrand Login Screen (`pages/Login.tsx`)
**Files:**
- Modify: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/pages/Login.tsx`

**Steps:**
1. Update copywriting:
   - Slogan: *"Tecnologia e Inteligência para Neurofisiologia Cirúrgica"*
   - Subtitle: *"Do leitor inteligente de etiquetas ao fechamento financeiro por convênio: automatize seus laudos com IA, elimine glosas e construa seu portfólio cirúrgico de alta performance."*
2. Add highlight feature badges:
   - *Leitura Inteligente de Etiquetas*
   - *Gestão por Convênio & Particular*
   - *Portfólio & Laudos com IA*
   - *Criptografia & LGPD / CFM*
3. Add institutional footer (matching user reference image):
   - Links: `Termos e Privacidade` · `Conformidade CFM` · `Suporte`
4. Connect modals created in Task 3.

---

### Task 5: Onboarding Wizard Component (`components/OnboardingModal.tsx`)
**Files:**
- Create: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/components/OnboardingModal.tsx`

**Steps:**
1. Create a 3-step modern wizard with glassmorphism:
   - Step 1: CRM, UF, Nome Profissional.
   - Step 2: Modelo de Honorários (Convênio/Particular com tabela inicial editável, Valor Fixo ou Por Categoria) + checkbox de confirmação por cirurgia.
   - Step 3: Resumo e botão para iniciar.
2. Persist configurations to Firestore and local storage on complete, setting `onboarding_completed: true`.

---

### Task 6: Legacy User Auto-Migration & Integration in `App.tsx`
**Files:**
- Modify: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/App.tsx`

**Steps:**
1. On user session load, check if existing registered users (including admin `rafaelleaobh@gmail.com`) lack `financial_config`.
2. Automatically assign `onboarding_completed: true` and `pricing_model: 'legacy_camarinha'` to existing users.
3. Render `OnboardingModal` if `user && !user.onboarding_completed`.

---

### Task 7: Update Surgery Form with Convênio Field (`pages/ProcedureForm.tsx` & `services/gemini.ts`)
**Files:**
- Modify: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/pages/ProcedureForm.tsx`
- Modify: `c:/Users/racle/Meu Drive/Projeto IA/Neurogestor/services/gemini.ts`

**Steps:**
1. Add `convenio` selector in `ProcedureForm.tsx` with options from user's configured convênios + "Particular" + custom input.
2. Recalculate price dynamically when `convenio` changes based on `user.financial_config`.
3. In `services/gemini.ts`, add extraction directive in OCR prompt for health plan/convênio printed on the surgical label.

---

### Task 8: Verification & Production Deployment
**Steps:**
1. Run `npm run build` to verify type safety and bundle generation.
2. Deploy to Firebase Hosting via `npx --no-install firebase deploy --only hosting`.
3. Verify new Login layout, footer modals, onboarding flow for new users, and existing user data preservation.
