import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "neurogestor-app.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "neurogestor-app",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "neurogestor-app.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "744896910428",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:744896910428:web:6cbb0c665701d3acc1c299"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const firebaseStorage = getStorage(app);

let messagingInstance: ReturnType<typeof getMessaging> | null = null;
isSupported().then((supported) => {
    if (supported) {
        messagingInstance = getMessaging(app);
    }
});

export const messaging = messagingInstance;
export default app;
