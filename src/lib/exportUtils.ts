import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PptxGenJS from 'pptxgenjs';
import { saveAs } from 'file-saver';

interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

interface ReportSection {
  title: string;
  type: 'text' | 'table' | 'chart' | 'kpi';
  content?: string;
  tableData?: TableData;
  chartData?: ChartData;
  kpiData?: { label: string; value: string | number; status?: string }[];
}

interface ReportConfig {
  title: string;
  subtitle?: string;
  author?: string;
  date: string;
  sections: ReportSection[];
}

const COLORS = {
  primary: '#1e3a5f',
  secondary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#1f2937',
  lightGray: '#f3f4f6',
  white: '#ffffff',
};

export async function exportToPDF(config: ReportConfig): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title, margin, 25);

  if (config.subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(config.subtitle, margin, 35);
  }

  doc.setFontSize(10);
  doc.text(config.date, pageWidth - margin - 30, 25);

  yPosition = 55;

  for (const section of config.sections) {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setTextColor(30, 58, 95);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, yPosition);
    yPosition += 8;

    switch (section.type) {
      case 'text':
        if (section.content) {
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(section.content, pageWidth - margin * 2);
          doc.text(lines, margin, yPosition);
          yPosition += lines.length * 5 + 8;
        }
        break;

      case 'table':
        if (section.tableData) {
          autoTable(doc, {
            startY: yPosition,
            head: [section.tableData.headers],
            body: section.tableData.rows.map(row => row.map(cell => String(cell))),
            margin: { left: margin, right: margin },
            headStyles: {
              fillColor: [30, 58, 95],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 9,
            },
            bodyStyles: {
              fontSize: 9,
              textColor: [31, 41, 55],
            },
            alternateRowStyles: {
              fillColor: [243, 244, 246],
            },
          });
          yPosition = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        }
        break;

      case 'kpi':
        if (section.kpiData) {
          const kpiWidth = (pageWidth - margin * 2 - 10 * (section.kpiData.length - 1)) / section.kpiData.length;
          let xPos = margin;

          for (const kpi of section.kpiData) {
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(xPos, yPosition, kpiWidth, 25, 2, 2, 'F');

            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text(kpi.label, xPos + 5, yPosition + 8);

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            if (kpi.status === 'success') {
              doc.setTextColor(16, 185, 129);
            } else if (kpi.status === 'warning') {
              doc.setTextColor(245, 158, 11);
            } else if (kpi.status === 'danger') {
              doc.setTextColor(239, 68, 68);
            } else {
              doc.setTextColor(31, 41, 55);
            }
            doc.text(String(kpi.value), xPos + 5, yPosition + 20);

            xPos += kpiWidth + 10;
          }
          yPosition += 35;
          doc.setFont('helvetica', 'normal');
        }
        break;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('OSFI B-10 TPRM - Confidential', margin, pageHeight - 10);
  }

  doc.save(`${config.title.replace(/\s+/g, '_')}_${config.date}.pdf`);
}

