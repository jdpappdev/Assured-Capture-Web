import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  PageBreak,
} from 'docx';
import type { Report, Issue, Photo, ReportStatus } from '../types';

/**
 * Image processing result for DOCX embedding.
 */
interface ProcessedImageResult {
  data: Uint8Array;
  width: number;
  height: number;
  type: 'jpg' | 'png';
}

/**
 * Converts a data URL or image URL into a high-quality, aspect-ratio-preserved
 * Uint8Array image for Microsoft Word (.docx) embedding.
 *
 * It uses an offscreen canvas in the browser to:
 * 1. Accurately measure naturalWidth and naturalHeight.
 * 2. Calculate proportional dimensions preserving the exact aspect ratio (no distortion).
 * 3. Normalize the output to valid JPEG binary data, preventing OpenXML corruptions.
 */
async function processImageForDocx(
  imageFile: string,
  maxWidth = 440,
  maxHeight = 310
): Promise<ProcessedImageResult | null> {
  if (!imageFile) return null;

  // Browser HTML Image loader with canvas normalization
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const cleanupAndResolveFallback = () => {
        try {
          if (imageFile.startsWith('data:')) {
            const parts = imageFile.split(',');
            if (parts.length >= 2) {
              const base64 = parts[1];
              const binaryStr = atob(base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const isPng = imageFile.includes('image/png');
              resolve({
                data: bytes,
                width: 400,
                height: 270,
                type: isPng ? 'png' : 'jpg',
              });
              return;
            }
          }
        } catch (e) {
          console.warn('Direct fallback bytes extraction failed:', e);
        }
        resolve(null);
      };

      img.onload = () => {
        try {
          const natW = img.naturalWidth || 800;
          const natH = img.naturalHeight || 600;

          // Compute exact proportional dimensions
          let targetW = maxWidth;
          let targetH = Math.round((maxWidth * natH) / natW);

          if (targetH > maxHeight) {
            targetH = maxHeight;
            targetW = Math.round((maxHeight * natW) / natH);
          }

          // Offscreen canvas for JPEG normalization
          const canvas = document.createElement('canvas');
          canvas.width = natW;
          canvas.height = natH;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanupAndResolveFallback();
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0);

          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const parts = jpegDataUrl.split(',');
          if (parts.length < 2) {
            cleanupAndResolveFallback();
            return;
          }

          const base64 = parts[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          resolve({
            data: bytes,
            width: targetW,
            height: targetH,
            type: 'jpg',
          });
        } catch (canvasErr) {
          console.warn('Canvas rendering error for DOCX image:', canvasErr);
          cleanupAndResolveFallback();
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image for DOCX export, attempting direct bytes');
        cleanupAndResolveFallback();
      };

      img.src = imageFile;
    } catch (err) {
      console.warn('Unexpected error in processImageForDocx:', err);
      resolve(null);
    }
  });
}

function formatDate(isoString?: string): string {
  if (!isoString) return 'Not Specified';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return 'Not Specified';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Standard table borders for executive inspection report.
 */
const BORDER_LIGHT = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: 'CBD5E1', // slate-300
};

const BORDER_NAVY = {
  style: BorderStyle.SINGLE,
  size: 2,
  color: '1E3A8A', // blue-900
};

const BORDER_NONE = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'auto',
};

function getStatusColors(status: ReportStatus): { text: string; bg: string } {
  switch (status) {
    case 'Completed':
      return { text: '166534', bg: 'DCFCE7' }; // Green
    case 'In Progress':
      return { text: '1E40AF', bg: 'DBEAFE' }; // Blue
    case 'Awaiting Review':
      return { text: '92400E', bg: 'FEF3C7' }; // Amber
    case 'Sent to Client':
      return { text: '6B21A8', bg: 'F3E8FF' }; // Purple
    case 'Draft':
    default:
      return { text: '374151', bg: 'F3F4F6' }; // Slate Gray
  }
}

const PAGE_CONTENT_WIDTH = 9600; // 9600 twips = 6.67 inches. Standard printable width across Letter and A4

/**
 * Exports a comprehensive, beautifully formatted, professional photo report into a Microsoft Word (.docx) document.
 */
