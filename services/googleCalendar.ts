
import { getGoogleClientId } from './storage';

declare const google: any;

let tokenClient: any;
let accessToken: string | null = null;

export const initGoogleAuth = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      resolve(); 
      return;
    }

    if (typeof google === 'undefined' || !google.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setupTokenClient(clientId, resolve, reject);
      };
      script.onerror = () => reject(new Error("Falha ao carregar script do Google."));
      document.head.appendChild(script);
    } else {
      setupTokenClient(clientId, resolve, reject);
    }
  });
};

const setupTokenClient = (clientId: string, resolve: any, reject: any) => {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: (response: any) => {
        if (response.error !== undefined) {
          reject(response);
          return;
        }
        accessToken = response.access_token;
      },
    });
    resolve();
  } catch (err) {
    reject(err);
  }
};

export const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      reject(new Error("Google Client ID não configurado."));
      return;
    }

    if (!tokenClient) {
      initGoogleAuth().then(() => {
        if (!tokenClient) reject(new Error("Google Auth não inicializado."));
        else requestToken(resolve, reject);
      }).catch(reject);
      return;
    }

    requestToken(resolve, reject);
  });
};

const requestToken = (resolve: any, reject: any) => {
  tokenClient.callback = (response: any) => {
    if (response.error !== undefined) {
      reject(response);
      return;
    }
    accessToken = response.access_token;
    resolve(response.access_token);
  };
  // Tenta obter o token sem forçar consentimento se já tivermos um
  tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'select_account' });
};

export const fetchCalendarEvents = async (year: string, month: string): Promise<any[]> => {
  try {
    const token = await getAccessToken();
    const timeMin = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
    const timeMax = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Erro API Calendar.");
    }

    const data = await response.json();
    return data.items || [];
  } catch (err: any) {
    console.error("[Google Calendar] Fetch Error:", err);
    throw err;
  }
};
