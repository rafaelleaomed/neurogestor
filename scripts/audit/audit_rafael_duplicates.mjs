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
    const mIso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (mIso) {
        return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
    }
    const mBr = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (mBr) {
        let y = mBr[3];
        if (y.length === 2) y = '20' + y;
        return `${y}-${mBr[2].padStart(2, '0')}-${mBr[1].padStart(2, '0')}`;
    }
    return s;
}

async function auditAllYears() {
    console.log("=== INICIANDO AUDITORIA DETALHADA 2023, 2024, 2026 ===");

    // Obter dados de Rafael no Firestore
    const snap = await getDocs(collection(db, 'surgeries'));
    const rafaelSurgeries = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.owner_email === 'rafaelleaobh@gmail.com') {
            rafaelSurgeries.push({ id: d.id, ...data });
        }
    });

    console.log(`Total em rafaelleaobh@gmail.com: ${rafaelSurgeries.length}`);
    const byYear = {};
    rafaelSurgeries.forEach(s => {
        const y = (s.data || '').substring(0, 4);
        byYear[y] = (byYear[y] || 0) + 1;
    });
    console.log('Distribuição por ano no Firestore:', byYear);

    // Checar duplicatas internas em rafaelleaobh@gmail.com
    const seen = new Map();
    const internalDuplicates = [];
    rafaelSurgeries.forEach(s => {
        const d = (s.data || '').trim();
        const p = clean(s.paciente);
        const proc = clean(s.procedimento);
        const k = `${d}|${p}|${proc}`;
        if (seen.has(k)) {
            internalDuplicates.push({ duplicate: s, original: seen.get(k) });
        } else {
            seen.set(k, s);
        }
    });

    console.log(`\nDuplicatas internas encontradas em rafaelleaobh@gmail.com: ${internalDuplicates.length}`);
    if (internalDuplicates.length > 0) {
        internalDuplicates.slice(0, 5).forEach(dup => {
            console.log(`  - [${dup.duplicate.data}] ${dup.duplicate.paciente} | ${dup.duplicate.procedimento} (ID: ${dup.duplicate.id})`);
        });
    }

    process.exit(0);
}

auditAllYears().catch(e => {
    console.error(e);
    process.exit(1);
});
