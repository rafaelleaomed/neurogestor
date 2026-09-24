import { Surgery } from '../types';
import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';
import { generateCaseClinicalSummary } from './gemini';
import { ref, getBlob } from 'firebase/storage';
import { firebaseStorage } from './firebase';

export type ExportProgressCallback = (current: number, total: number, message: string) => void;

interface LoadedImage {
  data: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
}

/**
 * Converte URLs de imagem (Data URL, Firebase Storage, HTTP) em base64 com dimensões reais
 */
async function loadImageAsBase64(url: string): Promise<LoadedImage | null> {
  if (!url) return null;
  try {
    let dataUrl = '';
    if (url.startsWith('data:image/')) {
      dataUrl = url;
    } else if (url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app') || url.includes('storage.googleapis.com')) {
      // 1. Prioriza download via SDK do Firebase Storage (imune a bloqueios de CORS no browser)
      try {
        const storageRef = ref(firebaseStorage, url);
        const blob = await getBlob(storageRef);
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (fbErr) {
        console.warn('[NeuroGestor Export] Falha no getBlob do Firebase, tentando fetch:', fbErr);
      }
    }

    // 2. Se ainda não obteve o dataUrl, tenta via fetch com CORS
    if (!dataUrl) {
      try {
        const resp = await fetch(url, { mode: 'cors' });
        const blob = await resp.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        // Fallback: carregar via tag Image com crossOrigin
        dataUrl = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 800;
            canvas.height = img.naturalHeight || img.height || 600;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas error'));
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
          img.src = url;
        });
      }
    }

    if (!dataUrl) return null;

    // Obter dimensões reais para proporção correta
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 600, height: img.naturalHeight || 400 });
      img.onerror = () => resolve({ width: 600, height: 400 });
      img.src = dataUrl;
    });

    const isPng = dataUrl.startsWith('data:image/png');
    return {
      data: dataUrl,
      width: dimensions.width,
      height: dimensions.height,
      format: isPng ? 'PNG' : 'JPEG',
    };
  } catch (err) {
    console.warn('[NeuroGestor Export] Não foi possível carregar imagem:', url, err);
    return null;
  }
}

/**
 * Coleta todas as imagens associadas a um caso (clínicas, laudos, etiquetas)
 */
function getCaseImageUrls(surgery: Surgery): string[] {
  const images: string[] = [];
  if (surgery.clinical_images && surgery.clinical_images.length > 0) {
    images.push(...surgery.clinical_images);
  }
  if (surgery.label_images && surgery.label_images.length > 0) {
    images.push(...surgery.label_images);
  }
  if (surgery.report_images && surgery.report_images.length > 0) {
    images.push(...surgery.report_images);
  }
  return [...new Set(images.filter(Boolean))];
}

// ============================================================
// EXPORTAÇÃO PDF COM RESUMO DA IA E IMAGENS
// ============================================================

