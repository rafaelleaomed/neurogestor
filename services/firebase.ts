import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyAbRW1AhJABBcC9bMtD7wKZLHgDFZZ7JVo",
    authDomain: "neurogestor-app.firebaseapp.com",
    projectId: "neurogestor-app",
    storageBucket: "neurogestor-app.firebasestorage.app",
    messagingSenderId: "744896910428",
    appId: "1:744896910428:web:6cbb0c665701d3acc1c299"
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
