# 🏛️ Architecture & System Design

The **Neurogestor** platform is designed as an event-driven, cloud-backed clinical workflow and digital health platform. It structures fragmented operative data and provides assistive intelligence for neurosurgical teams.

```
                              ┌────────────────────────────────────────┐
                              │            Client Layer                │
                              │     React 19 + TypeScript + Vite       │
                              │     Tailwind CSS + Recharts + PWA      │
                              └──────────────────┬─────────────────────┘
                                                 │
                                 HTTPS / TLS 1.3 │ Authenticated State
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │          BaaS & Cloud Layer            │
                              │         (Google Cloud / Firebase)      │
                              │                                        │
                              │  ┌──────────────────┐  ┌─────────────┐ │
                              │  │ Cloud Firestore  │  │   Storage   │ │
                              │  │ (Encrypted Docs) │  │  (Images)   │ │
                              │  └────────┬─────────┘  └──────┬──────┘ │
                              │           │                   │        │
                              │           ▼                   ▼        │
                              │        Security Rules (RBAC Engine)    │
                              └──────────────────┬─────────────────────┘
                                                 │
                                                 │ Server-side API Calls
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │           Intelligence Layer           │
                              │          Google Gemini 2.5 Flash       │
                              │     OCR, Field Extraction, Assistant   │
                              │     (Human-in-the-Loop Validation)     │
                              └────────────────────────────────────────┘
```

---

## 🧩 Architectural Components

### 1. Client Layer (Presentation & Local State)
- **Framework**: React 19 with Vite bundler for near-instant HMR and optimized production bundles.
- **Routing**: `react-router-dom` with route guards enforcing authentication and role-based permissions (`ProtectedRoute`).
- **Privacy Shield**: Client-side de-identification engine allowing on-the-fly masking of sensitive patient identifiers (PII) during clinical presentations or auditing.
- **Analytics Engine**: `recharts` for interactive procedural volume, pathology distribution, and surgical implant consumption.

### 2. Cloud Persistence Layer (Firebase / Google Cloud)
- **Cloud Firestore**: Real-time NoSQL document database configured with multi-region redundancy in South America (`southamerica-east1`).
- **Firebase Cloud Storage**: Secure object storage for intraoperative photographs, technical labels, and electrophysiological telemetry scans.
- **Cloud Messaging (FCM)**: Push notification service for administrative authorizations and operative schedule alerts.

### 3. Assistive AI Layer (Google Gemini)
- **Model**: `gemini-2.5-flash` integrated via the official `@google/genai` SDK.
- **Role**: Narrow assistive processing — extracting structured fields from unstructured operative reports and technical stickers.
- **Principle of Non-Autonomy**: AI never directly writes to the canonical clinical record without explicit clinician confirmation (*Human-in-the-loop*).

---

## 🔄 Data Lifecycle & Synchronization

1. **Ingestion**: Operative records are captured via digital forms or scanned through label OCR.
2. **Preprocessing**: Client validates syntax, normalizes anatomical terminology, and computes provisional metrics (e.g., screw counts per spinal level).
3. **Persistence**: Encrypted write to Firestore with automatic timestamping and actor attribution.
4. **Subscription**: Real-time snapshot listeners maintain synchronization across authorized team devices.
