<div align="center">

**Language:** [English](README.md) · [Português do Brasil](README.pt-BR.md)

# NeuroGestor

**Clinical workflow and surgical portfolio management for intraoperative neurophysiological monitoring.**

[Live synthetic-data demo](https://neurogestor-app.web.app/#/demo) · [Architecture](docs/architecture.md) · [Security](docs/security.md) · [AI governance](docs/ai-governance.md)

</div>

## The problem

IONM work across multiple hospitals produces fragmented information: paper records, spreadsheets, photos, implant labels, billing data and surgical-team details. This makes case retrieval, longitudinal analysis, auditing and privacy protection harder than they need to be.

NeuroGestor converts that workflow into structured, searchable records while keeping AI in an assistive role. It is an administrative and documentation product, not a diagnostic system or autonomous medical device.

## What is implemented

- Structured registration for cranial, spine and peripheral-nerve procedures;
- operational flow from scheduled to completed and billed, with cancellation history;
- dashboards for case volume, duration, estimated revenue and surgical partners;
- Gemini-assisted OCR for labels, with manual review when extraction fails;
- editable IONM report drafting with mandatory clinician validation;
- portfolio generation and exports to PDF, PowerPoint and spreadsheets;
- TUSS, ICD-10 and insurance-authorization fields;
- Google Calendar integration and Firebase Cloud Messaging notifications;
- synthetic demo data for safe product evaluation.

## AI and clinical governance

AI suggestions are reviewable before they become part of a record. The product also includes role-based access rules, a Privacy Shield that masks patient and financial information on screen, documented security controls and audit/reconciliation scripts.

No patient names are required for semantic classification. AI output may be incomplete or wrong and must be validated by a qualified user.

## Architecture

- **Frontend:** React 19, TypeScript 5.8, Vite 6 and Recharts;
- **Cloud:** Firebase Authentication, Firestore, Storage and Cloud Messaging;
- **AI:** Google Gemini for OCR, structured extraction and report drafting;
- **Documents:** jsPDF, PptxGenJS, SheetJS and html2canvas;
- **Quality:** TypeScript tests, Firebase rules tests and production build validation.

## Run locally

```bash
npm install
npm run dev
```

Create the required local environment variables from the project configuration before using external services. Do not commit credentials.

## Verification

```bash
node --no-warnings --experimental-transform-types --test tests/*.test.ts
npm run build
```

## Current limitations

- AI accuracy depends on source-image quality and input completeness;
- clinical and administrative information requires human review;
- the current product targets individual clinicians and small teams rather than hospital-wide deployment;
- the public demo uses synthetic data and does not represent clinical validation.

## Author

**Rafael Leão, MD:** physician working with intraoperative neurophysiological monitoring and healthcare software.
[GitHub](https://github.com/rafaelleaomed) · [LinkedIn](https://www.linkedin.com/in/rafaelleaomed/)
