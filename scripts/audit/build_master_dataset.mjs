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

// Coleta todas as cirurgias de todas as planilhas oficiais
function loadAllOfficialSurgeries() {
    const masterMap = new Map(); // key -> surgery

    // 1. 2023 Geral
    const geralFile = path.join(baseDir, 'Rafael Leão - Controle monitorizacão - geral.xlsx');
    if (fs.existsSync(geralFile)) {
        const wb = xlsx.readFile(geralFile);
        wb.SheetNames.forEach(sh => {
            const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
            rows.forEach(r => {
                const date = parseExcelDate(r['Data'] || r['DATA']);
                const pat = clean(r['Paciente'] || r['PACIENTE']);
                const proc = clean(r['Cirurgia'] || r['CIRURGIA'] || r['Procedimento']);
                const med = clean(r['Médico '] || r['Médico'] || r['MEDICO']);
                const hosp = clean(r['Hospital'] || r['HOSPITAL']);
                if (date && pat && pat !== 'PACIENTE') {
                    const key = `${date}|${pat}`;
                    masterMap.set(key, { date, pat, proc, med, hosp, source: `2023 Geral (${sh})` });
                }
            });
        });
    }

    // 2. 2023 arquivos avulsos
    const dir2023 = path.join(baseDir, '2023');
    if (fs.existsSync(dir2023)) {
        fs.readdirSync(dir2023).forEach(sub => {
            const sp = path.join(dir2023, sub);
            if (fs.statSync(sp).isDirectory()) {
                fs.readdirSync(sp).filter(f => f.endsWith('.xlsx')).forEach(f => {
                    const wb = xlsx.readFile(path.join(sp, f));
                    wb.SheetNames.forEach(sh => {
                        if (sh.toLowerCase().includes('foto')) return;
                        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
                        rows.forEach(r => {
                            const date = parseExcelDate(r['Data'] || r['DATA']);
                            const pat = clean(r['Paciente'] || r['PACIENTE']);
                            const proc = clean(r['Cirurgia'] || r['CIRURGIA'] || r['Procedimento']);
                            const med = clean(r['Médico '] || r['Médico'] || r['MEDICO']);
                            const hosp = clean(r['Hospital'] || r['HOSPITAL']);
                            if (date && pat && pat !== 'PACIENTE') {
                                const key = `${date}|${pat}`;
                                if (!masterMap.has(key)) {
                                    masterMap.set(key, { date, pat, proc, med, hosp, source: `2023 (${sub}/${f})` });
                                }
                            }
                        });
                    });
                });
            }
        });
    }

    // 3. 2024
    const dir2024 = path.join(baseDir, '2024');
    if (fs.existsSync(dir2024)) {
        fs.readdirSync(dir2024).forEach(sub => {
            const sp = path.join(dir2024, sub);
            if (fs.statSync(sp).isDirectory()) {
                fs.readdirSync(sp).filter(f => f.endsWith('.xlsx')).forEach(f => {
                    const wb = xlsx.readFile(path.join(sp, f));
                    wb.SheetNames.forEach(sh => {
                        if (sh.toLowerCase().includes('foto')) return;
                        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
                        rows.forEach(r => {
                            const date = parseExcelDate(r['Data'] || r['DATA']);
                            const pat = clean(r['Paciente'] || r['PACIENTE']);
                            const proc = clean(r['Cirurgia'] || r['CIRURGIA'] || r['Procedimento']);
                            const med = clean(r['Médico '] || r['Médico'] || r['MEDICO']);
                            const hosp = clean(r['Hospital'] || r['HOSPITAL']);
                            if (date && pat && pat !== 'PACIENTE') {
                                const key = `${date}|${pat}`;
                                if (!masterMap.has(key)) {
                                    masterMap.set(key, { date, pat, proc, med, hosp, source: `2024 (${sub}/${f})` });
                                }
                            }
                        });
                    });
                });
            }
        });
    }

    // 4. 2025 Consolidado FINAL
    const file2025 = path.join(baseDir, '2025', 'Controle_monitorizacao_Consolidado_2025_FINAL.xlsx');
    if (fs.existsSync(file2025)) {
        const wb = xlsx.readFile(file2025);
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        rows.forEach(r => {
            const date = parseExcelDate(r['Data'] || r['DATA']);
            const pat = clean(r['Paciente'] || r['PACIENTE']);
            const proc = clean(r['Cirurgia'] || r['CIRURGIA'] || r['Procedimento']);
            const med = clean(r['Médico'] || r['MEDICO']);
            const hosp = clean(r['Hospital'] || r['HOSPITAL']);
            if (date && pat) {
                const key = `${date}|${pat}`;
                masterMap.set(key, { date, pat, proc, med, hosp, source: '2025 Consolidado FINAL' });
            }
        });
    }

    // 5. 2026 pastas mensais (Jan a Ago)
    const dir2026 = path.join(baseDir, '2026');
    if (fs.existsSync(dir2026)) {
        fs.readdirSync(dir2026).forEach(sub => {
            const sp = path.join(dir2026, sub);
            if (fs.statSync(sp).isDirectory()) {
                fs.readdirSync(sp).filter(f => f.endsWith('.xlsx')).forEach(f => {
                    const wb = xlsx.readFile(path.join(sp, f));
                    wb.SheetNames.forEach(sh => {
                        // IGNORAR abas de fotos, valores, etc.
                        if (sh.toLowerCase().includes('foto')) return;
                        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
                        rows.forEach(r => {
                            const date = parseExcelDate(r['Data'] || r['DATA']);
                            const pat = clean(r['Paciente'] || r['PACIENTE']);
                            const proc = clean(r['Procedimento'] || r['Cirurgia'] || r['CIRURGIA']);
                            const med = clean(r['Médico'] || r['MEDICO']);
                            const hosp = clean(r['Hospital'] || r['HOSPITAL']);
                            if (date && pat && pat !== 'PACIENTE') {
                                const key = `${date}|${pat}`;
                                masterMap.set(key, { date, pat, proc, med, hosp, source: `2026 (${sub}/${f})` });
                            }
                        });
                    });
                });
            }
        });
    }

    return masterMap;
}

