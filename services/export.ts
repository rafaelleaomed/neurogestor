import { Surgery } from '../types';
import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';

export const generatePortfolioPDF = async (cases: (Surgery & { caseId: string })[], isDarkMode: boolean) => {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  
  // Basic title page
  doc.setFontSize(24);
  doc.setTextColor(isDarkMode ? 255 : 40, isDarkMode ? 255 : 40, isDarkMode ? 255 : 40);
  doc.text('Portfólio de Casos Clínicos - MNIO', 40, 60);
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 40, 90);
  
  doc.setFontSize(12);
  doc.text(`Total de casos selecionados: ${cases.length}`, 40, 110);

  // Iterate over cases (one per page or list? For a portfolio, usually 1 or 2 per page)
  cases.forEach((c, index) => {
    doc.addPage();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11); // Amber 500
    doc.text(`${c.caseId} - ${c.subtipo || c.procedimento}`, 40, 60);

    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`Data: ${c.data.split('-').reverse().join('/')}`, 40, 90);
    
    if (c.niveis_operados) {
      doc.text(`Níveis: ${c.niveis_operados}`, 40, 110);
    }
    if (c.complexity_level) {
      doc.text(`Complexidade: ${c.complexity_level}`, 200, 110);
    }

    // Tags
    if (c.portfolio_tags && c.portfolio_tags.length > 0) {
      doc.setFontSize(10);
      doc.text(`Tags: ${c.portfolio_tags.join(' | ')}`, 40, 130);
    }

    // Notes
    if (c.portfolio_notes) {
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      const splitNotes = doc.splitTextToSize(`Notas: ${c.portfolio_notes}`, 750);
      doc.text(splitNotes, 40, 160);
    }

    // Images (we'll just list URLs for now, fetching and embedding images can be complex due to CORS)
    // To embed, we'd need to fetch the image, draw to canvas, etc. For now we will add a placeholder text.
    if (c.clinical_images && c.clinical_images.length > 0) {
       doc.text(`[ ${c.clinical_images.length} Imagens Clínicas Anexadas no Sistema ]`, 40, 220);
    }
  });

  doc.save(`Portfolio_MNIO_${new Date().getTime()}.pdf`);
};

export const generatePortfolioPPTX = async (cases: (Surgery & { caseId: string })[]) => {
  const pres = new pptxgen();
  
  // Title Slide
  const slide = pres.addSlide();
  slide.addText('Portfólio de Casos Clínicos', { x: 1, y: 2, w: 8, fontSize: 36, bold: true, color: '333333' });
  slide.addText(`Monitorização Neurofisiológica Intraoperatória`, { x: 1, y: 3, w: 8, fontSize: 18, color: '666666' });
  slide.addText(`Total de Casos: ${cases.length}`, { x: 1, y: 3.5, w: 8, fontSize: 14, color: '888888' });

  cases.forEach(c => {
    const s = pres.addSlide();
    s.addText(`${c.caseId} - ${c.subtipo || c.procedimento}`, { x: 0.5, y: 0.5, w: 9, fontSize: 24, bold: true, color: 'F59E0B' });
    
    let yPos = 1.5;
    s.addText(`Data: ${c.data.split('-').reverse().join('/')}`, { x: 0.5, y: yPos, fontSize: 14, color: '555555' });
    
    if (c.niveis_operados) {
      yPos += 0.4;
      s.addText(`Níveis: ${c.niveis_operados}`, { x: 0.5, y: yPos, fontSize: 14, color: '555555' });
    }
    
    if (c.portfolio_tags && c.portfolio_tags.length > 0) {
      yPos += 0.5;
      s.addText(`Tags: ${c.portfolio_tags.join(' | ')}`, { x: 0.5, y: yPos, fontSize: 12, color: '888888' });
    }

    if (c.portfolio_notes) {
      yPos += 0.6;
      s.addText(`Notas: ${c.portfolio_notes}`, { x: 0.5, y: yPos, w: 9, fontSize: 14, color: '333333', italic: true });
    }

    if (c.clinical_images && c.clinical_images.length > 0) {
       yPos += 1;
       s.addText(`[ ${c.clinical_images.length} Imagens Clínicas Anexadas no Sistema ]`, { x: 0.5, y: yPos, fontSize: 12, color: 'AAAAAA' });
    }
  });

  await pres.writeFile({ fileName: `Portfolio_MNIO_${new Date().getTime()}.pptx` });
};
