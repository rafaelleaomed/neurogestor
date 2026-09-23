# 🤖 Clinical AI Governance & Evaluation Framework

> **Status**: Active Framework  
> **Target Standard**: Responsible AI in Clinical Practice & Software as a Medical Device (SaMD) Pre-evaluation

---

## 🎯 Intended Use & Clinical Scope

### Intended Use
Neurogestor utilizes generative AI models for **assistive administrative and data-structuring workflows**. The system processes unstructured surgical notes, handwritten operative logs, and technical label photographs to suggest structured database entries.

### Explicitly Excluded Uses
- **Autonomous Diagnosis**: The AI layer does not provide clinical diagnoses or pathological interpretations.
- **Autonomous Treatment Planning**: The AI does not recommend surgical approaches, implant dimensions, or operative strategies.
- **Real-Time Critical Alarm Interpretation**: The system is not a real-time intraoperative monitor; it is a post-operative logging and analytical platform.

---

## 👥 User Personas & Interactions

| Persona | AI Interaction | Oversight Requirement |
| :--- | :--- | :--- |
| **Operating Surgeon** | Reviews extracted fields from operative report | 100% manual validation before record persistence |
| **Neurophysiologist** | Validates technical monitoring labels (OCR) | Verification of electrode counts and recording channels |
| **Administrative Lead** | Reviews categorization anomalies in cohort logs | Periodic spot-checking of automated aggregations |

---

## 📥 Inputs & Outputs Specification

### System Inputs
- **Unstructured Text**: Free-form surgical descriptions (e.g., *"Artrodese circunferencial C5-C6 com cage PEEK e placa anterior..."*).
- **Computer Vision / OCR Inputs**: Photographs of implant boxes, surgical stickers, and institutional operative boards.

### System Outputs
- **Structured Fields**:
  - `categoria`: Anatomical group (`Coluna`, `Crânio`, `Nervo Periférico`).
  - `subtipo`: Procedural classification (e.g., `Artrodese Cervical Anterior`).
  - `niveis_operados`: Anatomical levels operated (e.g., `C5-C6`).
  - `estimated_screws`: Projected pedicle/lateral mass screw count.

---

## ⚠️ Failure Modes & Clinical Consequences Analysis

| Failure Mode | Mechanism | Potential Clinical Consequence | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Anatomical Misclassification** | Ambiguous acronyms in surgical text | Inaccurate volume statistics in longitudinal portfolio | Mandatory clinician review modal with diff highlighting |
| **Hallucination of Operated Levels** | Complex multi-segment descriptions | Distortion of surgical complexity metrics | Deterministic rule engine overrides LLM output for anatomical counts |
| **OCR Misreading on Labels** | Poor lighting or reflective sticker packaging | Wrong implant serial or batch recorded in dossier | Original photograph remains permanently attached to the record for audit |

---

## 🩺 Human-in-the-Loop (HITL) Architecture

No algorithmic prediction or LLM generation is committed directly to the persistent Firestore database. Every AI suggestion passes through a staging state:

```
[Raw Input / Scan]
       │
       ▼
[Gemini 2.5 Flash] ───► [Staging Review Interface]
                                 │
                                 ├── Clinician approves ───► [Persistent Database]
                                 │
                                 └── Clinician corrects ───► [Saved + Logged Correction]
```

---

## 📊 Evaluation & Monitoring Strategy

1. **Continuous Discrepancy Logging**: System monitors frequency of manual edits made to AI-suggested fields to measure precision drift.
2. **Deterministic Fallback**: Whenever prompt confidence is ambiguous, deterministic regex classifiers (`classifySurgeryProcedure`) take precedence.
3. **Data Privacy in Prompts**: Zero identifiable patient demographic data (names, social identifiers) is passed to external LLM endpoints during procedural categorization.
