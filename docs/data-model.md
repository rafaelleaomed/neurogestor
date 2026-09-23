# 📊 Data Model & Schema Specification

The **Neurogestor** persistence layer utilizes Google Cloud Firestore as its primary document database. Schemas are strongly typed via TypeScript interfaces.

---

## 🗂️ Core Entities

### 1. `Surgery` (`surgeries/{id}`)
Represents an individual surgical or intraoperative neurophysiological monitoring procedure.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (UUIDv4) |
| `data` | `string` | Procedure date (`YYYY-MM-DD`) |
| `paciente` | `string` | Patient name (stored canonically in secure DB; masked via Privacy Shield) |
| `procedimento` | `string` | Full procedure name as entered or extracted |
| `categoria` | `enum` | Anatomical category: `'Crânio'`, `'Coluna'`, `'Nervo Periférico'` |
| `subtipo` | `string?` | Granular classification (e.g., `'Artrodese Cervical Anterior'`, `'DBS'`) |
| `niveis_operados` | `string?` | Operated spine levels (e.g., `'L4-S1'`, `'T10-L2'`) |
| `estimated_screws`| `number?` | Automated heuristic count of fixation screws |
| `medico` | `string` | Lead operating surgeon |
| `hospital` | `string` | Healthcare institution where surgery occurred |
| `hora_inicio` | `string?` | Surgery start time (`HH:mm`) |
| `hora_fim` | `string?` | Surgery end time (`HH:mm`) |
| `valor_estimado` | `number` | Contractual estimated revenue for the procedure |
| `status` | `enum` | `'Agendado'`, `'Realizado'`, `'Faturado'` |
| `complexity_level`| `enum?` | `'routine'`, `'challenging'`, `'complex'`, `'landmark'` |
| `is_portfolio` | `boolean?` | Flag indicating inclusion in surgical portfolio case series |
| `label_images` | `string[]?`| URLs to storage photos of surgical labels/implants |
| `clinical_images` | `string[]?`| URLs to de-identified intraoperative/radiological photos |

---

### 2. `User` (`users/{id}`)
Represents an authorized healthcare professional or administrative team member.

| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | `string` | Primary authenticated email address |
| `name` | `string` | Professional's display name |
| `status` | `enum` | `'PENDING'`, `'APPROVED'`, `'DENIED'` |
| `role` | `enum` | `'owner'`, `'admin'`, `'user'`, `'assistant'` |
| `fcmToken` | `string?` | Device token for push notifications |

---

### 3. Anatomical & Procedural Taxonomies

#### Coluna (Spine)
- `Artrodese Lombar / TLIF / ALIF / XLIF`
- `Artrodese Cervical Anterior / Posterior`
- `Descompressão / Laminectomia / Microdiscectomia`
- `Correção de Deformidade / Escoliose`

#### Crânio (Cranial)
- `Tumor Encefálico / Base de Crânio`
- `Cirurgia de Nervos Cranianos (Facial, Trigêmeo, Schwannoma)`
- `Estimulação Cerebral Profunda (DBS)`
- `Monitorização de Epilepsia`

#### Nervo Periférico (Peripheral Nerve)
- `Cirurgias de Plexo Braquial`
- `Neurolise e Reparo Microcirúrgico`
