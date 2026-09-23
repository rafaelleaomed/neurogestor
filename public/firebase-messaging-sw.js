importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const apiKey = params.get('apiKey');

if (apiKey) {
    const firebaseConfig = {
        apiKey: apiKey,
        authDomain: params.get('authDomain') || "neurogestor-app.firebaseapp.com",
        projectId: params.get('projectId') || "neurogestor-app",
        storageBucket: params.get('storageBucket') || "neurogestor-app.firebasestorage.app",
        messagingSenderId: params.get('messagingSenderId') || "744896910428",
        appId: params.get('appId') || "1:744896910428:web:6cbb0c665701d3acc1c299"
    };

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Recebeu mensagem em background ', payload);
        const notificationTitle = payload.notification?.title || 'NeuroGestor';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/logo.png'
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}
