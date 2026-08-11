/**
 * PDF Service - Generates professional PDF documents for ordinances and resolutions.
 */
const PDFDocument = require('pdfkit');
const path = require('path');

function normalizePdfText(value) {
  if (value == null) return '';

  return String(value)
    .replace(/â€¢/g, '-')
    .replace(/â€“|â€”/g, '-')
    .replace(/Â/g, ' ')
    .replace(/Ð/g, '')
    .replace(/[•–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function toPlainText(value) {
  if (!value) return '';
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .split('\n')
    .map((line) => normalizePdfText(line))
    .join('\n')
    .trim();
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizePdfText(value);
    if (text) return text;
  }
  return '';
}

function resolvePdfPublicBaseUrl() {
  return pickFirstNonEmpty(
    process.env.PDF_PUBLIC_BASE_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.FRONTEND_URL
  );
}

function buildAbsoluteUrl(baseUrl, relativePath) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  const rel = String(relativePath || '').trim();
  if (!base || !rel) return '';
  return `${base}${rel.startsWith('/') ? '' : '/'}${rel}`;
}

function resolvePdfLinkValue(value) {
  const text = normalizePdfText(value);
  if (!text) return { display: '', href: '' };

  if (/^https?:\/\//i.test(text)) {
    return { display: text, href: text };
  }

  if (text.startsWith('/uploads/')) {
    const absolute = buildAbsoluteUrl(resolvePdfPublicBaseUrl(), text);
    if (absolute) {
      return { display: text, href: absolute };
    }
  }

  return { display: text, href: '' };
}

function extractMeetingRecordingUrl(rawText) {
  const text = String(rawText || '');
  if (!text.trim()) return '';

  const labeledMatch = text.match(/meeting\s+recording\s*:\s*(\S+)/i);
  if (labeledMatch && labeledMatch[1]) {
    return normalizePdfText(labeledMatch[1]);
  }

  const urlMatch = text.match(/https?:\/\/\S+/i);
  if (urlMatch && urlMatch[0]) {
    return normalizePdfText(urlMatch[0]);
  }

  return '';
}

function resolveCommitteeRecordingForPdf(docData, options = {}) {
  const committeeReport = options.committeeReport || {};

  return pickFirstNonEmpty(
    committeeReport.recording_url,
    committeeReport.meeting_recording_url,
    extractMeetingRecordingUrl(committeeReport.report_content),
    docData.meeting_recording_url,
    docData.recording_url,
    extractMeetingRecordingUrl(docData.report_content),
    extractMeetingRecordingUrl(docData.remarks)
  );
}

/**
 * Formats a date value for display in the PDF.
 * @param {string|Date|null} value
 * @returns {string}
 */
function formatDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Layout notes:
// - Increase sectionTopGap / sectionBottomGap to add more whitespace around description/body sections.
// - Increase signatureLineOffset to leave more room for handwritten signatures.
// - Increase closingSectionReserve only if the signature block starts splitting across pages again.
// - Adjust logoSize / logoGap / logoYOffset to fine-tune the header logos.
// - Lower closingSectionReserve if the signature block is moved to page 2 too early.
const PDF_LAYOUT = {
  logoSize: 64,
  logoGap: 10,
  logoYOffset: 2,
  sectionTopGap: 0.8,
  sectionHeadingGap: 0.3,
  sectionBottomGap: 0.35,
  sectionLineGap: 4,
  signatureTopGap: 1.6,
  signatureLineOffset: 64,
  signatureNameOffset: 10,
  signatureRoleOffset: 30,
  approvalTopGap: 1.8,
  approvalLineOffset: 46,
  approvalNameOffset: 12,
  approvalRoleOffset: 32,
  closingSectionReserve: 215,
  signatureImageHeight: 32,
  signatureImageVerticalGap: 6,
  signatureImageMaxWidthRatio: 0.72,
};

function resolveSignatureImagePath(signatureUrl) {
  if (!signatureUrl || typeof signatureUrl !== 'string') return null;
  if (!signatureUrl.startsWith('/uploads/')) return null;
  const relativePath = signatureUrl.replace(/^\//, '').replace(/\//g, path.sep);
  return path.join(__dirname, '..', relativePath);
}

function resolveSignatureImageSource(signature) {
  if (!signature) return null;

  if (Buffer.isBuffer(signature)) {
    return signature;
  }

  if (typeof signature === 'string') {
    return resolveSignatureImagePath(signature);
  }

  if (typeof signature === 'object') {
    const dataCandidate = signature.data || signature.e_signature_data;
    const urlCandidate = signature.url || signature.e_signature_url;

    if (Buffer.isBuffer(dataCandidate)) {
      return dataCandidate;
    }

    if (typeof dataCandidate === 'string' && dataCandidate.trim()) {
      const trimmed = dataCandidate.trim();

      // PostgreSQL bytea text format usually returns as hex string prefixed with \x.
      if (trimmed.startsWith('\\x')) {
        try {
          return Buffer.from(trimmed.slice(2), 'hex');
        } catch {
          // Ignore invalid hex payload and fall through.
        }
      }

      try {
        return Buffer.from(trimmed, 'base64');
      } catch {
        // Ignore invalid base64 payload and fall through to URL path.
      }
    }

    if (typeof urlCandidate === 'string') {
      return resolveSignatureImagePath(urlCandidate);
    }
  }

  return null;
}

function drawSignatureImage(doc, signature, x, width, lineY) {
  const signatureSource = resolveSignatureImageSource(signature);
  if (!signatureSource) return;

  const maxHeight = PDF_LAYOUT.signatureImageHeight;
  const maxWidth = width * PDF_LAYOUT.signatureImageMaxWidthRatio;
  const imageY = lineY - maxHeight - PDF_LAYOUT.signatureImageVerticalGap;
  const imageX = x + (width - maxWidth) / 2;

  try {
    doc.image(signatureSource, imageX, imageY, {
      fit: [maxWidth, maxHeight],
      align: 'center',
      valign: 'bottom',
    });
  } catch {
    // Keep PDF generation resilient when a stored image file is missing/corrupt.
  }
}

function ensureSpace(doc, neededHeight) {
  const safeBottom = doc.page.height - doc.page.margins.bottom - 28;
  if (doc.y + neededHeight > safeBottom) {
    doc.addPage();
  }
}

/**
 * Writes the common document header (logo area, locality name, divider).
 * @param {PDFDocument} doc
 * @param {string} documentType  e.g. 'ORDINANCE' or 'RESOLUTION'
 * @param {object} headerConfig
 */
function writeHeader(doc, documentType, headerConfig = {}) {
  // Add left and right logos using absolute paths for reliable rendering.
  const leftLogoPath = path.join(__dirname, '..', 'public', 'logo-left.png');
  const rightLogoPath = path.join(__dirname, '..', 'public', 'logo-right.png');
  const { logoSize, logoGap, logoYOffset } = PDF_LAYOUT;
  const { width: pageWidth, margins: { left: marginLeft, right: marginRight } } = doc.page;
  const { y } = doc;
  const logoY = y + logoYOffset;

  const republicLine = pickFirstNonEmpty(
    headerConfig.republicLine,
    process.env.PDF_REPUBLIC_LINE,
    'Republic of the Philippines'
  );
  const municipalityLine = pickFirstNonEmpty(
    headerConfig.municipality,
    process.env.PDF_MUNICIPALITY,
    process.env.PDF_CITY,
    'Municipality / City'
  );
  const barangayLine = pickFirstNonEmpty(
    headerConfig.barangay,
    process.env.PDF_BARANGAY,
    'Barangay Name'
  );
  const bodyLine = pickFirstNonEmpty(
    headerConfig.body,
    process.env.PDF_LEGISLATIVE_BODY,
    'Sangguniang Barangay'
  );

  try {
    doc.image(leftLogoPath, marginLeft, logoY, { width: logoSize, height: logoSize, align: 'left' });
  } catch {}

  try {
    const rightX = pageWidth - marginRight - logoSize;
    doc.image(rightLogoPath, rightX, logoY, { width: logoSize, height: logoSize, align: 'right' });
  } catch {}

  // Keep the locality header lines centered inside the space between both logos.
  const textX = marginLeft + logoSize + logoGap;
  const textWidth = pageWidth - marginLeft - marginRight - (logoSize + logoGap) * 2;
  const textY = y + 2;

  doc
    .fontSize(10)
    .fillColor('#444444')
    .text(republicLine, textX, textY, { align: 'center', width: textWidth })
    .text(municipalityLine, textX, doc.y, { align: 'center', width: textWidth })
    .text(barangayLine, textX, doc.y, { align: 'center', width: textWidth })
    .text(bodyLine, textX, doc.y, { align: 'center', width: textWidth });

  doc.y = Math.max(doc.y, logoY + logoSize) + 6;

  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#cccccc')
    .stroke()
    .moveDown(0.5);

  doc
    .fontSize(17)
    .fillColor('#10213a')
    .font('Helvetica-Bold')
    .text(normalizePdfText(documentType), textX, doc.y, {
      align: 'center',
      width: textWidth,
    })
    .moveDown(0.35);

  // Reset text cursor to normal content flow after absolute-position header text.
  doc.x = doc.page.margins.left;
}

function writeDocumentTitleBlock(doc, numberLabel, numberValue, title) {
  const { left, right } = doc.page.margins;
  const pageRight = doc.page.width - right;
  const contentWidth = pageRight - left;

  doc.moveDown(0.2);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#2f4765')
    .text(`${numberLabel}: ${normalizePdfText(numberValue) || 'Pending Assignment'}`, left, doc.y, {
      width: contentWidth,
      align: 'center',
    });

  doc
    .moveDown(0.25)
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#111827')
    .text(normalizePdfText(title) || 'Untitled Document', left, doc.y, {
      width: contentWidth,
      align: 'center',
      lineGap: 2,
    })
    .moveDown(0.8);
}

/**
 * Writes a labeled metadata row (bold label + regular value on the same line).
 * @param {PDFDocument} doc
 * @param {string} label
 * @param {string} value
 */
function writeMetaRow(doc, label, value) {
  const { display: resolvedValue, href } = resolvePdfLinkValue(value);
  const safeValue = resolvedValue || 'N/A';
  const { left, right } = doc.page.margins;
  const contentWidth = doc.page.width - left - right;

  if (!href) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555555')
      .text(`${label}: ${safeValue}`, left, doc.y, { width: contentWidth, align: 'justify' })
      .moveDown(0.2);
    return;
  }

  const rowY = doc.y;
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#555555')
    .text(`${label}: `, left, rowY, { continued: true });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#0f5fa8')
    .text(safeValue, {
      width: contentWidth,
      link: href,
      underline: true,
    })
    .fillColor('#555555')
    .moveDown(0.2);
}

/**
 * Writes a section heading followed by body text.
 * @param {PDFDocument} doc
 * @param {string} heading
 * @param {string} body
 */
function writeSection(doc, heading, body) {
  const plainBody = toPlainText(body);
  const { left, right } = doc.page.margins;
  const contentWidth = doc.page.width - left - right;

  doc
    .moveDown(PDF_LAYOUT.sectionTopGap)
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#10213a')
    .text(heading, left, doc.y, { width: contentWidth, align: 'left' })
    .moveDown(PDF_LAYOUT.sectionHeadingGap)
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor('#1f2937')
    .text(plainBody || 'N/A', left, doc.y, {
      width: contentWidth,
      align: 'justify',
      lineGap: PDF_LAYOUT.sectionLineGap,
    })
    .moveDown(PDF_LAYOUT.sectionBottomGap);
}

function writeSignatureBlock(doc, proposerName, officials = {}) {
  doc.moveDown(PDF_LAYOUT.signatureTopGap);

  const { left, right } = doc.page.margins;
  const pageRight = doc.page.width - right;
  const width = pageRight - left;
  const colWidth = width / 2 - 10;
  const labelY = doc.y;
  const lineY = labelY + PDF_LAYOUT.signatureLineOffset;
  const secretaryName = pickFirstNonEmpty(
    officials.secretary,
    process.env.PDF_SECRETARY_NAME,
    'Secretary'
  );
  const signatures = officials.signatures || {};

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#111827')
    .text('Prepared / Proposed by:', left, labelY, { width: colWidth })
    .text('Certified by:', left + colWidth + 20, labelY, { width: colWidth });

  doc
    .moveTo(left, lineY)
    .lineTo(left + colWidth, lineY)
    .strokeColor('#8ca0b8')
    .stroke();

  doc
    .moveTo(left + colWidth + 20, lineY)
    .lineTo(left + colWidth + 20 + colWidth, lineY)
    .strokeColor('#8ca0b8')
    .stroke();

  drawSignatureImage(doc, signatures.proposer, left, colWidth, lineY);
  drawSignatureImage(doc, signatures.secretary, left + colWidth + 20, colWidth, lineY);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1f2937')
    .text(normalizePdfText(proposerName) || 'Name / Signature', left, lineY + PDF_LAYOUT.signatureNameOffset, {
      width: colWidth,
      align: 'center',
    })
    .text(secretaryName, left + colWidth + 20, lineY + PDF_LAYOUT.signatureNameOffset, {
      width: colWidth,
      align: 'center',
    })
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5563')
    .text('Author / Proponent', left, lineY + PDF_LAYOUT.signatureRoleOffset, {
      width: colWidth,
      align: 'center',
    })
    .text('Secretary', left + colWidth + 20, lineY + PDF_LAYOUT.signatureRoleOffset, {
      width: colWidth,
      align: 'center',
    });
}

function writeEnactmentAndApprovalBlocks(doc, officials = {}) {
  doc.moveDown(PDF_LAYOUT.approvalTopGap);

  const { left, right } = doc.page.margins;
  const pageRight = doc.page.width - right;
  const width = pageRight - left;
  const colWidth = width / 3 - 8;
  const startY = doc.y;
  const lineY = startY + PDF_LAYOUT.approvalLineOffset;

  const viceMayorName = pickFirstNonEmpty(
    officials.viceMayor,
    process.env.PDF_VICE_MAYOR_NAME,
    'Vice Mayor'
  );
  const secretaryName = pickFirstNonEmpty(
    officials.secretary,
    process.env.PDF_SECRETARY_NAME,
    'Secretary'
  );
  const mayorName = pickFirstNonEmpty(
    officials.mayor,
    process.env.PDF_MAYOR_NAME,
    'Mayor'
  );
  const signatures = officials.signatures || {};

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#10213a')
    .text('ENACTED BY:', left, startY, { width: colWidth, align: 'center' })
    .text('ATTESTED BY:', left + colWidth + 12, startY, { width: colWidth, align: 'center' })
    .text('APPROVED BY:', left + 2 * (colWidth + 12), startY, { width: colWidth, align: 'center' });

  for (let i = 0; i < 3; i += 1) {
    const x = left + i * (colWidth + 12);
    doc
      .moveTo(x, lineY)
      .lineTo(x + colWidth, lineY)
      .strokeColor('#8ca0b8')
      .lineWidth(1)
      .stroke();
  }

  drawSignatureImage(doc, signatures.viceMayor, left, colWidth, lineY);
  drawSignatureImage(doc, signatures.secretary, left + colWidth + 12, colWidth, lineY);
  drawSignatureImage(doc, signatures.mayor, left + 2 * (colWidth + 12), colWidth, lineY);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1f2937')
    .text(normalizePdfText(viceMayorName), left, lineY + PDF_LAYOUT.approvalNameOffset, { width: colWidth, align: 'center' })
    .text(normalizePdfText(secretaryName), left + colWidth + 12, lineY + PDF_LAYOUT.approvalNameOffset, { width: colWidth, align: 'center' })
    .text(normalizePdfText(mayorName), left + 2 * (colWidth + 12), lineY + PDF_LAYOUT.approvalNameOffset, { width: colWidth, align: 'center' })
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5563')
    .text('Presiding Officer', left, lineY + PDF_LAYOUT.approvalRoleOffset, { width: colWidth, align: 'center' })
    .text('Secretary', left + colWidth + 12, lineY + PDF_LAYOUT.approvalRoleOffset, { width: colWidth, align: 'center' })
    .text('Municipal / City Mayor', left + 2 * (colWidth + 12), lineY + PDF_LAYOUT.approvalRoleOffset, {
      width: colWidth,
      align: 'center',
    });
}

function writeClosingSignatureSection(doc, proposerName, officials = {}) {
  // Keep both closing blocks together so officer names never split across pages.
  ensureSpace(doc, PDF_LAYOUT.closingSectionReserve);
  writeSignatureBlock(doc, proposerName, officials);
  writeEnactmentAndApprovalBlocks(doc, officials);
}

/**
 * Writes the common document footer on each page.
 * @param {PDFDocument} doc
 */
function writeFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);

    const footerText = `Generated by E-Legislative Monitoring System - Page ${i + 1} of ${pages.count}`;
    const footerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const originalBottomMargin = doc.page.margins.bottom;

    doc.font('Helvetica').fontSize(8);

    // Keep footer at the visual bottom while ensuring text box stays within the page.
    const footerTextHeight = doc.heightOfString(footerText, { width: footerWidth, lineBreak: false });
    const footerBottomInset = 8;
    const footerY = doc.page.height - footerBottomInset - footerTextHeight;

    // PDFKit enforces bottom margin for text flow. Temporarily relax it so footer can
    // render inside the physical bottom area without triggering an extra page.
    doc.page.margins.bottom = 0;

    doc
      .moveTo(doc.page.margins.left, footerY - 4)
      .lineTo(doc.page.width - doc.page.margins.right, footerY - 4)
      .strokeColor('#cccccc')
      .stroke();

    doc
      .fillColor('#999999')
      .text(
        footerText,
        doc.page.margins.left,
        footerY,
        {
          align: 'center',
          width: footerWidth,
          lineBreak: false,
        }
      );

    doc.page.margins.bottom = originalBottomMargin;
  }
}

