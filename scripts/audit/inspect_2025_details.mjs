import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAbRW1AhJABBcC9bMtD7wKZLHgDFZZ7JVo",
    authDomain: "neurogestor-app.firebaseapp.com",
    projectId: "neurogestor-app",
    storageBucket: "neurogestor-app.firebasestorage.app",
    messagingSenderId: "744896910428",
    appId: "1:744896910428:web:6cbb0c665701d3acc1c299"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect2025() {
    console.log("=== COMPARANDO 2025 EM FIRESTORE ===");
    const snap = await getDocs(collection(db, 'surgeries'));

    const rafael2025 = [];
    const legacy2025 = [];
    const other2025 = [];

    snap.forEach(d => {
        const data = d.data();
        const id = d.id;
        const owner = data.owner_email || 'SEM_OWNER';
        const date = (data.data || '').trim();

        if (date.startsWith('2025')) {
            const item = {
                id,
                owner,
                data: date,
                paciente: data.paciente || '',
                procedimento: data.procedimento || '',
                medico: data.medico || '',
                hospital: data.hospital || '',
                valor: data.valor_estimado || 0
            };
            if (owner === 'rafaelleaobh@gmail.com') {
                rafael2025.push(item);
            } else if (owner === 'legacy') {
                legacy2025.push(item);
            } else {
                other2025.push(item);
            }
        }
    });

    console.log(`Total 2025 em rafaelleaobh@gmail.com: ${rafael2025.length}`);
    console.log(`Total 2025 em legacy: ${legacy2025.length}`);
    console.log(`Total 2025 em outros: ${other2025.length}`);

    // Demos em legacy
    const legacyDemos = legacy2025.filter(s => s.paciente.toUpperCase().includes('DEMO'));
    const legacyNonDemos = legacy2025.filter(s => !s.paciente.toUpperCase().includes('DEMO'));
    console.log(`Legacy 2025 Demos: ${legacyDemos.length}`);
    console.log(`Legacy 2025 Reais/Não-Demos: ${legacyNonDemos.length}`);

    // Demos em rafael
    const rafaelDemos = rafael2025.filter(s => s.paciente.toUpperCase().includes('DEMO'));
    console.log(`Rafael 2025 Demos: ${rafaelDemos.length}`);

    // Ver exemplo de não-demos em legacy vs rafael
    console.log('\nExemplo de Não-Demos em Legacy (primeiras 5):');
    console.log(legacyNonDemos.slice(0, 5));

    console.log('\nExemplo de Cirurgias em Rafael (primeiras 5):');
    console.log(rafael2025.slice(0, 5));

    process.exit(0);
}

inspect2025().catch(e => {
    console.error(e);
    process.exit(1);
});
