import type { User } from '../types.ts';

interface AuthenticatedIdentity {
  uid: string;
  email: string | null;
}

/**
 * Combina um perfil persistido com a identidade Firebase atual sem alterar o banco.
 * Perfis legados sem auth_uid recebem o UID apenas na sessão; vínculos divergentes são bloqueados.
 */
export const buildAuthenticatedSessionUser = (
  profile: User,
  identity: AuthenticatedIdentity
): User => {
  const email = (identity.email || profile.email || '').toLowerCase().trim();
  if (!email) throw new Error('A identidade autenticada não possui e-mail válido.');

  if (profile.auth_uid && profile.auth_uid !== identity.uid) {
    throw new Error('A identidade autenticada não corresponde ao perfil existente.');
  }

  return {
    ...profile,
    email,
    auth_uid: profile.auth_uid || identity.uid
  };
};
