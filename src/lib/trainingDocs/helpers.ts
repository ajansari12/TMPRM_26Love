import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type RGB = [number, number, number];

export interface DocOptions {
  orgName: string;
}

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 18;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const FOOTER_RESERVED = 16;

export const CATEGORY_COLORS: Record<string, RGB> = {
  Orientation: [59, 130, 246],
  'User Guide': [16, 185, 129],
  Compliance: [245, 158, 11],
  'Risk Management': [239, 68, 68],
  Workflow: [14, 165, 233],
  Contracts: [20, 184, 166],
  Reference: [71, 85, 105],
};

export const NAVY: RGB = [30, 58, 95];
export const DARK_TEXT: RGB = [31, 41, 55];
export const MID_TEXT: RGB = [75, 85, 99];
export const LIGHT_TEXT: RGB = [156, 163, 175];
export const LIGHT_BG: RGB = [248, 250, 252];

export function addCoverPage(
  doc: jsPDF,
  title: string,
  category: string,
  orgName: string,
  dateStr: string,
  color: RGB
): void {
  const pw = PAGE_W;
  const ph = PAGE_H;

  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, pw, 170, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(orgName.toUpperCase(), MARGIN, 22);

  doc.setFontSize(10);
  doc.text('THIRD-PARTY RISK MANAGEMENT PLATFORM', MARGIN, 30);

  const titleLines = doc.splitTextToSize(title, pw - MARGIN * 2 - 10);
  doc.setFontSize(titleLines.length > 2 ? 22 : 26);
  doc.setFont('helvetica', 'bold');
  doc.text(titleLines, MARGIN, 62);

  const afterTitle = 62 + titleLines.length * (titleLines.length > 2 ? 9 : 11) + 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const catWidth = doc.getTextWidth(category) + 10;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, afterTitle, catWidth, 8, 1.5, 1.5, 'F');
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(category, MARGIN + 5, afterTitle + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(dateStr, pw - MARGIN, 158, { align: 'right' });
  doc.setFontSize(9);
  doc.text('For Internal Use Only — Confidential', MARGIN, 158);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 170, pw, ph - 170, 'F');

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, ph - 14, pw, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('TPRM Platform', MARGIN, ph - 5);
  doc.text('Confidential — Do Not Distribute Externally', pw - MARGIN, ph - 5, { align: 'right' });
}

export function addPageFooter(doc: jsPDF, orgName: string): void {
  const ph = PAGE_H;
  const pw = PAGE_W;
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  const totalPages = doc.getNumberOfPages();

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, ph - 14, pw - MARGIN, ph - 14);
  doc.setTextColor(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(orgName, MARGIN, ph - 9);
  doc.text(`Page ${pageNum} of ${totalPages}`, pw / 2, ph - 9, { align: 'center' });
  doc.text('Confidential', pw - MARGIN, ph - 9, { align: 'right' });
}

export function checkPage(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > PAGE_H - FOOTER_RESERVED - 8) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

export function addSectionTitle(
  doc: jsPDF,
  text: string,
  y: number,
  color: RGB
): number {
  doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
  doc.rect(MARGIN - 2, y - 5, PAGE_W - MARGIN * 2 + 4, 11, 'F');
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(MARGIN - 2, y - 5, 3, 11, 'F');
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(text, MARGIN + 4, y + 2);
  return y + 13;
}

export function addSubTitle(doc: jsPDF, text: string, y: number): number {
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(text, MARGIN, y);
  return y + 7;
}

export function addBody(doc: jsPDF, text: string, y: number): number {
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 5.2 + 4;
}

export function addBullet(doc: jsPDF, items: string[], y: number): number {
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  for (const item of items) {
    const lines = doc.splitTextToSize(item, CONTENT_W - 8);
    doc.setTextColor(MID_TEXT[0], MID_TEXT[1], MID_TEXT[2]);
    doc.text('\u2022', MARGIN + 2, y);
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(lines, MARGIN + 7, y);
    y += lines.length * 5.2 + 2;
  }
  return y + 3;
}

export function addTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  color: RGB
): number {
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: [color[0], color[1], color[2]] as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8.5, textColor: [DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]] },
    alternateRowStyles: { fillColor: [LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]] },
    styles: { cellPadding: 3 },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

export function applyAllFooters(doc: jsPDF, orgName: string): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) addPageFooter(doc, orgName);
  }
}

export function getDateStr(): string {
  return new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function saveDoc(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
