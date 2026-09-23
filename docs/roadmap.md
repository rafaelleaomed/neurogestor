# 🗺️ Project Roadmap & Evolution

The development roadmap reflects the progressive evolution of **Neurogestor** from a personal surgical registry into an enterprise-grade digital health case study.

---

## 📦 1. Product & Clinical Workflow

- [x] **Surgical Case Registry**: Core procedure registration, medical team tracking, and institutional tagging. `✅ Implemented`
- [x] **Longitudinal Analytics Dashboard**: Multi-year volume graphs, pathology mix charts, and complexity breakdowns via Recharts. `✅ Implemented`
- [x] **Portfolio Case Series**: Tagging landmark procedures, complexity stratification, and image attachment. `✅ Implemented`
- [x] **Privacy Shield (LGPD)**: Instant client-side de-identification toggle for clinical meetings and portfolio auditing. `✅ Implemented`
- [x] **Multi-format Clinical Export**: Dynamic generation of Excel (.xlsx), PDF, and PowerPoint (.pptx) case presentations. `✅ Implemented`
- [ ] **Multi-tenant Hospital Workspaces**: Distinct tenant isolation for surgical teams across separate medical centers. `⬜ Planned`
- [ ] **DICOM Viewer Integration**: Native viewing of CT/MRI DICOM slices directly associated with operative records. `⬜ Planned`

---

## 🤖 2. Clinical AI & Automation

- [x] **Gemini 2.5 Flash Integration**: Rapid OCR on operative labels and automated text classification. `✅ Implemented`
- [x] **Deterministic Anatomical Rules**: Fallback regex classification engine prioritizing safety over generative ambiguity. `✅ Implemented`
- [ ] **Human-in-the-Loop Review Staging**: Dedicated review workspace displaying confidence scores for extracted parameters before persistence. `🟡 In development`
- [ ] **Clinical Extraction Benchmark**: Evaluation dataset comparing LLM extraction against double-entered human ground truth. `⬜ Planned`
- [ ] **Taxonomy Error Logging**: Automated error-tracking metric analyzing clinician overrides. `⬜ Planned`

---

## 🛡️ 3. Security, Governance & Architecture

- [x] **LGPD Data Sanitization**: Strict removal of persistent PII from open-source repositories and public codebases. `✅ Implemented`
- [x] **Backend Deny-by-Default Policy**: Replaced permissive rules with role-checked Firestore and Storage specifications. `✅ Implemented`
- [x] **Modular Repository Architecture**: Segregation of code into `src/`, `scripts/`, `firebase/`, and formal `/docs`. `✅ Implemented`
- [ ] **Native Firebase Authentication Migration**: Full deprecation of legacy frontend state in favor of OAuth/Firebase Auth tokens with custom claims. `🟡 In development`
- [ ] **Scheduled Backup & Restore Testing**: Automated Cloud Storage export with lifecycle retention and verified dry-run restoration. `⬜ Planned`
- [ ] **Environment Segregation (`dev` / `staging` / `prod`)**: Distinct Firebase projects preventing experimental interference with live clinical records. `⬜ Planned`
