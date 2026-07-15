/**
 * PDF Service - Generates professional PDF documents for ordinances and resolutions.
 */
const PDFDocument = require('pdfkit');
const path = require('path');

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
    .trim();
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
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
  const logoSize = 58;
  const logoGap = 12;
  const { width: pageWidth, margins: { left: marginLeft, right: marginRight } } = doc.page;
  const { y } = doc;
  const logoY = y + 4;

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
    doc
      .rect(marginLeft - 2, logoY - 2, logoSize + 4, logoSize + 4)
      .lineWidth(0.6)
      .strokeColor('#cdd7e2')
      .stroke();
  } catch {}

  try {
    const rightX = pageWidth - marginRight - logoSize;
    doc.image(rightLogoPath, rightX, logoY, { width: logoSize, height: logoSize, align: 'right' });
    doc
      .rect(rightX - 2, logoY - 2, logoSize + 4, logoSize + 4)
      .lineWidth(0.6)
      .strokeColor('#cdd7e2')
      .stroke();
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
    .text(documentType, { align: 'center' })
    .moveDown(0.35);
}

function writeDocumentTitleBlock(doc, numberLabel, numberValue, title) {
  const { left, right } = doc.page.margins;
  const pageRight = doc.page.width - right;

  doc
    .roundedRect(left, doc.y, pageRight - left, 78, 6)
    .lineWidth(1)
    .strokeColor('#cfd7e3')
    .stroke();

  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#2f4765')
    .text(`${numberLabel}: ${numberValue || 'Pending Assignment'}`, {
      align: 'center',
    });

  doc
    .moveDown(0.25)
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#111827')
    .text(title || 'Untitled Document', {
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
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#333333')
    .text(`${label}: `, { continued: true })
    .font('Helvetica')
    .fillColor('#555555')
    .text(value || 'N/A')
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
  doc
    .moveDown(0.6)
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#10213a')
    .text(heading)
    .moveDown(0.2)
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor('#1f2937')
    .text(plainBody || 'N/A', {
      align: 'justify',
      lineGap: 3,
    })
    .moveDown(0.2);
}

function writeSignatureBlock(doc, proposerName) {
  doc.moveDown(1.3);

  const { left, right } = doc.page.margins;
  const pageRight = doc.page.width - right;
  const width = pageRight - left;
  const colWidth = width / 2 - 10;
  const lineY = doc.y + 34;

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#111827')
    .text('Prepared / Proposed by:', left, doc.y, { width: colWidth })
    .text('Certified by:', left + colWidth + 20, doc.y - 12, { width: colWidth });

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

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1f2937')
    .text(proposerName || 'Name / Signature', left, lineY + 4, {
      width: colWidth,
      align: 'center',
    })
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5563')
    .text('Author / Proponent', left, lineY + 18, {
      width: colWidth,
      align: 'center',
    })
    .text('Secretary', left + colWidth + 20, lineY + 10, {
      width: colWidth,
      align: 'center',
    });
}

function writeEnactmentAndApprovalBlocks(doc, officials = {}) {
  doc.moveDown(0.8);

  const { left, right } = doc.page.margins;
  const pageRight = doc.page.width - right;
  const width = pageRight - left;
  const colWidth = width / 3 - 8;
  const startY = doc.y;
  const lineY = startY + 28;

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

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1f2937')
    .text(viceMayorName, left, lineY + 4, { width: colWidth, align: 'center' })
    .text(secretaryName, left + colWidth + 12, lineY + 4, { width: colWidth, align: 'center' })
    .text(mayorName, left + 2 * (colWidth + 12), lineY + 4, { width: colWidth, align: 'center' })
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5563')
    .text('Presiding Officer', left, lineY + 18, { width: colWidth, align: 'center' })
    .text('Secretary', left + colWidth + 12, lineY + 18, { width: colWidth, align: 'center' })
    .text('Municipal / City Mayor', left + 2 * (colWidth + 12), lineY + 18, {
      width: colWidth,
      align: 'center',
    });
}

/**
 * Writes the common document footer on each page.
 * @param {PDFDocument} doc
 */
function writeFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);

    const footerY = doc.page.height - doc.page.margins.bottom + 10;

    doc
      .moveTo(doc.page.margins.left, footerY - 5)
      .lineTo(doc.page.width - doc.page.margins.right, footerY - 5)
      .strokeColor('#cccccc')
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#999999')
      .text(
        `Generated by E-Legislative Monitoring System - Page ${i + 1} of ${pages.count}`,
        doc.page.margins.left,
        footerY,
        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
      );
  }
}

/**
 * Generates a PDF for an ordinance and pipes it to the provided writable stream.
 * @param {object} ordinance  - Ordinance record from the database
 * @param {import('stream').Writable} stream - Destination stream (e.g. HTTP response)
 */
function generateOrdinancePdf(ordinance, stream, options = {}) {
  const doc = new PDFDocument({ margin: 60, bufferPages: true });
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
    const coAuthorNames = ordinance.co_authors.map(c => c.name + (c.email ? ` <${c.email}>` : '')).join(', ');
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

  writeSignatureBlock(doc, ordinance.proposer_name);
  writeEnactmentAndApprovalBlocks(doc, options.officials);

  writeFooter(doc);
  doc.end();
}

/**
 * Generates a PDF for a resolution and pipes it to the provided writable stream.
 * @param {object} resolution  - Resolution record from the database
 * @param {import('stream').Writable} stream - Destination stream (e.g. HTTP response)
 */
function generateResolutionPdf(resolution, stream, options = {}) {
  const doc = new PDFDocument({ margin: 60, bufferPages: true });
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
    const coAuthorNames = resolution.co_authors.map(c => c.name + (c.email ? ` <${c.email}>` : '')).join(', ');
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

  writeSignatureBlock(doc, resolution.proposer_name);
  writeEnactmentAndApprovalBlocks(doc, options.officials);

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
  const pdfDoc = new PDFDocument({ margin: 60, bufferPages: true });
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
