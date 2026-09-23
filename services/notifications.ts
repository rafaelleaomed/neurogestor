import { getToken } from 'firebase/messaging';
import { messaging } from './firebase';

export const VAPID_KEY = 'BNovIc8ANR7vVVc1mn1XSTLQIVS4eCct33bWICs5uaqXcirGpltBJr4MLD8BXJxAOqvE5C0wNKvQExlFoBdHMNY';

export const requestFirebaseNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            if (!messaging) {
                console.error('Firebase Messaging não suportado neste navegador.');
                return null;
            }
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                console.log('FCM Token recebido:', token);
                return token;
            } else {
                console.log('Nenhum token FCM recebido. Solicite permissão para gerar um.');
                return null;
            }
        } else {
            console.log('Permissão para notificações bloqueada ou recusada.');
            return null;
        }
    } catch (err) {
        console.error('Erro ao pedir permissão para notificações:', err);
        return null;
    }
};