export async function exportReportToDocx(
  report: Report,
  issuesWithPhotos: Array<{ issue: Issue; photos: Photo[] }>
): Promise<void> {
  const children: Array<Paragraph | Table> = [];

  // Calculate totals
  const totalIssues = issuesWithPhotos.length;
  const totalPhotos = issuesWithPhotos.reduce((sum, item) => sum + item.photos.length, 0);
  const statusColors = getStatusColors(report.status);

  // ==========================================
  // 1. EXECUTIVE REPORT BANNER & COVER SECTION
  // ==========================================
  const bannerTable = new Table({
    width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_CONTENT_WIDTH],
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
            shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
            margins: { top: 220, bottom: 220, left: 240, right: 240 },
            borders: {
              top: BORDER_NONE,
              bottom: BORDER_NONE,
              left: BORDER_NONE,
              right: BORDER_NONE,
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: 'FIELD CONDITION & DEFECT AUDIT REPORT',
                    bold: true,
                    size: 18,
                    color: '93C5FD', // Light blue accent
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: report.reportName || 'Comprehensive Site Inspection',
                    bold: true,
                    size: 32, // 16pt
                    color: 'FFFFFF',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `JOB REFERENCE: ${report.jobReference || 'BBC-26-01'}`,
                    bold: true,
                    size: 20,
                    color: 'FCD34D', // Amber gold
                  }),
                  new TextRun({
                    text: '   |   ',
                    size: 20,
                    color: '93C5FD',
                  }),
                  new TextRun({
                    text: `STATUS: ${report.status.toUpperCase()}`,
                    bold: true,
                    size: 20,
                    color: 'FFFFFF',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(bannerTable);

  // Spacing after header
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // ==========================================
  // 2. PROJECT & SITE OVERVIEW TABLE
  // ==========================================
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [
        new TextRun({
          text: 'PROJECT & SITE SPECIFICATIONS',
          bold: true,
          size: 22,
          color: '1E3A8A',
        }),
      ],
    })
  );

  const createMetaRow = (
    label1: string,
    value1: string,
    label2: string,
    value2: string,
    isHighlighted = false
  ) =>
    new TableRow({
      children: [
        // Label 1
        new TableCell({
          width: { size: 2000, type: WidthType.DXA },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 90, bottom: 90, left: 140, right: 140 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: label1, bold: true, size: 18, color: '334155' }),
              ],
            }),
          ],
        }),
        // Value 1
        new TableCell({
          width: { size: 2800, type: WidthType.DXA },
          shading: isHighlighted ? { fill: statusColors.bg, type: ShadingType.CLEAR } : undefined,
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 90, bottom: 90, left: 140, right: 140 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value1 || 'N/A',
                  bold: isHighlighted,
                  size: 18,
                  color: isHighlighted ? statusColors.text : '0F172A',
                }),
              ],
            }),
          ],
        }),
        // Label 2
        new TableCell({
          width: { size: 2000, type: WidthType.DXA },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 90, bottom: 90, left: 140, right: 140 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: label2, bold: true, size: 18, color: '334155' }),
              ],
            }),
          ],
        }),
        // Value 2
        new TableCell({
          width: { size: 2800, type: WidthType.DXA },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 90, bottom: 90, left: 140, right: 140 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: value2 || 'N/A', size: 18, color: '0F172A' }),
              ],
            }),
          ],
        }),
      ],
    });

  const metaTable = new Table({
    width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2000, 2800, 2000, 2800],
    alignment: AlignmentType.CENTER,
    rows: [
      createMetaRow('Job Reference', report.jobReference, 'Current Status', report.status, true),
      createMetaRow('Client Name', report.clientName || 'Not Specified', 'Inspection Date', formatDate(report.inspectionDate)),
      createMetaRow('Report Title', report.reportName, 'Report Issue Date', formatDate(report.reportDate)),
      createMetaRow(
        'Total Defect Items',
        `${totalIssues} ${totalIssues === 1 ? 'Defect' : 'Defects'}`,
        'Total Photo Evidence',
        `${totalPhotos} ${totalPhotos === 1 ? 'Photograph' : 'Photographs'}`
      ),
      // Site Address (Spanning full width)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Site Address', bold: true, size: 18, color: '334155' }),
                ],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 3,
            width: { size: 7600, type: WidthType.DXA },
            borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: report.address || 'Site address not provided',
                    size: 18,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(metaTable);

  // Inspection Date Revision History (if multiple inspection dates were recorded)
  if (report.inspectionDateHistory && report.inspectionDateHistory.length > 0) {
    children.push(new Paragraph({ spacing: { before: 140, after: 60 } }));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Inspection Date Revision Log:',
            bold: true,
            size: 16,
            color: '64748B',
          }),
        ],
      })
    );

    const historyRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: 'Revised Inspection Date', bold: true, size: 16 })] })],
          }),
          new TableCell({
            width: { size: 6000, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: 'Audit Timestamp', bold: true, size: 16 })] })],
          }),
        ],
      }),
      ...report.inspectionDateHistory.map(
        (h) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 3600, type: WidthType.DXA },
                borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: formatDate(h.date), size: 16 })] })],
              }),
              new TableCell({
                width: { size: 6000, type: WidthType.DXA },
                borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: formatDateTime(h.changedAt), size: 16, color: '64748B' })] })],
              }),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [3600, 6000],
        alignment: AlignmentType.CENTER,
        rows: historyRows,
      })
    );
  }

  // ==========================================
  // 3. EXECUTIVE SUMMARY OF DEFECT FINDINGS
  // ==========================================
  children.push(new Paragraph({ spacing: { before: 240, after: 100 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'SUMMARY OF RECORDED DEFECTS & FINDINGS',
          bold: true,
          size: 22,
          color: '1E3A8A',
        }),
      ],
    })
  );

  if (totalIssues === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 180 },
        children: [
          new TextRun({
            text: 'No defect items or observations were recorded in this inspection report.',
            italics: true,
            size: 18,
            color: '64748B',
          }),
        ],
      })
    );
  } else {
    const summaryHeaderRow = new TableRow({
      children: [
        new TableCell({
          width: { size: 1100, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'ITEM', bold: true, size: 17, color: 'FFFFFF' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 3100, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'DEFECT TITLE', bold: true, size: 17, color: 'FFFFFF' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 4200, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'OBSERVATIONS SUMMARY', bold: true, size: 17, color: 'FFFFFF' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1200, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'PHOTOS', bold: true, size: 17, color: 'FFFFFF' })],
            }),
          ],
        }),
      ],
    });

    const summaryRows = [
      summaryHeaderRow,
      ...issuesWithPhotos.map((item, idx) => {
        const bg = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
        const descPreview = item.issue.issueDescription
          ? item.issue.issueDescription.length > 90
            ? `${item.issue.issueDescription.substring(0, 87)}...`
            : item.issue.issueDescription
          : 'No detailed description provided.';

        return new TableRow({
          children: [
            new TableCell({
              width: { size: 1100, type: WidthType.DXA },
              shading: { fill: bg, type: ShadingType.CLEAR },
              borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `#${item.issue.issueNumber}`, bold: true, size: 18, color: '1E3A8A' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3100, type: WidthType.DXA },
              shading: { fill: bg, type: ShadingType.CLEAR },
              borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.issue.issueName || 'Untitled Issue',
                      bold: true,
                      size: 18,
                      color: '0F172A',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4200, type: WidthType.DXA },
              shading: { fill: bg, type: ShadingType.CLEAR },
              borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: descPreview,
                      size: 17,
                      color: '475569',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1200, type: WidthType.DXA },
              shading: { fill: bg, type: ShadingType.CLEAR },
              borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `${item.photos.length} ${item.photos.length === 1 ? 'pic' : 'pics'}`,
                      bold: true,
                      size: 17,
                      color: item.photos.length > 0 ? '166534' : '94A3B8',
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }),
    ];

    children.push(
      new Table({
        width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [1100, 3100, 4200, 1200],
        alignment: AlignmentType.CENTER,
        rows: summaryRows,
      })
    );
  }

  // Section divider page break: Start Detailed Photo Sheets cleanly
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ==========================================
  // 4. DETAILED DEFECT ITEMS & PHOTO EVIDENCE SHEETS
  // ==========================================
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 120 },
      children: [
        new TextRun({
          text: 'DETAILED DEFECT AUDIT & PHOTOGRAPHIC EVIDENCE',
          bold: true,
          size: 24,
          color: '1E3A8A',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'The following sheets provide comprehensive photographic defect documentation, site observations, and itemized reference notes.',
          italics: true,
          size: 17,
          color: '64748B',
        }),
      ],
    })
  );

  for (const item of issuesWithPhotos) {
    const { issue, photos } = item;
    // Ensure primary reference photographs appear first, followed by supporting photos in chronological order
    const sortedPhotos = [...photos].sort((a, b) => {
      if (a.isReferenceImage && !b.isReferenceImage) return -1;
      if (!a.isReferenceImage && b.isReferenceImage) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Issue Header Card
    const issueHeaderTable = new Table({
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [7400, 2200],
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 7400, type: WidthType.DXA },
              shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
              margins: { top: 110, bottom: 110, left: 140, right: 140 },
              borders: {
                top: BORDER_NAVY,
                bottom: BORDER_NAVY,
                left: BORDER_NAVY,
                right: BORDER_NAVY,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `DEFECT #${issue.issueNumber}:  `,
                      bold: true,
                      size: 20,
                      color: 'FCD34D', // Gold accent
                    }),
                    new TextRun({
                      text: (issue.issueName || 'Untitled Issue').toUpperCase(),
                      bold: true,
                      size: 20,
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: '0F172A', type: ShadingType.CLEAR }, // Deep charcoal
              margins: { top: 110, bottom: 110, left: 140, right: 140 },
              borders: {
                top: BORDER_NAVY,
                bottom: BORDER_NAVY,
                left: BORDER_NAVY,
                right: BORDER_NAVY,
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `${photos.length} Photo${photos.length === 1 ? '' : 's'}`,
                      bold: true,
                      size: 18,
                      color: '93C5FD',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    children.push(issueHeaderTable);

    // Defect Description Card Callout
    const descriptionBox = new Table({
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [PAGE_CONTENT_WIDTH],
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              margins: { top: 110, bottom: 110, left: 140, right: 140 },
              borders: {
                top: BORDER_LIGHT,
                bottom: BORDER_LIGHT,
                left: { style: BorderStyle.SINGLE, size: 6, color: '2563EB' }, // Blue accent bar
                right: BORDER_LIGHT,
              },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: 'DEFECT OBSERVATIONS & SITE NOTES',
                      bold: true,
                      size: 17,
                      color: '1E3A8A',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: issue.issueDescription || 'No specific observation notes provided for this item.',
                      size: 19,
                      color: '1E293B',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    children.push(descriptionBox);

    // Photographic Evidence Grid
    if (photos.length === 0) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 220 },
          children: [
            new TextRun({
              text: 'No photographs were recorded for this defect item.',
              italics: true,
              size: 17,
              color: '94A3B8',
            }),
          ],
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { before: 140, after: 100 },
          children: [
            new TextRun({
              text: `Photographic Evidence Records (${photos.length}):`,
              bold: true,
              size: 18,
              color: '334155',
            }),
          ],
        })
      );

      for (let pIdx = 0; pIdx < sortedPhotos.length; pIdx++) {
        const photo = sortedPhotos[pIdx];
        const processedImg = await processImageForDocx(photo.imageFile, 460, 310);

        // Build a structured, high-polish photo card table that won't split awkwardly
        const photoCardRows: TableRow[] = [];

        // Row 1: Photo Meta Banner (Photo Number & Reference Flag)
        photoCardRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
                shading: { fill: photo.isReferenceImage ? 'FEF3C7' : 'F1F5F9', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                borders: {
                  top: photo.isReferenceImage ? { style: BorderStyle.SINGLE, size: 2, color: 'D97706' } : BORDER_LIGHT,
                  bottom: BORDER_LIGHT,
                  left: BORDER_LIGHT,
                  right: BORDER_LIGHT,
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `PHOTO ${pIdx + 1} OF ${photos.length} `,
                        bold: true,
                        size: 18,
                        color: '1E293B',
                      }),
                      photo.isReferenceImage
                        ? new TextRun({
                            text: '  ★ PRIMARY REFERENCE IMAGE  ',
                            bold: true,
                            size: 17,
                            color: 'B45309', // Amber-700
                          })
                        : new TextRun({ text: '' }),
                      new TextRun({
                        text: `[Item #${issue.issueNumber}]`,
                        size: 16,
                        color: '64748B',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );

        // Row 2: Image Canvas Box
        if (processedImg) {
          const imageRun = new ImageRun({
            data: processedImg.data,
            type: processedImg.type,
            transformation: {
              width: processedImg.width,
              height: processedImg.height,
            },
          });

          photoCardRows.push(
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
                  shading: { fill: 'FAFAFA', type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 120, right: 120 },
                  borders: {
                    top: BORDER_NONE,
                    bottom: BORDER_LIGHT,
                    left: BORDER_LIGHT,
                    right: BORDER_LIGHT,
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [imageRun],
                    }),
                  ],
                }),
              ],
            })
          );
        } else {
          photoCardRows.push(
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
                  margins: { top: 120, bottom: 120, left: 120, right: 120 },
                  borders: {
                    top: BORDER_NONE,
                    bottom: BORDER_LIGHT,
                    left: BORDER_LIGHT,
                    right: BORDER_LIGHT,
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: '[Photograph preview unavailable]',
                          italics: true,
                          size: 18,
                          color: '94A3B8',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          );
        }

        // Row 3: Caption & Defect Notes
        photoCardRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
                shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
                margins: { top: 90, bottom: 110, left: 120, right: 120 },
                borders: {
                  top: BORDER_NONE,
                  bottom: BORDER_LIGHT,
                  left: BORDER_LIGHT,
                  right: BORDER_LIGHT,
                },
                children: [
                  new Paragraph({
                    spacing: { after: 40 },
                    children: [
                      new TextRun({
                        text: 'Defect Observation Note: ',
                        bold: true,
                        size: 17,
                        color: '334155',
                      }),
                      new TextRun({
                        text: photo.description || 'Inspection condition photograph recorded on site.',
                        size: 18,
                        color: '0F172A',
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Recorded: ${formatDateTime(photo.createdAt)}   |   Job Reference: ${report.jobReference}`,
                        size: 15,
                        color: '64748B',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );

        const photoCardTable = new Table({
          width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [PAGE_CONTENT_WIDTH],
          alignment: AlignmentType.CENTER,
          rows: photoCardRows,
        });

        children.push(photoCardTable);
        children.push(new Paragraph({ spacing: { after: 180 } }));
      }
    }

    // Space between defect issues
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ==========================================
  // 5. SIGN-OFF & CERTIFICATION DECLARATION
  // ==========================================
  children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'REPORT CERTIFICATION & PROFESSIONAL SIGN-OFF',
          bold: true,
          size: 22,
          color: '1E3A8A',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text:
            'I hereby verify and certify that this report provides a true, professional, and objective record of conditions observed during the physical site survey conducted on the stated inspection date.',
          italics: true,
          size: 17,
          color: '475569',
        }),
      ],
    })
  );

  const signoffTable = new Table({
    width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [4800, 4800],
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          // Inspector Column
          new TableCell({
            width: { size: 4800, type: WidthType.DXA },
            borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: 'PREPARED BY (INSPECTOR):',
                    bold: true,
                    size: 18,
                    color: '1E3A8A',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: 'Assigned Inspector / Condition Surveyor',
                    size: 17,
                    color: '334155',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `Site: ${report.address || 'Standard Location'}`,
                    size: 16,
                    color: '64748B',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 180, after: 40 },
                children: [
                  new TextRun({
                    text: 'Signature: _________________________________',
                    size: 18,
                    color: '334155',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Inspection Date: ${formatDate(report.inspectionDate)}`,
                    bold: true,
                    size: 17,
                    color: '1E293B',
                  }),
                ],
              }),
            ],
          }),
          // Reviewer Column
          new TableCell({
            width: { size: 4800, type: WidthType.DXA },
            borders: { top: BORDER_LIGHT, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 160, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: 'REVIEWED & ACCEPTED BY:',
                    bold: true,
                    size: 18,
                    color: '1E3A8A',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: `Client: ${report.clientName || 'Client Representative'}`,
                    size: 17,
                    color: '334155',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `Report Reference: ${report.jobReference}`,
                    size: 16,
                    color: '64748B',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 180, after: 40 },
                children: [
                  new TextRun({
                    text: 'Signature: _________________________________',
                    size: 18,
                    color: '334155',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Date: ${formatDate(report.reportDate)}   |   Status: ${report.status}`,
                    bold: true,
                    size: 17,
                    color: '1E293B',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  children.push(signoffTable);

  // ==========================================
  // 6. BUILD DOCUMENT WITH HEADERS & FOOTERS
  // ==========================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1100,
              right: 1100,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: 'SITE INSPECTION & DEFECT PHOTO AUDIT  |  ',
                    bold: true,
                    size: 16,
                    color: '64748B',
                  }),
                  new TextRun({
                    text: `${report.jobReference} — ${report.reportName || 'Condition Survey'}`,
                    size: 16,
                    color: '1E3A8A',
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.BOTH,
                children: [
                  new TextRun({
                    text: `CONFIDENTIAL  •  ${report.address || 'Site Inspection Record'}`,
                    size: 15,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    text: '\tPage ',
                    size: 15,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 15,
                    color: '64748B',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 15,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 15,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  // ==========================================
  // 7. GENERATE BLOB & TRIGGER FILE DOWNLOAD
  // ==========================================
  const blob = await Packer.toBlob(doc);
  const cleanRef = (report.jobReference || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTitle = (report.reportName || 'Inspection').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanRef}-${cleanTitle}_Photo_Report.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