/**
 * Generates a PDF for an ordinance and pipes it to the provided writable stream.
 * @param {object} ordinance  - Ordinance record from the database
 * @param {import('stream').Writable} stream - Destination stream (e.g. HTTP response)
 */
function generateOrdinancePdf(ordinance, stream, options = {}) {
  const doc = new PDFDocument({
    // Long bond paper: 8.5 x 13 inches
    size: [612, 936],
    margins: { top: 60, left: 60, right: 60, bottom: 92 },
    bufferPages: true,
  });
  doc.pipe(stream);

  writeHeader(doc, 'BARANGAY ORDINANCE', options.header);

  writeDocumentTitleBlock(
    doc,
    'Ordinance Number',
    ordinance.ordinance_number,
    toPlainText(ordinance.title)
  );

  // Metadata block
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#eeeeee')
    .stroke()
    .moveDown(0.4);

  writeMetaRow(doc, 'Status', ordinance.status);
  writeMetaRow(doc, 'Proposed By', ordinance.proposer_name || 'N/A');
  // Co-authors
  if (Array.isArray(ordinance.co_authors) && ordinance.co_authors.length > 0) {
    const coAuthorNames = ordinance.co_authors
      .map((c) => normalizePdfText(c?.name))
      .filter(Boolean)
      .join(', ');
    writeMetaRow(doc, 'Co-authors', coAuthorNames);
  }
  writeMetaRow(doc, 'Date Created', formatDate(ordinance.created_at));
  if (ordinance.approved_date) {
    writeMetaRow(doc, 'Date Approved', formatDate(ordinance.approved_date));
  }
  if (ordinance.published_date) {
    writeMetaRow(doc, 'Date Published', formatDate(ordinance.published_date));
  }

  doc
    .moveDown(0.4)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#eeeeee')
    .stroke();

  // Sections
  if (ordinance.description) {
    writeSection(doc, 'Purpose / Description', ordinance.description);
  }

  writeSection(doc, 'Body of Ordinance', ordinance.content);

  if (ordinance.remarks) {
    writeSection(doc, 'Remarks', ordinance.remarks);
  }

  writeClosingSignatureSection(doc, ordinance.proposer_name, options.officials);

  writeFooter(doc);
  doc.end();
}

