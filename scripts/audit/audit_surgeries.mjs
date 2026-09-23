import xlsxPkg from 'xlsx';
const XLSX = xlsxPkg.default || xlsxPkg;
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Utiliza variáveis de ambiente ou configuração padrão de desenvolvimento
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyAbRW1AhJABBcC9bMtD7wKZLHgDFZZ7JVo",
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
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
    }
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = '20' + year;
    return year + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  return s;
}

async function run() {
  const masterPath = process.env.EXCEL_MASTER_PATH;
  if (!masterPath) {
    console.log("Defina EXCEL_MASTER_PATH para auditar contra uma planilha local.");
    process.exit(0);
  }

  console.log("=== COMPARANDO PLANILHA MESTRE vs FIRESTORE ===");
  const wb = XLSX.readFile(masterPath);
  
  const excelList = [];
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    rows.forEach(r => {
      const pac = clean(r['PACIENTE'] || r['Paciente'] || r['paciente']);
      if (pac && !pac.includes('TOTAL') && !pac.includes('SUBTOTAL')) {
        const rawDate = r['DATA'] || r['Data'] || r['data'];
        excelList.push({
          aba: sheetName,
          data: parseExcelDate(rawDate),
          paciente: pac,
          cirurgia: r['CIRURGIA'] || r['Cirurgia'] || r['cirurgia'] || r['PROCEDIMENTO'] || r['Procedimento'] || '',
          medico: r['MÉDICO '] || r['MÉDICO'] || r['Médico '] || r['Médico'] || r['medico'] || '',
          hospital: r['HOSPITAL'] || r['Hospital'] || r['hospital'] || '',
          valor: r['VALOR A RECEBER'] || r['VALOR'] || r['Valor'] || ''
        });
      }
    });
  });

  console.log("Total cirurgias na Planilha:", excelList.length);

  const snap = await getDocs(collection(db, 'surgeries'));
  const dbList = [];
  snap.forEach(d => {
    const s = d.data();
    dbList.push({ id: d.id, ...s });
  });

  console.log("Total cirurgias no Firestore:", dbList.length);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