export const generatePortfolioPDF = async (
  cases: (Surgery & { caseId: string })[],
  isDarkMode = false,
  onProgress?: ExportProgressCallback
) => {
  const total = cases.length;
  const doc = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = 841.89;
  const pageHeight = 595.28;

  // ── Capa do Portfólio ───────────────────────────────────────
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Barra de destaque superior
  doc.setFillColor(245, 158, 11); // Amber 500
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Portfólio de Casos Notáveis', 60, 200);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Monitorização Neurofisiológica Intraoperatória (MNIO)', 60, 235);

  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(1);
  doc.line(60, 265, pageWidth - 60, 265);

  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text(`Total de Casos Selecionados: ${total}`, 60, 305);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 60, 325);
  doc.text('Plataforma NeuroGestor • Resumos Clínicos Gerados com IA', 60, 345);

  // ── Processamento de cada caso ──────────────────────────────
  for (let idx = 0; idx < total; idx++) {
    const c = cases[idx];
    onProgress?.(idx + 1, total, `Gerando resumo com IA e carregando imagens do caso ${idx + 1} de ${total}...`);

    // 1. Gera resumo clínico estruturado com IA
    const aiSummary = await generateCaseClinicalSummary(c);

    // 2. Carrega imagens do caso
    const imageUrls = getCaseImageUrls(c);
    const loadedImages: LoadedImage[] = [];
    for (const url of imageUrls.slice(0, 4)) {
      const img = await loadImageAsBase64(url);
      if (img) loadedImages.push(img);
    }

    doc.addPage();

    // Fundo limpo
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Faixa colorida de cabeçalho
    const categoryColor = c.categoria === 'Crânio' ? [239, 68, 68] : c.categoria === 'Coluna' ? [59, 130, 246] : [16, 185, 129];
    doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
    doc.rect(0, 0, pageWidth, 6, 'F');

    // Cabeçalho do Caso
    const startY = 45;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11); // Amber
    doc.text(c.caseId, 45, startY);

    const idWidth = doc.getTextWidth(c.caseId) + 12;
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // Slate 900
    const titleText = `${c.subtipo || c.procedimento}`;
    doc.text(titleText, 45 + idWidth, startY);

    // Sub-cabeçalho com metadados
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate 500
    const metaParts = [
      `Data: ${c.data.split('-').reverse().join('/')}`,
      c.niveis_operados ? `Níveis: ${c.niveis_operados}` : '',
      c.categoria ? `Categoria: ${c.categoria}` : '',
      c.complexity_level ? `Complexidade: ${c.complexity_level.toUpperCase()}` : '',
      c.medico ? `Cirurgião: ${c.medico}` : '',
      c.hospital ? `Hospital: ${c.hospital}` : ''
    ].filter(Boolean);
    doc.text(metaParts.join('  •  '), 45, startY + 20);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(45, startY + 30, pageWidth - 45, startY + 30);

    // Layout de 2 Colunas se houver imagens
    const hasImages = loadedImages.length > 0;
    const leftColWidth = hasImages ? 440 : 750;
    const contentY = startY + 45;

    // Caixa de Resumo IA
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.roundedRect(45, contentY, leftColWidth, 180, 8, 8, 'FD');

    // Título da caixa de IA
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 91, 236); // Primary Blue
    doc.text('RESUMO CLÍNICO (INTELIGÊNCIA ARTIFICIAL)', 60, contentY + 22);

    // Texto da IA
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59); // Slate 800
    const splitSummary = doc.splitTextToSize(aiSummary, leftColWidth - 30);
    doc.text(splitSummary, 60, contentY + 42);

    // Caixa inferior esquerda: Tags, Notas e MNIO
    let lowerY = contentY + 195;

    if (c.portfolio_tags && c.portfolio_tags.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TAGS DO CASO:', 45, lowerY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(c.portfolio_tags.join(', '), 130, lowerY);
      lowerY += 18;
    }

    if (c.tecnicas_mnio && c.tecnicas_mnio.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TÉCNICAS MNIO:', 45, lowerY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(c.tecnicas_mnio.join(', '), 145, lowerY);
      lowerY += 18;
    }

    if (c.portfolio_notes || c.observacoes) {
      const noteText = c.portfolio_notes || c.observacoes || '';
      doc.setFillColor(254, 243, 199); // Amber 100
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(45, lowerY + 5, leftColWidth, 65, 6, 6, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9); // Amber 700
      doc.text('OBSERVAÇÕES DO ESPECIALISTA:', 55, lowerY + 22);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 53, 15);
      const splitNotes = doc.splitTextToSize(`"${noteText}"`, leftColWidth - 25);
      doc.text(splitNotes, 55, lowerY + 38);
    }

    // Coluna Direita: Imagens
    if (hasImages) {
      const rightX = 515;
      const rightWidth = pageWidth - rightX - 45; // ~280 pt
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(`IMAGENS E EXAMES (${loadedImages.length})`, rightX, contentY + 12);

      let imgY = contentY + 25;
      const maxImgHeight = loadedImages.length === 1 ? 340 : 165;

      for (let i = 0; i < Math.min(loadedImages.length, 2); i++) {
        const img = loadedImages[i];
        const aspectRatio = img.width / img.height;
        let drawW = rightWidth;
        let drawH = drawW / aspectRatio;

        if (drawH > maxImgHeight) {
          drawH = maxImgHeight;
          drawW = drawH * aspectRatio;
        }

        try {
          // Borda sutil para foto
          doc.setDrawColor(226, 232, 240);
          doc.rect(rightX, imgY, drawW, drawH, 'S');
          doc.addImage(img.data, img.format, rightX, imgY, drawW, drawH, undefined, 'FAST');
        } catch (imgErr) {
          console.warn('[PDF] Erro ao renderizar imagem:', imgErr);
        }

        imgY += drawH + 12;
      }
    }

    // Rodapé de cada página
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`NeuroGestor • Página ${idx + 2} de ${total + 1}`, 45, pageHeight - 20);
    doc.text('Documento gerado para fins de portfólio e documentação clínica.', pageWidth - 280, pageHeight - 20);
  }

  onProgress?.(total, total, 'Download do PDF iniciando...');
  doc.save(`Portfolio_Casos_NeuroGestor_${new Date().getTime()}.pdf`);
};

