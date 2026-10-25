const MOBILE_BROWSER_PATTERN = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i;

export const shouldUseRedirectLogin = (userAgent: string, maxTouchPoints = 0): boolean => {
  const isIpadDesktopMode = /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  return MOBILE_BROWSER_PATTERN.test(userAgent) || isIpadDesktopMode;
};

export const getRedirectPersistencePreference = (storedValue: string | null): boolean | null => {
  if (storedValue === 'local') return true;
  if (storedValue === 'session') return false;
  return null;
};

export const shouldFallbackToRedirect = (errorCode: string): boolean =>
  errorCode === 'auth/popup-blocked' ||
  errorCode === 'auth/operation-not-supported-in-this-environment';
