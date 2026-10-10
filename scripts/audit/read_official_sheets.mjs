import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const baseDir = 'C:\\Users\\racle\\Meu Drive\\MED LEAO\\Neuromonitorização';

function normalize(s) {
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

// 1. Verificar 2025 Consolidado FINAL
console.log('=== AUDITANDO PLANILHAS OFICIAIS ===');

const consolidated2025File = path.join(baseDir, '2025', 'Controle_monitorizacao_Consolidado_2025_FINAL.xlsx');
if (fs.existsSync(consolidated2025File)) {
    const wb = xlsx.readFile(consolidated2025File);
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    console.log(`2025 Consolidado FINAL: ${rows.length} cirurgias`);
    console.log('Exemplo 2025 linha 1:', rows[0]);
}

// 2. Verificar 2023 Geral
const geralFile = path.join(baseDir, 'Rafael Leão - Controle monitorizacão - geral.xlsx');
if (fs.existsSync(geralFile)) {
    const wb = xlsx.readFile(geralFile);
    let total2023 = 0;
    wb.SheetNames.forEach(sh => {
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
        total2023 += rows.length;
        console.log(`2023 Geral [${sh}]: ${rows.length} linhas`);
    });
    console.log(`Total 2023 no arquivo Geral: ${total2023}`);
}

// 3. Verificar 2026 pastas
const dir2026 = path.join(baseDir, '2026');
if (fs.existsSync(dir2026)) {
    const months2026 = fs.readdirSync(dir2026);
    let total2026 = 0;
    months2026.forEach(m => {
        const mPath = path.join(dir2026, m);
        if (fs.statSync(mPath).isDirectory()) {
            const files = fs.readdirSync(mPath).filter(f => f.endsWith('.xlsx'));
            files.forEach(f => {
                const wb = xlsx.readFile(path.join(mPath, f));
                wb.SheetNames.forEach(sh => {
                    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
                    total2026 += rows.length;
                    console.log(`2026 ${m} [${f}]: ${rows.length} linhas`);
                });
            });
        }
    });
    console.log(`Total 2026 nas pastas mensais: ${total2026}`);
}

// 4. Verificar 2024
const dir2024 = path.join(baseDir, '2024');
if (fs.existsSync(dir2024)) {
    const months2024 = fs.readdirSync(dir2024);
    let total2024 = 0;
    months2024.forEach(m => {
        const mPath = path.join(dir2024, m);
        if (fs.statSync(mPath).isDirectory()) {
            const files = fs.readdirSync(mPath).filter(f => f.endsWith('.xlsx'));
            files.forEach(f => {
                const wb = xlsx.readFile(path.join(mPath, f));
                wb.SheetNames.forEach(sh => {
                    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sh], { defval: '' });
                    total2024 += rows.length;
                    console.log(`2024 ${m} [${f}]: ${rows.length} linhas`);
                });
            });
        }
    });
    console.log(`Total 2024 nas pastas mensais: ${total2024}`);
}
