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

async function inspect() {
    console.log("=== INICIANDO INSPEÇÃO DETALHADA DO FIRESTORE ===");
    const snap = await getDocs(collection(db, 'surgeries'));
    console.log(`Total de documentos lidos: ${snap.size}`);

    let demoCount = 0;
    const demoOwners = {};
    const ownerCounts = {};
    const rafaelYears = {};
    const legacyYears = {};
    const allYears = {};

    snap.forEach(d => {
        const data = d.data();
        const owner = data.owner_email || 'SEM_OWNER';
        const year = (data.data || '').substring(0, 4) || 'SEM_ANO';
        const isDemo = (data.paciente || '').toUpperCase().includes('DEMO');

        ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
        allYears[year] = (allYears[year] || 0) + 1;

        if (isDemo) {
            demoCount++;
            demoOwners[owner] = (demoOwners[owner] || 0) + 1;
        }

        if (owner === 'rafaelleaobh@gmail.com') {
            rafaelYears[year] = (rafaelYears[year] || 0) + 1;
        }
        if (owner === 'legacy') {
            legacyYears[year] = (legacyYears[year] || 0) + 1;
        }
    });

    console.log('\n--- TOTAIS POR OWNER ---');
    console.log(JSON.stringify(ownerCounts, null, 2));

    console.log(`\n--- PACIENTES DEMO NO BANCO (Total: ${demoCount}) ---`);
    console.log(JSON.stringify(demoOwners, null, 2));

    console.log('\n--- CIRURGIAS DE rafaelleaobh@gmail.com POR ANO ---');
    console.log(JSON.stringify(rafaelYears, null, 2));

    console.log('\n--- CIRURGIAS LEGACY POR ANO ---');
    console.log(JSON.stringify(legacyYears, null, 2));

    console.log('\n--- TOTAIS GERAIS POR ANO ---');
    console.log(JSON.stringify(allYears, null, 2));

    process.exit(0);
}

inspect().catch(err => {
    console.error("Erro na inspeção:", err);
    process.exit(1);
});