/**
 * Generates a PDF for a resolution and pipes it to the provided writable stream.
 * @param {object} resolution  - Resolution record from the database
 * @param {import('stream').Writable} stream - Destination stream (e.g. HTTP response)
 */
function generateResolutionPdf(resolution, stream, options = {}) {
  const doc = new PDFDocument({
    // Long bond paper: 8.5 x 13 inches
    size: [612, 936],
    margins: { top: 60, left: 60, right: 60, bottom: 92 },
    bufferPages: true,
  });
  doc.pipe(stream);

  writeHeader(doc, 'BARANGAY RESOLUTION', options.header);

  writeDocumentTitleBlock(
    doc,
    'Resolution Number',
    resolution.resolution_number,
    toPlainText(resolution.title)
  );

  // Metadata block
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#eeeeee')
    .stroke()
    .moveDown(0.4);

  writeMetaRow(doc, 'Status', resolution.status);
  writeMetaRow(doc, 'Proposed By', resolution.proposer_name || 'N/A');
  if (Array.isArray(resolution.co_authors) && resolution.co_authors.length > 0) {
    const coAuthorNames = resolution.co_authors
      .map((c) => normalizePdfText(c?.name))
      .filter(Boolean)
      .join(', ');
    writeMetaRow(doc, 'Co-authors', coAuthorNames);
  }
  writeMetaRow(doc, 'Date Created', formatDate(resolution.created_at));
  if (resolution.approved_date) {
    writeMetaRow(doc, 'Date Approved', formatDate(resolution.approved_date));
  }
  if (resolution.published_date) {
    writeMetaRow(doc, 'Date Published', formatDate(resolution.published_date));
  }

  doc
    .moveDown(0.4)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#eeeeee')
    .stroke();

  // Sections
  if (resolution.description) {
    writeSection(doc, 'Purpose / Description', resolution.description);
  }

  writeSection(doc, 'Body of Resolution', resolution.content);

  if (resolution.remarks) {
    writeSection(doc, 'Notes', resolution.remarks);
  }

  writeClosingSignatureSection(doc, resolution.proposer_name, options.officials);

  writeFooter(doc);
  doc.end();
}