async function run() {
    console.log("=== EXTRAINDO CIRURGIAS DAS PLANILHAS OFICIAIS ===");
    const officialMap = loadAllOfficialSurgeries();
    console.log(`Total de cirurgias únicas oficiais extraídas: ${officialMap.size}`);

    const officialByYear = {};
    for (const [k, v] of officialMap.entries()) {
        const y = v.date.substring(0, 4);
        officialByYear[y] = (officialByYear[y] || 0) + 1;
    }
    console.log('Distribuição oficial por ano:', officialByYear);

    // Comparar com Firestore rafaelleaobh@gmail.com
    const snap = await getDocs(collection(db, 'surgeries'));
    const firestoreRafaelMap = new Map();

    snap.forEach(d => {
        const data = d.data();
        if (data.owner_email === 'rafaelleaobh@gmail.com') {
            const date = (data.data || '').trim();
            const pat = clean(data.paciente);
            const key = `${date}|${pat}`;
            firestoreRafaelMap.set(key, { id: d.id, ...data });
        }
    });

    console.log(`\nTotal em rafaelleaobh@gmail.com no Firestore: ${firestoreRafaelMap.size}`);
    const firestoreByYear = {};
    for (const [k, v] of firestoreRafaelMap.entries()) {
        const y = (v.data || '').substring(0, 4);
        firestoreByYear[y] = (firestoreByYear[y] || 0) + 1;
    }
    console.log('Distribuição no Firestore (rafaelleaobh):', firestoreByYear);

    // Comparação ano a ano
    ['2023', '2024', '2025', '2026'].forEach(year => {
        console.log(`\n================== ANO ${year} ==================`);
        let matched = 0;
        const missingInFirestore = [];
        for (const [k, off] of officialMap.entries()) {
            if (off.date.startsWith(year)) {
                if (firestoreRafaelMap.has(k)) {
                    matched++;
                } else {
                    missingInFirestore.push(off);
                }
            }
        }

        const extraInFirestore = [];
        for (const [k, fsItem] of firestoreRafaelMap.entries()) {
            if (fsItem.data && fsItem.data.startsWith(year)) {
                if (!officialMap.has(k)) {
                    extraInFirestore.push(fsItem);
                }
            }
        }

        console.log(`Oficial: ${officialByYear[year] || 0} | Firestore: ${firestoreByYear[year] || 0}`);
        console.log(`Correspondências perfeitas: ${matched}`);
        console.log(`Faltando no Firestore: ${missingInFirestore.length}`);
        if (missingInFirestore.length > 0) {
            console.log(`  Exemplos faltando:`, missingInFirestore.slice(0, 3));
        }
        console.log(`Extras no Firestore (adicionados pelo app/site): ${extraInFirestore.length}`);
        if (extraInFirestore.length > 0) {
            console.log(`  Exemplos extras:`, extraInFirestore.slice(0, 3).map(x => ({ data: x.data, paciente: x.paciente, proc: x.procedimento })));
        }
    });

    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
