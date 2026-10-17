import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import app from './firebase';

export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = async (rememberMe: boolean): Promise<FirebaseUser> => {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
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