// ============================================================
// EXPORTAÇÃO POWERPOINT (PPTX) COM RESUMO DA IA E IMAGENS
// ============================================================

export const generatePortfolioPPTX = async (
  cases: (Surgery & { caseId: string })[],
  onProgress?: ExportProgressCallback
) => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 polegadas
  const total = cases.length;

  // ── Slide de Capa ───────────────────────────────────────────
  const coverSlide = pres.addSlide();
  coverSlide.background = { color: '0F172A' }; // Slate 900

  // Linha superior dourada
  coverSlide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.1,
    fill: { color: 'F59E0B' }
  });

  coverSlide.addText('Portfólio de Casos Clínicos Notáveis', {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF'
  });

  coverSlide.addText('Monitorização Neurofisiológica Intraoperatória (MNIO)', {
    x: 0.8,
    y: 2.6,
    w: 8.4,
    fontSize: 18,
    color: '94A3B8'
  });

  coverSlide.addText(`Total de Casos: ${total}   •   Emissão: ${new Date().toLocaleDateString('pt-BR')}`, {
    x: 0.8,
    y: 3.4,
    w: 8.4,
    fontSize: 13,
    color: 'CBD5E1'
  });

  coverSlide.addText('NeuroGestor 2.0 • Resumos Clínicos com Inteligência Artificial', {
    x: 0.8,
    y: 4.8,
    w: 8.4,
    fontSize: 10,
    color: '64748B'
  });

  // ── Slides de cada caso ─────────────────────────────────────
  for (let idx = 0; idx < total; idx++) {
    const c = cases[idx];
    onProgress?.(idx + 1, total, `Gerando resumo com IA e preparando slide ${idx + 1} de ${total}...`);

    // 1. Resumo clínico da IA
    const aiSummary = await generateCaseClinicalSummary(c);

    // 2. Carrega imagens
    const imageUrls = getCaseImageUrls(c);
    const loadedImages: LoadedImage[] = [];
    for (const url of imageUrls.slice(0, 3)) {
      const img = await loadImageAsBase64(url);
      if (img) loadedImages.push(img);
    }

    const slide = pres.addSlide();
    slide.background = { color: 'FFFFFF' };

    // Barra de categoria no topo
    const categoryHex = c.categoria === 'Crânio' ? 'EF4444' : c.categoria === 'Coluna' ? '3B82F6' : '10B981';
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fill: { color: categoryHex }
    });

    // Título do Caso
    slide.addText([
      { text: `${c.caseId}  `, options: { color: 'F59E0B', bold: true, fontSize: 20 } },
      { text: `${c.subtipo || c.procedimento}`, options: { color: '0F172A', bold: true, fontSize: 20 } }
    ], { x: 0.6, y: 0.25, w: 8.8, h: 0.5 });

    // Linha de Metadados
    const metaText = [
      `Data: ${c.data.split('-').reverse().join('/')}`,
      c.niveis_operados ? `Níveis: ${c.niveis_operados}` : '',
      c.categoria ? `Categoria: ${c.categoria}` : '',
      c.complexity_level ? `Complexidade: ${c.complexity_level.toUpperCase()}` : '',
      c.medico ? `Cirurgião: ${c.medico}` : '',
      c.hospital ? `Hospital: ${c.hospital}` : ''
    ].filter(Boolean).join('   |   ');

    slide.addText(metaText, {
      x: 0.6,
      y: 0.7,
      w: 8.8,
      h: 0.3,
      fontSize: 10,
      color: '64748B'
    });

    // Layout: se houver imagens, divide 5.2 in (texto) e 3.6 in (imagens)
    const hasImages = loadedImages.length > 0;
    const textWidth = hasImages ? 5.2 : 8.8;

    // Caixa de Resumo IA
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.6,
      y: 1.1,
      w: textWidth,
      h: 2.2,
      fill: { color: 'F8FAFC' },
      line: { color: 'CBD5E1', width: 1 }
    });

    slide.addText('RESUMO CLÍNICO (INTELIGÊNCIA ARTIFICIAL)', {
      x: 0.8,
      y: 1.2,
      w: textWidth - 0.4,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: '135BEC'
    });

    slide.addText(aiSummary, {
      x: 0.8,
      y: 1.5,
      w: textWidth - 0.4,
      h: 1.7,
      fontSize: 10,
      color: '1E293B',
      lineSpacing: 16
    });

    // Bloco Inferior Esquerdo: Tags e Observações
    let lowerY = 3.4;

    if (c.portfolio_tags && c.portfolio_tags.length > 0) {
      slide.addText(`Tags: ${c.portfolio_tags.join('  •  ')}`, {
        x: 0.6,
        y: lowerY,
        w: textWidth,
        h: 0.3,
        fontSize: 9,
        bold: true,
        color: '475569'
      });
      lowerY += 0.35;
    }

    if (c.portfolio_notes || c.observacoes) {
      const noteStr = c.portfolio_notes || c.observacoes || '';
      slide.addShape(pres.ShapeType.roundRect, {
        x: 0.6,
        y: lowerY,
        w: textWidth,
        h: 1.1,
        fill: { color: 'FEF3C7' },
        line: { color: 'F59E0B', width: 1 }
      });

      slide.addText(`Notas Clínicas: "${noteStr}"`, {
        x: 0.8,
        y: lowerY + 0.1,
        w: textWidth - 0.4,
        h: 0.9,
        fontSize: 9.5,
        italic: true,
        color: '78350F'
      });
    }

    // Coluna Direita: Imagens
    if (hasImages) {
      const imgX = 6.0;
      const imgW = 3.4;

      if (loadedImages.length === 1) {
        const img = loadedImages[0];
        const pptxData = img.data.startsWith('data:') ? img.data.replace(/^data:/, '') : img.data;
        slide.addImage({
          data: pptxData,
          x: imgX,
          y: 1.2,
          w: imgW,
          h: 3.5,
          sizing: { type: 'contain', w: imgW, h: 3.5 }
        });
      } else {
        // 2 imagens dispostas verticalmente
        for (let i = 0; i < Math.min(loadedImages.length, 2); i++) {
          const img = loadedImages[i];
          const pptxData = img.data.startsWith('data:') ? img.data.replace(/^data:/, '') : img.data;
          const curY = 1.2 + i * 1.8;
          slide.addImage({
            data: pptxData,
            x: imgX,
            y: curY,
            w: imgW,
            h: 1.7,
            sizing: { type: 'contain', w: imgW, h: 1.7 }
          });
        }
      }
    }

    // Rodapé do Slide
    slide.addText(`NeuroGestor • Caso ${idx + 1} de ${total}`, {
      x: 0.6,
      y: 5.2,
      w: 8.8,
      h: 0.3,
      fontSize: 8,
      color: '94A3B8'
    });
  }

  onProgress?.(total, total, 'Download do PPTX iniciando...');
  await pres.writeFile({ fileName: `Portfolio_Casos_NeuroGestor_${new Date().getTime()}.pptx` });
};
