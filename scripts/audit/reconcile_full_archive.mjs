import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const baseDir = 'C:\\Users\\racle\\Meu Drive\\MED LEAO\\Neuromonitorização';

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

function parseExcelDate(val) {
    if (!val) return '';
    if (typeof val === 'number') {
        const d = xlsx.SSF.parse_date_code(val);
        if (d) {
            return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
    }
    const s = String(val).trim();
    // YYYY-MM-DD
    const mIso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (mIso) {
        return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
    }
    // DD/MM/YYYY
    const mBr = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (mBr) {
        let y = mBr[3];
        if (y.length === 2) y = '20' + y;
        return `${y}-${mBr[2].padStart(2, '0')}-${mBr[1].padStart(2, '0')}`;
    }
    return s;
}

async function run() {
    console.log("======================================================");
    console.log("   AUDITORIA GERAL: PLANILHAS OFICIAIS vs FIRESTORE   ");
    console.log("======================================================");

    // 1. CARREGAR DADOS DO FIRESTORE
    const snap = await getDocs(collection(db, 'surgeries'));
    console.log(`Lidos ${snap.size} documentos do Firestore.`);

    const firestoreByYear = { '2023': [], '2024': [], '2025': [], '2026': [] };
    const firestoreDemos = [];
    const firestoreLegacy = [];

    snap.forEach(d => {
        const data = d.data();
        const id = d.id;
        const owner = data.owner_email || 'SEM_OWNER';
        const date = (data.data || '').trim();
        const year = date.substring(0, 4);
        const paciente = data.paciente || '';

        if (paciente.toUpperCase().includes('DEMO')) {
            firestoreDemos.push({ id, owner, ...data });
            return;
        }

        if (owner === 'legacy') {
            firestoreLegacy.push({ id, ...data });
        }

        if (owner === 'rafaelleaobh@gmail.com') {
            if (firestoreByYear[year]) {
                firestoreByYear[year].push({ id, ...data });
            }
        }
    });

    console.log(`\n--- SITUAÇÃO ATUAL EM rafaelleaobh@gmail.com (sem demos) ---`);
    for (const [y, list] of Object.entries(firestoreByYear)) {
        console.log(`Ano ${y}: ${list.length} cirurgias`);
    }
    console.log(`Total geral de Demos no Firestore: ${firestoreDemos.length}`);
    console.log(`Total geral de Legacy no Firestore: ${firestoreLegacy.length}`);

    // 2. AUDITAR PLANILHAS DE 2025
    console.log(`\n--- COMPARANDO 2025 COM PLANILHA CONSOLIDADA OFICIAL ---`);
    const file2025 = path.join(baseDir, '2025', 'Controle_monitorizacao_Consolidado_2025_FINAL.xlsx');
    const wb2025 = xlsx.readFile(file2025);
    const rows2025 = xlsx.utils.sheet_to_json(wb2025.Sheets[wb2025.SheetNames[0]], { defval: '' });
    console.log(`Planilha Consolidada 2025 tem: ${rows2025.length} cirurgias.`);

    const sheet2025Set = new Map();
    rows2025.forEach((r, idx) => {
        const d = parseExcelDate(r['Data'] || r['DATA']);
        const p = clean(r['Paciente'] || r['PACIENTE']);
        const proc = clean(r['Cirurgia'] || r['CIRURGIA'] || r['Procedimento']);
        const key = `${d}|${p}`;
        sheet2025Set.set(key, { d, p, proc, raw: r, rowIdx: idx + 2 });
    });

    const firestore2025Map = new Map();
    const firestore2025Duplicates = [];
    firestoreByYear['2025'].forEach(s => {
        const d = (s.data || '').trim();
        const p = clean(s.paciente);
        const key = `${d}|${p}`;
        if (firestore2025Map.has(key)) {
            firestore2025Duplicates.push(s);
        } else {
            firestore2025Map.set(key, s);
        }
    });

    console.log(`Em rafaelleaobh@gmail.com no ano 2025:`);
    console.log(`  - Cirurgias únicas: ${firestore2025Map.size}`);
    console.log(`  - Duplicatas internas em 2025: ${firestore2025Duplicates.length}`);

    let matchCount2025 = 0;
    let missingInFirestore2025 = [];
    for (const [key, item] of sheet2025Set.entries()) {
        if (firestore2025Map.has(key)) {
            matchCount2025++;
        } else {
            missingInFirestore2025.push(item);
        }
    }

    let extraInFirestore2025 = [];
    for (const [key, item] of firestore2025Map.entries()) {
        if (!sheet2025Set.has(key)) {
            extraInFirestore2025.push(item);
        }
    }

    console.log(`  - Correspondências exatas com a planilha oficial 2025: ${matchCount2025}`);
    console.log(`  - Faltando no Firestore em relação à planilha: ${missingInFirestore2025.length}`);
    if (missingInFirestore2025.length > 0) {
        console.log(`    Exemplos faltando:`, missingInFirestore2025.slice(0, 5));
    }
    console.log(`  - No Firestore mas não na planilha de 2025: ${extraInFirestore2025.length}`);
    if (extraInFirestore2025.length > 0) {
        console.log(`    Exemplos extras:`, extraInFirestore2025.slice(0, 5));
    }

    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
