<div align="center">

**🌐 Idioma / Language:** [🇧🇷 Português do Brasil](README.pt-BR.md) • [🇺🇸 English](README.md)

</div>

# 🧠 Neurogestor

> Plataforma de gestão de fluxo cirúrgico, portfólio clínico e governança médica desenvolvida como estudo de caso de produto digital em saúde.  
> Explorando como dados clínicos estruturados, automação de processos e extração assistida por Inteligência Artificial podem transformar a organização, governança e análise longitudinal da atividade cirúrgica.

<div align="center">

[![Demonstração Online - Acesso Livre](https://img.shields.io/badge/Demonstração%20Online-Acesso%20Livre%20(Sem%20Cadastro)-emerald?style=for-the-badge&logo=firebase)](https://neurogestor-app.web.app/#/demo)

[![Licença: MIT](https://img.shields.io/badge/Licença-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Storage-orange?logo=firebase)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-blueviolet?logo=google)
![Conformidade](https://img.shields.io/badge/Conformidade-LGPD%20%7C%20CFM%202.336%2F2023-emerald)

</div>

> 🚀 **Experimente Sem Cadastro**: Qualquer visitante do projeto pode testar e navegar imediatamente pelo sistema completo com dados de exemplo (casos cirúrgicos, métricas financeiras, gráficos, seletor de meses anteriores, laudos de IA e exportação de relatórios) clicando em **[Demonstração Online](https://neurogestor-app.web.app/#/demo)** ou escolhendo o botão "Acessar Modo Demonstração (Sem Cadastro)" na tela de login.

---

## 👨‍⚕️ Por Que Criei Este Projeto

Durante minha prática médica em **Monitorização Neurofisiológica Intraoperatória (MNIO)** e atuação em equipes cirúrgicas, vivenciei na pele a sobrecarga e a ineficiência causadas pela fragmentação de dados clínicos espalhados por múltiplos hospitais, blocos cirúrgicos, prontuários de papel e diferentes sistemas eletrônicos (PEP).

O desafio central era evidente:
> *Como transformar informações cirúrgicas fragmentadas e não estruturadas em dados clínicos padronizados, pesquisáveis e acionáveis a longo prazo, sem sobrecarregar o médico com burocracia administrativa após horas de cirurgia?*

O **Neurogestor** nasceu como uma ferramenta pragmática para resolver esse gargalo operacional e evoluiu para uma plataforma de saúde digital orientada por **IA Human-in-the-Loop**, **Privacidade por Design (Privacy-by-Design)** e **Governança Clínica**.

---

## 🩺 O Problema Clínico

A rotina cirúrgica e a monitorização intraoperatória geram um grande volume de informações críticas que costumam ficar dispersas em silos desconectados:
- Registros de tempo operatório (incisão, início da monitorização, fechamento);
- Equipes cirúrgicas (cirurgião principal, auxiliares, anestesiologista, instrumentador);
- Variabilidade institucional (diferentes rotinas de faturamento e regras entre redes hospitalares);
- Complexidade anatômica e implantes (níveis instrumentados, parafusos pediculares, eletrodos utilizados);
- Fotografias intraoperatórias e etiquetas de rastreabilidade de materiais (OPME).

Quando essas informações permanecem desestruturadas:
1. **Análises longitudinais** (estratificação de volume, acompanhamento de complicações, consumo de materiais) tornam-se quase impossíveis ou exigem planilhas manuais propensas a erros;
2. **Criação de portfólio clínico** para fins acadêmicos, auditorias hospitalares ou titulação consome horas de busca retrospectiva;
3. **Riscos de vazamento de dados (LGPD)** aumentam quando anotações e fotos clínicas ficam armazenadas em dispositivos pessoais sem controle de acesso estrito.

---

## 💡 Hipótese de Produto

> Se os dados de procedimentos cirúrgicos e monitorizações forem estruturados e validados no momento do registro — acelerados por visão computacional assistiva e modelos de linguagem (LLM) — os médicos conseguem eliminar o retrabalho administrativo, garantir total sigilo dos dados do paciente e obter métricas clínicas e operacionais em tempo real sobre sua atuação.

---

## 🤖 Camada de IA & Supervisão Humana (Human-in-the-Loop)

Em vez de posicionar a Inteligência Artificial como um tomador de decisão autônomo, o Neurogestor adota a IA como uma **camada assistiva de produtividade**:

### Capacidades Assistivas
- **OCR e Ingestão Resiliente de Etiquetas em Lote**: Reconhecimento óptico de caracteres para etiquetas de implantes cirúrgicos e folhas de registro. Conta com compressão adaptativa no navegador (reduzindo em até 75% o uso de memória em celulares), controle de taxa de requisições, fallback inteligente entre modelos (`Gemini 2.5 Flash` -> `Gemini 2.0 Flash`), garantia de retenção (nenhuma etiqueta é descartada se houver falha de rede/cota) e painel interativo de conferência com zoom em alta resolução (lightbox);
- **Desduplicação Inteligente por Usuário**: Detecção inteligente de cirurgias duplicadas isolada por médico (`owner_email`), permitindo que membros de uma mesma equipe registrem procedimentos compartilhados sem falsos alertas de conflito;
- **Extração Semântica de Texto Não Estruturado**: Identificação automática de níveis anatômicos, via de acesso e técnica cirúrgica a partir de descrições sumárias;
- **Sugestão de Taxonomia Procedural**: Classificação canônica automática (ex.: *Coluna: Artrodese Cervical Anterior (ACDF)* vs. *Artrodese Lombar TLIF*);
- **Minutas e Laudos Estruturados de MNIO**: Rascunho automatizado de minutas técnicas e laudos adaptados para neurocirurgia e ortopedia, com obrigatoriedade de revisão médica e edição imediata;
- **Síntese de Portfólio Multimodal**: Consolidação de marcos cirúrgicos, fotografias intraoperatórias, gráficos de monitorização e etiquetas de materiais em dossiês para exportação em PDF e apresentações PowerPoint (PPTX);
- **Análise Retrospectiva de Períodos**: Seletor interativo de mês e ano no painel principal, permitindo análise instantânea de volume histórico, faturamento estimado, tempo médio de cirurgia e ranking de cirurgiões parceiros, com botão de retorno rápido ao mês corrente;
- **Interoperabilidade TISS / TUSS e CID-10**: Captura estruturada de códigos da Saúde Suplementar (ANS TUSS ex.: `4.01.03.54-5`, `4.01.03.55-3`, `4.01.03.61-8`), diagnósticos CID-10 e senhas de autorização de convênio, integrados às planilhas e relatórios de auditoria.

### Princípios de IA Clínica
- **Sem Gravações Autônomas**: As sugestões da IA são apresentadas em estado transitório de validação. O médico precisa revisar e confirmar explicitamente qualquer dado antes de salvar no prontuário.
- **Zero Exposição de Dados Pessoais (Zero PII)**: Nomes de pacientes e dados de identificação pessoal nunca são enviados aos endpoints externos do LLM para classificação semântica.
- **Salvaguardas Determinísticas**: Motores de regras heurísticas têm precedência sobre saídas generativas na contagem de níveis anatômicos e cálculos operacionais.
- **Ingestão Clínica Tolerante a Falhas**: Picos de rede ou limite de requisições durante processamentos em lote nunca descartam a foto da etiqueta, preservando a imagem original para conferência médica imediata.

---

## 👥 Gestão de Equipes & Modelos Flexíveis de Remuneração

O Neurogestor possui um mecanismo adaptável de configuração financeira e gerenciamento de equipes:
- **Modelos Flexíveis de Remuneração**: Suporta tanto neurofisiologistas autônomos quanto membros de equipe clínica com fluxos customizados:
  - *Valor fixo por cirurgia*;
  - *Tabela personalizada por convênio / particular*;
  - *Confirmação manual caso a caso*;
  - *Regras de rateio e comissão de equipe*.
- **Controle de Acesso Baseado em Perfis (RBAC)**:
  - **Administrador Master (`medleaobh@gmail.com`)**: Visão global da plataforma, aprovação de novos cadastros, definição de funções e indicadores corporativos consolidados.
  - **Administração de Equipe**: Agrupamento seguro (ex.: *Equipe Camarinha*) que concede acesso compartilhado a recursos clínicos sensíveis, como senhas de portais hospitalares e acessos remotos a servidores.
  - **Espaço Pessoal do Médico**: Cada profissional possui uma visão limpa e focada exclusivamente em suas cirurgias, tempo operatório e faturamento pessoal.

---

## 🛡️ Escudo de Privacidade & Conformidade Regulatória

O Neurogestor foi projetado em estrita conformidade com a **Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)** e as diretrizes do **Conselho Federal de Medicina (Resolução CFM nº 2.336/2023)**:

### 1. Escudo de Privacidade Dinâmico (Privacy Shield)
Para conciliar a rotina clínica diária (onde o médico precisa localizar pacientes pelo nome) com demonstrações profissionais e científicas:
- Um botão de **Escudo de Privacidade** anonimiza instantaneamente todos os nomes de pacientes na tela, convertendo-os em iniciais padronizadas (ex.: `L. B. N. S. (Anonimizado)`) e ocultando valores financeiros (`••••••`).
- Isso viabiliza discussões de casos clínicos, reuniões acadêmicas e compartilhamento de tela sem expor Dados Pessoais de Saúde (PHI).

### 2. Alinhamento Regulatório e Segurança
- **Art. 11, II, "a" (LGPD)**: Tratamento de dados sensíveis de saúde estritamente justificado para tutela da saúde e assistência médica.
- **Resolução CFM nº 2.336/2023**: A exibição de casos do portfólio destina-se exclusivamente a fins científicos, educacionais e de auditoria profissional, vedando sensacionalismo comercial ou promessas de resultados clínicos.
- **Canal com o DPO / Encarregado**: Contato direto para transparência e solicitações de titulares de dados (`medleaobh@gmail.com`).
- **Princípio do Menor Privilégio no Backend**: Regras estritas de segurança no Cloud Firestore e Firebase Storage, exigindo autenticação e verificação de perfil para qualquer leitura ou escrita.
- **Zero Credenciais Fixas no Código**: Eliminação total de senhas ou chaves estáticas no bundle do aplicativo; acessos a portais hospitalares são criptografados e acessíveis apenas por membros autorizados da respectiva equipe.

---

## ⚠️ Limitações Atuais

Para assegurar transparência científica e expectativas clínicas realistas:
- **Escopo Assistivo**: O sistema é uma ferramenta administrativa e de registro cirúrgico; **não** se classifica como *Software as a Medical Device (SaMD)* para navegação cirúrgica em tempo real ou diagnóstico automatizado.
- **Revisão Humana Mandatória**: A acurácia da extração por IA depende da nitidez da imagem e da legibilidade das etiquetas; a validação pelo médico é indispensável do ponto de vista legal e assistencial.
- **Fase de Escalonamento**: O protótipo atual foi otimizado para equipes cirúrgicas de pequeno a médio porte; a segregação multi-inquilino (multi-tenant) enterprise está em expansão contínua.

---

## 🗺️ Documentação de Engenharia & Arquitetura

Especificações detalhadas de arquitetura e governança estão documentadas na pasta `/docs`:

| Documento | Descrição |
| :--- | :--- |
| [**Especificação de Arquitetura**](docs/architecture.md) | Arquitetura de componentes, fluxo de dados e detalhes da stack |
| [**Segurança & Conformidade**](docs/security.md) | Proteção de dados na LGPD, criptografia e pilares éticos do CFM |
| [**Governança de IA Clínica**](docs/ai-governance.md) | Uso pretendido, personas clínicas, análise de modos de falha e protocolos HITL |
| [**Modelo de Dados**](docs/data-model.md) | Esquemas de documentos no Firestore, taxonomias e relações entre entidades |
| [**Roadmap do Projeto**](docs/roadmap.md) | Acompanhamento de entregas nas trilhas de Produto, IA e Governança |

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (com suporte a Modo Escuro)
- **Gráficos & Analytics**: Recharts
- **Persistência & Nuvem**: Google Cloud Platform / Firebase (Cloud Firestore, Cloud Storage, FCM)
- **IA & Visão Computacional**: Google Gemini 2.5 Flash via SDK oficial `@google/genai`
- **Geração de Documentos**: `jspdf`, `xlsx`, `pptxgenjs`, `html2canvas`

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18+)
- `npm` ou `yarn`

### Instruções de Instalação

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/rafaelleaomed/neurogestor.git
   cd neurogestor
   ```

2. **Instalar dependências:**
   ```bash
   npm install
   ```

3. **Configurar variáveis de ambiente:**
   Crie o arquivo `.env.local` na raiz do projeto:
   ```env
   GEMINI_API_KEY=sua_chave_gemini_aqui
   ```

4. **Iniciar o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

---

## 👨‍💻 Autor

**Rafael Leão, MD**  
*Médico explorando Inteligência Artificial na saúde, produtos digitais clínicos e governança de IA em medicina.*  
- **GitHub**: [@rafaelleaomed](https://github.com/rafaelleaomed)  
- **LinkedIn**: [rafaelleaomed](https://linkedin.com/in/rafaelleaomed)
