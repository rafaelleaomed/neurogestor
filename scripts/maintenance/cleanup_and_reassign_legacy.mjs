import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

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

function clean(s) {
    if (!s) return '';
    return String(s)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ');
}

async function execute() {
    console.log("=== INICIANDO SANEAMENTO E RECONCILIAÇÃO DO BANCO FIRESTORE ===");
    const snap = await getDocs(collection(db, 'surgeries'));
    console.log(`Lidos ${snap.size} documentos do Firestore.`);

    const toDelete = [];
    const toReassignRafael = []; // Marilene 2026-10-06
    const toReassignMedLeao = []; // 1 cópia dos 295 pacientes demo

    const demoSeen = new Set();

    snap.forEach(d => {
        const data = d.data();
        const id = d.id;
        const owner = data.owner_email || 'SEM_OWNER';
        const paciente = data.paciente || '';
        const isDemo = paciente.toUpperCase().includes('DEMO');

        if (id === 'b0cadc94-fb53-4ef0-95d0-f6a294fd4f64') {
            // Marilene Ferreira Gomes (cirurgia real de 2026-10-06) -> Atribuir a Rafael
            toReassignRafael.push({ id, ...data });
            return;
        }

        if (owner === 'legacy') {
            if (isDemo) {
                // Preservar exatamente 1 cópia dos 295 demos para medleaobh@gmail.com
                const key = `${data.data}|${clean(paciente)}`;
                if (!demoSeen.has(key)) {
                    demoSeen.add(key);
                    toReassignMedLeao.push({ id, ...data });
                } else {
                    // Duplicatas adicionais de demo -> Deletar
                    toDelete.push(id);
                }
            } else {
                // Cirurgias não-demo em legacy são duplicatas exatas já presentes em rafaelleaobh -> Deletar
                toDelete.push(id);
            }
        }
    });

    console.log(`\nPlanejamento de execução:`);
    console.log(`- Cirurgia real recente a reatribuir para rafaelleaobh@gmail.com: ${toReassignRafael.length}`);
    console.log(`- Cirurgias demo a reatribuir para medleaobh@gmail.com: ${toReassignMedLeao.length}`);
    console.log(`- Documentos duplicados/excedentes a DELETAR: ${toDelete.length}`);

    // Executar reatribuições e deleções em lotes (batch max 450)
    const batchSize = 400;

    // 1. Reatribuir Marilene para Rafael
    if (toReassignRafael.length > 0) {
        const batch = writeBatch(db);
        toReassignRafael.forEach(item => {
            const ref = doc(db, 'surgeries', item.id);
            batch.update(ref, { owner_email: 'rafaelleaobh@gmail.com' });
        });
        await batch.commit();
        console.log(`✅ Cirurgia de Marilene reatribuída com sucesso para rafaelleaobh@gmail.com`);
    }

    // 2. Reatribuir 295 demos para medleaobh@gmail.com
    for (let i = 0; i < toReassignMedLeao.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = toReassignMedLeao.slice(i, i + batchSize);
        chunk.forEach(item => {
            const ref = doc(db, 'surgeries', item.id);
            batch.update(ref, { owner_email: 'medleaobh@gmail.com' });
        });
        await batch.commit();
        console.log(`✅ Reatribuídos ${Math.min(i + batchSize, toReassignMedLeao.length)} de ${toReassignMedLeao.length} demos para medleaobh@gmail.com`);
    }

    // 3. Deletar duplicatas restantes
    for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = toDelete.slice(i, i + batchSize);
        chunk.forEach(id => {
            batch.delete(doc(db, 'surgeries', id));
        });
        await batch.commit();
        console.log(`🗑️ Deletados ${Math.min(i + batchSize, toDelete.length)} de ${toDelete.length} duplicatas do Firestore...`);
    }

    console.log("\n=======================================================");
    console.log("   VERIFICAÇÃO PÓS-SANEAMENTO DO BANCO DE DADOS       ");
    console.log("=======================================================");
    const verifySnap = await getDocs(collection(db, 'surgeries'));
    const finalCounts = {};
    const finalRafaelYears = {};
    const finalDemos = {};

    verifySnap.forEach(d => {
        const data = d.data();
        const owner = data.owner_email || 'SEM_OWNER';
        const year = (data.data || '').substring(0, 4) || 'SEM_ANO';
        const isDemo = (data.paciente || '').toUpperCase().includes('DEMO');

        finalCounts[owner] = (finalCounts[owner] || 0) + 1;
        if (owner === 'rafaelleaobh@gmail.com') {
            finalRafaelYears[year] = (finalRafaelYears[year] || 0) + 1;
        }
        if (isDemo) {
            finalDemos[owner] = (finalDemos[owner] || 0) + 1;
        }
    });

    console.log("Contagem final por proprietário:", JSON.stringify(finalCounts, null, 2));
    console.log("Cirurgias de rafaelleaobh por ano:", JSON.stringify(finalRafaelYears, null, 2));
    console.log("Pacientes DEMO por proprietário:", JSON.stringify(finalDemos, null, 2));

    process.exit(0);
}

execute().catch(e => {
    console.error("Erro na execução:", e);
    process.exit(1);
});
