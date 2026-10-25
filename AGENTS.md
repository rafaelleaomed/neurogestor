# NeuroGestor — contexto para agentes

## Produto e arquitetura
- Plataforma clínica para gestão de cirurgias e MNIO, com React 19, TypeScript, Vite e Firebase.
- Interface em `App.tsx`, `pages/` e `components/`; integrações e regras de domínio em `services/`.
- Funções de backend ficam em `functions/`; regras e testes do Firebase ficam em `firebase/`.
- Consulte `docs/` somente quando a tarefa exigir arquitetura, dados, segurança ou governança de IA.

## Validação
- Alterações comuns: `npm run build`.
- Mudanças em Firestore ou Storage: `npm run test:rules`.
- Testes direcionados existentes podem ser executados com o runner nativo do Node.

## Regras críticas
- Preserve isolamento por usuário/equipe e nunca exponha dados clínicos ou credenciais.
- IA é assistiva: nenhuma informação clínica deve ser gravada sem revisão humana.
- Não publique nem faça deploy sem aprovação explícita.
- Leia apenas os arquivos relevantes; não percorra `node_modules`, artefatos de build ou caches.
