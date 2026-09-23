import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializa sem credencial de service account (usa a SDK com o project ID)
// Para ambientes locais sem GOOGLE_APPLICATION_CREDENTIALS, usa autenticação anônima
admin.initializeApp({
    projectId: 'neurogestor-app',
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function importSurgeries() {
    const raw = readFileSync('C:\\\\tmp\\\\surgeries_final.json', 'utf-8');
    const data = JSON.parse(raw);
    const surgeries = data.surgeries;

    console.log(`Importando ${surgeries.length} cirurgias para o Firestore...`);

    const batchSize = 450;
    let imported = 0;

    for (let i = 0; i < surgeries.length; i += batchSize) {
        const chunk = surgeries.slice(i, i + batchSize);
        const batch = db.batch();

        chunk.forEach(surgery => {
            const ref = db.collection('surgeries').doc(surgery.id);
            batch.set(ref, surgery);
        });

        await batch.commit();
        imported += chunk.length;
        const pct = Math.round((imported / surgeries.length) * 100);
        console.log(`  Progresso: ${imported}/${surgeries.length} (${pct}%)`);
    }

    console.log(`\n✅ Importação concluída! ${imported} cirurgias adicionadas.`);
    process.exit(0);
}

importSurgeries().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
