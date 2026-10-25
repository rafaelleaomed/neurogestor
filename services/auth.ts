import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import app from './firebase.ts';
import {
  getRedirectPersistencePreference,
  shouldFallbackToRedirect,
  shouldUseRedirectLogin
} from './authStrategy.ts';

export const auth = getAuth(app);

const REDIRECT_PERSISTENCE_KEY = 'neurogestor_auth_persistence';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const beginRedirectLogin = async (rememberMe: boolean): Promise<void> => {
  window.sessionStorage.setItem(REDIRECT_PERSISTENCE_KEY, rememberMe ? 'local' : 'session');
  await signInWithRedirect(auth, googleProvider);
};

export const completeGoogleRedirect = async (): Promise<FirebaseUser | null> => {
  const preference = getRedirectPersistencePreference(
    window.sessionStorage.getItem(REDIRECT_PERSISTENCE_KEY)
  );

  try {
    if (preference !== null) {
      await setPersistence(auth, preference ? browserLocalPersistence : browserSessionPersistence);
    }
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } finally {
    window.sessionStorage.removeItem(REDIRECT_PERSISTENCE_KEY);
  }
};

export const signInWithGoogle = async (rememberMe: boolean): Promise<FirebaseUser | void> => {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

  if (shouldUseRedirectLogin(window.navigator.userAgent, window.navigator.maxTouchPoints)) {
    await beginRedirectLogin(rememberMe);
    return;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (shouldFallbackToRedirect(code)) {
      await beginRedirectLogin(rememberMe);
      return;
    }
    throw error;
  }
};

export const observeAuth = (callback: (user: FirebaseUser | null) => void) =>
  onAuthStateChanged(auth, callback);

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const getAuthErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação foi fechada antes da conclusão.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de autenticação. Permita pop-ups para continuar.';
    case 'auth/unauthorized-domain':
      return 'Este endereço ainda não está autorizado para autenticação no Firebase.';
    case 'auth/network-request-failed':
      return 'Não foi possível concluir o login. Verifique a conexão e tente novamente.';
    default:
      return 'Não foi possível concluir o login. Tente novamente ou contate o suporte.';
  }
};
