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

async function purge() {
    console.log("=== INICIANDO LIMPEZA DE CIRURGIAS 2025 ATRIBUÍDAS INDEVIDAMENTE ===");
    
    const snapshot = await getDocs(collection(db, 'surgeries'));
    console.log(`Total de cirurgias no Firestore: ${snapshot.size}`);

    const toDeleteMichel = [];
    const michelKeep = [];
    const toDeleteVisitante = [];

    snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        const owner = d.owner_email || '';

        if (owner === 'micheltales@gmail.com') {
            const is2025 = d.data && d.data.startsWith('2025');
            const isDemoPt = (d.paciente || '').startsWith('PACIENTE DEMO');
            if (is2025 || isDemoPt) {
                toDeleteMichel.push({ id, data: d.data, paciente: d.paciente, proc: d.procedimento });
            } else {
                michelKeep.push({ id, data: d.data, paciente: d.paciente, proc: d.procedimento });
            }
        } else if (owner === 'visitante@neurogestor.demo') {
            const isDemoPt = (d.paciente || '').startsWith('PACIENTE DEMO');
            if (isDemoPt || (d.data && d.data.startsWith('2025'))) {
                toDeleteVisitante.push({ id, data: d.data, paciente: d.paciente });
            }
        }
    });

    console.log(`\n--- CONTA: micheltales@gmail.com ---`);
    console.log(`Cirurgias legítimas que serão MANTIDAS (${michelKeep.length}):`);
    michelKeep.forEach(s => console.log(`  - [${s.data}] ${s.paciente} | ${s.proc} (ID: ${s.id})`));

    console.log(`\nCirurgias duplicadas/2025 a REMOVER de Michel: ${toDeleteMichel.length}`);
    console.log(`Cirurgias demo a REMOVER de Visitante: ${toDeleteVisitante.length}`);

    // Executar deleção em batches de 400
    const allToDelete = [...toDeleteMichel.map(x => x.id), ...toDeleteVisitante.map(x => x.id)];
    console.log(`\nTotal de documentos a deletar: ${allToDelete.length}`);

    const batchSize = 400;
    for (let i = 0; i < allToDelete.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = allToDelete.slice(i, i + batchSize);
        chunk.forEach(id => {
            batch.delete(doc(db, 'surgeries', id));
        });
        await batch.commit();
        console.log(`Deletados ${Math.min(i + batchSize, allToDelete.length)} de ${allToDelete.length}...`);
    }

    console.log("\n✅ Deleção concluída com sucesso!");

    // Verificação pós-deleção
    const verifySnap = await getDocs(collection(db, 'surgeries'));
    const finalCounts = {};
    verifySnap.forEach(d => {
        const owner = d.data().owner_email || 'SEM_OWNER';
        finalCounts[owner] = (finalCounts[owner] || 0) + 1;
    });
    console.log("\n=== CONTAGEM FINAL POR PROPRIETÁRIO ===");
    console.log(JSON.stringify(finalCounts, null, 2));

    process.exit(0);
}

purge().catch(err => {
    console.error("Erro na limpeza:", err);
    process.exit(1);
});
