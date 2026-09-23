import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: "neurogestor-app.firebaseapp.com",
    projectId: "neurogestor-app",
    storageBucket: "neurogestor-app.firebasestorage.app",
    messagingSenderId: "744896910428",
    appId: "1:744896910428:web:6cbb0c665701d3acc1c299"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Script de manutenção para mesclar registros duplicados identificados por ID.
 */
async function run() {
  console.log("=== ROTINA DE MANUTENÇÃO E CONSOLIDAÇÃO DE DUPLICATAS ===");
  // Exemplos de pares para consolidação via IDs
  const duplicatePairs = [];

  for (const pair of duplicatePairs) {
    const dupeSnap = await getDoc(doc(db, 'surgeries', pair.dupeId));
    const officialSnap = await getDoc(doc(db, 'surgeries', pair.officialId));

    if (dupeSnap.exists() && officialSnap.exists()) {
      const dupeData = dupeSnap.data();
      const officialData = officialSnap.data();

      const combinedLabels = Array.from(new Set([
        ...(officialData.label_images || []),
        ...(dupeData.label_images || [])
      ]));

      await updateDoc(doc(db, 'surgeries', pair.officialId), {
        label_images: combinedLabels
      });
      await deleteDoc(doc(db, 'surgeries', pair.dupeId));
      console.log(`Consolidado com sucesso ID ${pair.officialId}`);
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
