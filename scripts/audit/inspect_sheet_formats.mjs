import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const baseDir = 'C:\\Users\\racle\\Meu Drive\\MED LEAO\\Neuromonitorização';

function inspectWorkbook(filePath, yearLabel) {
    console.log(`\n--- ${yearLabel}: ${path.basename(filePath)} ---`);
    const wb = xlsx.readFile(filePath);
    wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
        console.log(`  Sheet [${sheetName}]: ${data.length} linhas brutas`);
        if (data.length > 0) {
            // mostrar primeiras 2 linhas que têm conteúdo
            const nonEmpty = data.filter(row => row.some(cell => cell !== ''));
            console.log(`    Linhas não vazias: ${nonEmpty.length}`);
            if (nonEmpty.length > 0) {
                console.log(`    Header:`, nonEmpty[0].slice(0, 8));
            }
        }
    });
}

// 2023
inspectWorkbook(path.join(baseDir, 'Rafael Leão - Controle monitorizacão - geral.xlsx'), '2023');

// 2024
const dir2024 = path.join(baseDir, '2024');
fs.readdirSync(dir2024).slice(0, 3).forEach(d => {
    const p = path.join(dir2024, d);
    if (fs.statSync(p).isDirectory()) {
        fs.readdirSync(p).filter(f => f.endsWith('.xlsx')).forEach(f => {
            inspectWorkbook(path.join(p, f), `2024/${d}`);
        });
    }
});

// 2026
const dir2026 = path.join(baseDir, '2026');
fs.readdirSync(dir2026).slice(0, 3).forEach(d => {
    const p = path.join(dir2026, d);
    if (fs.statSync(p).isDirectory()) {
        fs.readdirSync(p).filter(f => f.endsWith('.xlsx')).forEach(f => {
            inspectWorkbook(path.join(p, f), `2026/${d}`);
        });
    }
});
