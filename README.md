<div align="center">

**🌐 Language / Idioma:** [🇺🇸 English](README.md) • [🇧🇷 Português do Brasil](README.pt-BR.md)

</div>

# 🧠 Neurogestor

> Clinical workflow and surgical portfolio management platform developed as a healthcare digital product case study.  
> Exploring how structured clinical data, workflow automation, and AI-assisted information extraction can support the organization, governance, and longitudinal analysis of surgical activity.

<div align="center">

[![Live Demo - Free Demo Access](https://img.shields.io/badge/Live%20Demo-Instant%20Access%20(No%20Signup)-emerald?style=for-the-badge&logo=firebase)](https://neurogestor-app.web.app/#/demo)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Storage-orange?logo=firebase)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-blueviolet?logo=google)
![Compliance](https://img.shields.io/badge/Compliance-LGPD%20%7C%20CFM%202.336%2F2023-emerald)

</div>

> 🚀 **Explore Without Registration**: Anyone visiting the project can immediately test and navigate the full application with sample clinical cases, financial analytics, retrospective month selector, multimodal dossier exports, and AI reporting by clicking **[Live Demo](https://neurogestor-app.web.app/#/demo)** or choosing "Acessar Modo Demonstração" on the login screen.

---

## 👨‍⚕️ Why I Built This

During my medical work in **intraoperative neurophysiological monitoring (IONM)** and surgical team collaboration, I experienced firsthand the friction of managing fragmented clinical data across multiple hospitals, surgical teams, paper logs, and disparate hospital EHR systems.

The core challenge was clear:
> *How can fragmented, unstructured surgical information be transformed into structured, searchable, and longitudinally actionable clinical data without introducing excessive administrative burden on the clinician?*

**Neurogestor** began as a pragmatic tool to solve this daily clinical operational bottleneck and has evolved into an experimental digital health platform designed around **Human-in-the-Loop AI**, **Privacy-by-Design**, and **Clinical Governance**.

---

## 🩺 The Clinical Problem

Surgical and intraoperative monitoring practice generates complex data scattered across disconnected silos:
- Operative logs & timing (incision, monitoring duration, closure);
- Team rosters (lead surgeons, assistants, anesthesiologists, technical specialists);
- Institutional variance (differing protocols and billing across multiple hospital networks);
- Anatomical complexity & implants (spinal instrumentation, levels operated, electrode telemetry);
- Intraoperative photographs & technical implant stickers.

When this information remains unstructured:
1. **Longitudinal analytics** (complication tracking, volume stratification, implant consumption) become nearly impossible or require tedious manual spreadsheets;
2. **Clinical portfolio curation** for academic reviews, credentialing, or audits requires hours of retrospective chart searching;
3. **Data privacy risks** proliferate when unstructured notes and photographs are kept on personal devices without strict access controls.

---

## 💡 Product Hypothesis

> If surgical and neurophysiological case data can be structured and validated at the moment of registration—accelerated by assistive computer vision and LLM extraction—clinicians can eliminate redundant administrative logging, ensure strict patient confidentiality, and unlock real-time longitudinal insights into their operative practice.

---

## 🤖 AI Layer & Human Oversight

Rather than treating Artificial Intelligence as an autonomous decision-maker, Neurogestor implements AI as a **narrow, assistive productivity layer**:

### Assistive Capabilities
- **Technical Label OCR & Resilient Batch Ingestion**: High-throughput optical character recognition for surgical implant stickers and monitoring log sheets. Built with client-side adaptive image compression (75% RAM footprint reduction on mobile browsers), rate-limit backoff, multi-model fallback (`Gemini 2.5 Flash` -> `Gemini 2.0 Flash`), zero-drop guarantee for unread labels, and interactive batch conference with full-resolution sticker lightbox zoom;
- **Strict User-Tenant Deduplication**: Intelligent cross-case duplicate detection isolated per clinician account (`owner_email`), preventing false duplicate alerts across team members and ignoring generic placeholders;
- **Unstructured Text Parsing**: Extracting operational metadata (anatomical levels, surgical approach) from raw operative summaries;
- **Procedural Taxonomy Suggestions**: Suggesting canonical classifications (e.g., *Spine: Anterior Cervical Discectomy & Fusion (ACDF)* vs. *Lumbar TLIF*);
- **AI-Assisted IONM Reporting**: Automated drafting of structured intraoperative monitoring reports and technical minutas tailored to specific neurosurgical or orthopedic procedures, with mandatory physician review and instant in-place editing;
- **Multimodal Portfolio Synthesis**: Synthesizes clinical highlights, procedure timelines, and embeds intraoperative clinical photos, monitor screenshots, and implant labels into professional PDF dossiers and PowerPoint (PPTX) presentations;
- **Retrospective Period Analytics**: Interactive month-and-year selector on the main performance dashboard, enabling instant retrospective analysis of surgical volume, estimated revenue, average duration, and surgeon rankings, with quick reset to the active month;
- **TISS / TUSS & ICD-10 Healthcare Interoperability**: Structured capture of Brazilian Supplementary Health standard codes (ANS TUSS e.g. `4.01.03.54-5`, `4.01.03.55-3`, `4.01.03.61-8`), ICD-10 diagnostics, and insurance authorization identifiers, fully integrated into spreadsheet exports and clinical case audits.

### Clinical AI Principles
- **No Autonomous Writes**: AI suggestions are staged in a transient validation state. A human physician must explicitly review and confirm any parsed parameter before it is committed to the medical record.
- **Zero PII Exposure**: No patient demographic identifiers (names, IDs) are forwarded to external LLM endpoints during semantic classification.
- **Deterministic Safeguards**: Heuristic rule engines take priority over generative outputs for anatomical level counting and critical metrics.
- **Fault-Tolerant Clinical Ingestion**: Network or quota spikes during high-volume batch processing never discard medical sticker photos, preserving them for manual inline physician review.

---

## 👥 Multi-User Onboarding & Flexible Compensation

Neurogestor includes an adaptable financial configuration engine and tiered team management:
- **Flexible Compensation Models**: Supports autonomous neurophysiologists and team members with customizable reimbursement workflows:
  - *Fixed per-case fee* (valor fixo por cirurgia);
  - *Custom health plan & private tier tables* (tabela personalizada por convênio/particular);
  - *Case-by-case manual confirmation*;
  - *Team revenue-sharing and commission rules*.
- **Role-Based Governance & Teams**:
  - **Master Admin (`medleaobh@gmail.com`)**: Global platform oversight, user approvals, role assignments, and enterprise financial analytics.
  - **Team Administration**: Dynamic grouping (e.g., *Equipe Camarinha*) granting segregated access to sensitive clinical resources, such as institutional hospital credentials and remote server passwords.
  - **Physician Personal View**: Individual clinicians maintain a dedicated personal workspace focused exclusively on their own cases, surgical volume, and personal revenue without cross-enterprise clutter.

---

## 🛡️ Privacy Shield & Healthcare Compliance

Neurogestor is engineered in strict compliance with the **Brazilian General Data Protection Law (LGPD - Law 13.709/2018)** and the **Federal Council of Medicine (CFM Resolution nº 2.336/2023)**:

### 1. Dynamic "Privacy Shield" (LGPD by Design)
To resolve the tension between daily clinical utility (where the physician must look up patients by name) and professional demonstration:
- A single-click **Privacy Shield** toggle immediately de-identifies all onscreen patient names into standardized initials (e.g., `L. B. N. S. (Anonimizado)`) and masks financial data (`••••••`).
- This allows secure clinical case presentations, academic reviews, and screenshares without exposing Patient Health Information (PHI).

### 2. Regulatory Alignment & User Support
- **Art. 11, II, "a" (LGPD)**: Health data processing strictly governed under health protection and clinical care delivery.
- **CFM Resolution nº 2.336/2023**: All portfolio case views are restricted to scientific, educational, and professional auditing purposes, strictly prohibiting commercial sensationalism or guarantees of clinical outcomes.
- **Support & DPO Contact**: Direct transparency and privacy inquiry channel available to all users (`medleaobh@gmail.com`).
- **Backend Least Privilege**: Replaced open database access with authenticated Role-Based Access Control (RBAC) and explicit security rules on Firestore and Storage.
- **Zero Hardcoded Secrets**: Complete elimination of client-bundled credentials and static passwords; institutional portal credentials are fully encrypted and delegated to authenticated, team-segregated database records.

---

## ⚠️ Current Limitations

To maintain scientific transparency and realistic clinical expectations, current limitations include:
- **Assistive Scope**: The software is an administrative and case-logging tool; it is **not** a Software as a Medical Device (SaMD) for real-time surgical navigation or automated patient diagnosis.
- **Human Review Mandatory**: AI extraction accuracy varies with image resolution and handwriting legibility; clinician verification remains legally and clinically necessary.
- **Single-Tenant Prototype**: Current version is optimized for small surgical teams; full multi-tenant healthcare enterprise segregation is in active development.

---

## 🗺️ Engineering & Architecture Documentation

Detailed architectural and governance specifications are documented in the `/docs` directory:

| Document | Description |
| :--- | :--- |
| [**Architecture Specification**](docs/architecture.md) | Component architecture, data flows, and tech stack details |
| [**Security & Compliance**](docs/security.md) | LGPD data protection, encryption, and CFM ethical baselines |
| [**Clinical AI Governance**](docs/ai-governance.md) | Intended use, user personas, failure mode analysis, and HITL protocols |
| [**Data Model**](docs/data-model.md) | Firestore document schemas, taxonomies, and entity relations |
| [**Project Roadmap**](docs/roadmap.md) | Feature tracking across Product, AI, and Governance tiers |

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (with Dark Mode support)
- **Analytics & Charts**: Recharts
- **Persistence & Cloud**: Google Cloud Platform / Firebase (Cloud Firestore, Cloud Storage, FCM)
- **AI & Vision**: Google Gemini 2.5 Flash via `@google/genai` SDK
- **Document Generation**: `jspdf`, `xlsx`, `pptxgenjs`, `html2canvas`

---

## 🚀 Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- `npm` or `yarn`

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rafaelleaomed/neurogestor.git
   cd neurogestor
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

---

## 👨‍💻 Author

**Rafael Leão, MD**  
*Physician exploring AI in healthcare, digital health products, and clinical AI governance.*  
- **GitHub**: [@rafaelleaomed](https://github.com/rafaelleaomed)  
- **LinkedIn**: [rafaelleaomed](https://linkedin.com/in/rafaelleaomed)
