<div align="center">

**Idioma:** [Português do Brasil](README.pt-BR.md) · [English](README.md)

# NeuroGestor

**Gestão do fluxo clínico e do portfólio cirúrgico em monitorização neurofisiológica intraoperatória.**

[Demonstração com dados sintéticos](https://neurogestor-app.web.app/#/demo) · [Arquitetura](docs/architecture.md) · [Segurança](docs/security.md) · [Governança de IA](docs/ai-governance.md)

</div>

## O problema

A atuação em MNIO em diferentes hospitais gera informações fragmentadas entre papel, planilhas, fotografias, etiquetas de materiais, faturamento e dados das equipes cirúrgicas. Isso dificulta a recuperação de casos, a análise longitudinal, a auditoria e a proteção da privacidade.

O NeuroGestor transforma esse fluxo em registros estruturados e pesquisáveis, mantendo a IA em papel assistivo. É um produto administrativo e documental; não realiza diagnóstico nem funciona como dispositivo médico autônomo.

## O que está implementado

- Registro estruturado de procedimentos de crânio, coluna e nervo periférico;
- fluxo operacional de agendado a realizado e faturado, com histórico de cancelamento;
- painéis de volume, duração, faturamento estimado e parceiros cirúrgicos;
- OCR de etiquetas assistido por Gemini, com revisão manual quando a extração falha;
- geração de rascunhos editáveis de laudos de MNIO, sempre validados pelo médico;
- portfólio e exportações em PDF, PowerPoint e planilhas;
- campos para TUSS, CID-10 e autorização do convênio;
- integração com Google Calendar e notificações pelo Firebase Cloud Messaging;
- dados sintéticos para avaliação segura na demonstração pública.

## IA e governança clínica

As sugestões da IA podem ser revisadas antes de entrar no registro. O produto também possui regras de acesso por perfil, Escudo de Privacidade para mascarar dados de pacientes e valores na tela, controles de segurança documentados e scripts de auditoria e reconciliação.

Nomes de pacientes não são necessários para a classificação semântica. A saída da IA pode ser incompleta ou incorreta e deve ser validada por um profissional qualificado.

## Arquitetura

- **Frontend:** React 19, TypeScript 5.8, Vite 6 e Recharts;
- **Nuvem:** Firebase Authentication, Firestore, Storage e Cloud Messaging;
- **IA:** Google Gemini para OCR, extração estruturada e rascunho de laudos;
- **Documentos:** jsPDF, PptxGenJS, SheetJS e html2canvas;
- **Qualidade:** testes TypeScript, testes das regras do Firebase e validação do build de produção.

## Executar localmente

```bash
npm install
npm run dev
```

Configure localmente as variáveis exigidas pelos serviços externos. Não versione credenciais.

## Verificação

```bash
node --no-warnings --experimental-transform-types --test tests/*.test.ts
npm run build
```

## Limitações atuais

- a precisão da IA depende da qualidade das imagens e da completude dos dados;
- informações clínicas e administrativas exigem revisão humana;
- o produto atual atende principalmente profissionais individuais e pequenas equipes, não uma implantação hospitalar ampla;
- a demonstração usa dados sintéticos e não representa validação clínica.

## Autor

**Rafael Leão, médico:** atuação em monitorização neurofisiológica intraoperatória e desenvolvimento de software para saúde.
[GitHub](https://github.com/rafaelleaomed) · [LinkedIn](https://www.linkedin.com/in/rafaelleaomed/)
