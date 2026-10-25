import type { User } from '../types.ts';

type SessionStartupDependencies = {
  setSession: (user: User) => void;
  initStorage: () => Promise<void>;
  setUser: (user: User) => void;
  isCurrent: () => boolean;
};

/**
 * Registra a sessão para que o storage aplique o isolamento por usuário,
 * aguarda a carga inicial e só então libera a Dashboard. Chamadas de
 * autenticação obsoletas nunca podem substituir o usuário ativo.
 */
export const initializeAuthenticatedSession = async (
  user: User,
  dependencies: SessionStartupDependencies
): Promise<void> => {
  dependencies.setSession(user);
  await dependencies.initStorage();
  if (dependencies.isCurrent()) dependencies.setUser(user);
};