/**
 * Generates a PDF for the Order of Business (agenda) of a session.
 * @param {object} session - Session record with title, date, etc.
 * @param {object[]} items - Array of order-of-business items sorted by item_number
 * @param {import('stream').Writable} stream - Destination stream (e.g. HTTP response)
 */
function generateOrderOfBusinessPdf(doc, items, stream) {
  const pdfDoc = new PDFDocument({
    // Long bond paper: 8.5 x 13 inches
    size: [612, 936],
    margin: 60,
    bufferPages: true,
  });
  pdfDoc.pipe(stream);

  writeHeader(pdfDoc, 'ORDER OF BUSINESS');

  // Document title
  pdfDoc
    .moveDown(0.5)
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#1a1a2e')
    .text(doc.title || 'Untitled Order of Business', { align: 'center' })
    .moveDown(0.4);

  // Divider
  pdfDoc
    .moveTo(pdfDoc.page.margins.left, pdfDoc.y)
    .lineTo(pdfDoc.page.width - pdfDoc.page.margins.right, pdfDoc.y)
    .strokeColor('#eeeeee')
    .stroke()
    .moveDown(0.4);

  // Document metadata
  if (doc.date) {
    writeMetaRow(pdfDoc, 'Date', formatDate(doc.date));
  }
  if (doc.time) {
    writeMetaRow(pdfDoc, 'Time', doc.time);
  }
  if (doc.venue) {
    writeMetaRow(pdfDoc, 'Venue', doc.venue);
  }
  if (doc.presiding_officer) {
    writeMetaRow(pdfDoc, 'Presiding Officer', doc.presiding_officer);
  }
  if (doc.secretary) {
    writeMetaRow(pdfDoc, 'Secretary', doc.secretary);
  }
  writeMetaRow(pdfDoc, 'Total Agenda Items', String(items.length));

  pdfDoc
    .moveDown(0.4)
    .moveTo(pdfDoc.page.margins.left, pdfDoc.y)
    .lineTo(pdfDoc.page.width - pdfDoc.page.margins.right, pdfDoc.y)
    .strokeColor('#eeeeee')
    .stroke()
    .moveDown(0.6);

  // Agenda items
  items.forEach((item, index) => {
    const num = item.item_number ?? index + 1;

    pdfDoc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1a1a2e')
      .text(`${num}. ${item.title}`, { continued: false });

    // Item details line
    const details = [];
    if (item.item_type) details.push(`Type: ${item.item_type}`);
    if (item.status) details.push(`Status: ${item.status}`);
    if (item.duration_minutes) details.push(`Duration: ${item.duration_minutes} min`);

    if (details.length > 0) {
      pdfDoc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#666666')
        .text(details.join('  |  '))
        .moveDown(0.1);
    }

    // Linked document
    if (item.related_document_type) {
      let linkedLabel = '';
      if (item.related_document_type === 'ordinance' && item.ordinance_title) {
        linkedLabel = `Linked Ordinance: ${item.ordinance_title}${item.ordinance_number ? ` (No. ${item.ordinance_number})` : ''}`;
      } else if (item.related_document_type === 'resolution' && item.resolution_title) {
        linkedLabel = `Linked Resolution: ${item.resolution_title}${item.resolution_number ? ` (No. ${item.resolution_number})` : ''}`;
      }
      if (linkedLabel) {
        pdfDoc
          .font('Helvetica-Oblique')
          .fontSize(9)
          .fillColor('#888888')
          .text(linkedLabel)
          .moveDown(0.1);
      }
    }

    // Notes
    if (item.notes) {
      pdfDoc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555555')
        .text(`Notes: ${item.notes}`)
        .moveDown(0.1);
    }

    pdfDoc.moveDown(0.4);
  });

  writeFooter(pdfDoc);
  pdfDoc.end();
}

module.exports = { generateOrdinancePdf, generateResolutionPdf, generateOrderOfBusinessPdf };