export async function exportToPowerPoint(config: ReportConfig): Promise<void> {
  const pptx = new PptxGenJS();

  pptx.author = config.author || 'TPRM System';
  pptx.title = config.title;
  pptx.subject = config.subtitle || 'Board Report';
  pptx.company = 'TPRM';

  pptx.defineSlideMaster({
    title: 'TPRM_MASTER',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: '1e3a5f' } } },
      {
        text: {
          text: 'OSFI B-10 TPRM',
          options: { x: 0.3, y: 0.2, w: 3, h: 0.4, fontSize: 12, color: 'FFFFFF', bold: true },
        },
      },
      {
        text: {
          text: config.date,
          options: { x: 7.5, y: 0.2, w: 2, h: 0.4, fontSize: 10, color: 'FFFFFF', align: 'right' },
        },
      },
    ],
  });

  const titleSlide = pptx.addSlide();
  titleSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '1e3a5f' } });
  titleSlide.addText(config.title, {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1,
    fontSize: 36,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
  });
  if (config.subtitle) {
    titleSlide.addText(config.subtitle, {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: 'CCCCCC',
      align: 'center',
    });
  }
  titleSlide.addText(config.date, {
    x: 0.5,
    y: 4.5,
    w: 9,
    h: 0.4,
    fontSize: 14,
    color: 'AAAAAA',
    align: 'center',
  });

  for (const section of config.sections) {
    const slide = pptx.addSlide({ masterName: 'TPRM_MASTER' });

    slide.addText(section.title, {
      x: 0.3,
      y: 1,
      w: 9.4,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: '1e3a5f',
    });

    switch (section.type) {
      case 'text':
        if (section.content) {
          slide.addText(section.content, {
            x: 0.3,
            y: 1.7,
            w: 9.4,
            h: 3.5,
            fontSize: 14,
            color: '333333',
            valign: 'top',
          });
        }
        break;

      case 'table':
        if (section.tableData) {
          const tableRows: PptxGenJS.TableRow[] = [
            section.tableData.headers.map((h) => ({
              text: h,
              options: { fill: { color: '1e3a5f' }, color: 'FFFFFF', bold: true, fontSize: 10 },
            })),
            ...section.tableData.rows.map((row) =>
              row.map((cell) => ({
                text: String(cell),
                options: { fontSize: 9, color: '333333' },
              }))
            ),
          ];

          slide.addTable(tableRows, {
            x: 0.3,
            y: 1.7,
            w: 9.4,
            colW: Array(section.tableData.headers.length).fill(9.4 / section.tableData.headers.length),
            border: { pt: 0.5, color: 'CCCCCC' },
            align: 'left',
            valign: 'middle',
          });
        }
        break;

      case 'kpi':
        if (section.kpiData) {
          const kpiWidth = 9 / section.kpiData.length;
          section.kpiData.forEach((kpi, index) => {
            const xPos = 0.5 + index * kpiWidth;

            slide.addShape('roundRect', {
              x: xPos,
              y: 1.7,
              w: kpiWidth - 0.2,
              h: 1.2,
              fill: { color: 'F3F4F6' },
              line: { color: 'E5E7EB', pt: 1 },
            });

            slide.addText(kpi.label, {
              x: xPos,
              y: 1.8,
              w: kpiWidth - 0.2,
              h: 0.3,
              fontSize: 10,
              color: '6B7280',
              align: 'center',
            });

            let valueColor = '1F2937';
            if (kpi.status === 'success') valueColor = '10B981';
            else if (kpi.status === 'warning') valueColor = 'F59E0B';
            else if (kpi.status === 'danger') valueColor = 'EF4444';

            slide.addText(String(kpi.value), {
              x: xPos,
              y: 2.15,
              w: kpiWidth - 0.2,
              h: 0.5,
              fontSize: 24,
              bold: true,
              color: valueColor,
              align: 'center',
            });
          });
        }
        break;

      case 'chart':
        if (section.chartData) {
          slide.addChart('bar', [
            {
              name: section.title,
              labels: section.chartData.labels,
              values: section.chartData.values,
            },
          ], {
            x: 0.5,
            y: 1.7,
            w: 9,
            h: 3.5,
            chartColors: section.chartData.colors || ['3B82F6', '10B981', 'F59E0B', 'EF4444'],
            showLegend: false,
            showTitle: false,
            barDir: 'bar',
          });
        }
        break;
    }
  }

  await pptx.writeFile({ fileName: `${config.title.replace(/\s+/g, '_')}_${config.date}.pptx` });
}

export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  headers?: { key: string; label: string }[]
): { success: boolean; error?: string } {
  if (!data || data.length === 0) {
    return { success: false, error: 'No data to export' };
  }

  const actualHeaders = headers || Object.keys(data[0] || {}).map((key) => ({ key, label: key }));

  const escapeCSVValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const csvContent = [
    actualHeaders.map((h) => escapeCSVValue(h.label)).join(','),
    ...data.map((row) =>
      actualHeaders
        .map((h) => escapeCSVValue(row[h.key]))
        .join(',')
    ),
  ].join('\n');

  const today = new Date().toISOString().split('T')[0];
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${today}.csv`);

  return { success: true };
}

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  headers?: { key: string; label: string }[]
): void {
  exportToCSV(data, filename, headers);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'green':
    case 'success':
    case 'low':
      return COLORS.success;
    case 'amber':
    case 'warning':
    case 'medium':
    case 'moderate':
      return COLORS.warning;
    case 'red':
    case 'danger':
    case 'high':
    case 'critical':
      return COLORS.danger;
    default:
      return COLORS.text;
  }
}
