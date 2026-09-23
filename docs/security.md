# 🔒 Security, Privacy & Compliance Specification

## 📜 Regulatory Baseline
The Neurogestor platform aligns with Brazilian and international medical software standards:
- **LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018)**: Protection of sensitive health data (Art. 5º, II and Art. 11, II, "a").
- **CFM Resolution nº 2.336/2023**: Medical ethics, confidentiality, and guidelines on clinical image documentation.
- **Code of Medical Ethics (CEM)**: Articles 73 to 79 (Medical Secrecy and Patient Dignity).

---

## 🛡️ Security Architecture & Principles

### 1. Principle of Least Privilege & Deny by Default
- The system enforces a strict **Deny-by-Default** security posture at the backend persistence layer.
- Unauthenticated or anonymous requests to clinical documents or patient files are rejected at the database perimeter.

### 2. Role-Based Access Control (RBAC)
User permissions are stratified across four operational tiers:
- **Owner / Technical Lead (`owner`)**: Full administrative privileges, user approval, system audit log inspection, and configuration management.
- **Administrator (`admin`)**: Team onboarding, user status approvals, and cohort-level reporting.
- **Surgeon / Clinician (`user`)**: Read and write access to their own operative records and portfolio cases.
- **Clinical Assistant (`assistant`)**: Procedural scheduling and volume logging without visibility into financial metrics or sensitive master configurations.

### 3. Privacy Shield (Dynamic De-Identification)
To bridge the gap between daily clinical utility (where the physician must look up patients by name) and scientific presentation or portfolio auditing:
- The platform incorporates a client-side **Privacy Shield**.
- When enabled, full patient names are dynamically converted into standardized cryptographic-style initials (e.g., `L. B. N. S. (Anonimizado)`) and financial values are obscured (`••••••`).
- Sanitized presentations allow screenshares, academic discussions, and audits without risking PII exposure.

### 4. Data Sanitization & Cryptography
- **In Transit**: Enforced TLS 1.3 / HTTPS for all client-to-cloud communications.
- **At Rest**: AES-256 transparent server-side encryption managed by Google Cloud Platform for all Firestore documents and Storage assets.
- **Codebase Sanitization**: All static repositories and version control histories are rigorously sanitized; real clinical data is excluded from version control and resides exclusively within authenticated cloud tenants.
