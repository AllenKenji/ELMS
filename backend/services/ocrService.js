const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { pdfToPng, VerbosityLevel } = require('pdf-to-png-converter');

const PDF_OCR_MAX_PAGES = Math.max(1, Number(process.env.OCR_MAX_PDF_PAGES || 5));

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferSuggestionFromText(rawText, measureType) {
  const text = normalizeExtractedText(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] || '';

  const numberPattern = measureType === 'ordinance'
    ? /(ORD(?:INANCE)?[-\s]?\d{2,4}[-\s]?\d{1,5})/i
    : /(RES(?:OLUTION)?[-\s]?\d{2,4}[-\s]?\d{1,5})/i;

  const detectedNumber = (text.match(numberPattern) || [])[0] || '';

  const descriptionSource = lines.slice(1, 6).join(' ').trim();
  const description = descriptionSource.slice(0, 700);

  return {
    title: firstLine.slice(0, 200),
    detected_number: detectedNumber,
    description,
    content: text,
    remarks: 'Imported from scanned legacy document.',
  };
}

async function extractTextFromPdf(buffer) {
  let parsedText = '';
  let pageCount = 1;

  try {
    const parsed = await pdfParse(buffer);
    parsedText = normalizeExtractedText(parsed.text || '');
    pageCount = Number(parsed?.numpages) > 0 ? Number(parsed.numpages) : 1;
  } catch (err) {
    // Fall back to OCR when PDF text-layer parsing fails.
    console.warn('PDF text extraction failed; falling back to OCR:', err.message);
  }

  if (parsedText) {
    console.info('OCR scan: extracted PDF text-layer content.');
    return parsedText;
  }

  console.info('OCR scan: no PDF text-layer content; falling back to rasterized OCR.');
  return extractTextFromPdfUsingOcr(buffer, pageCount);
}

async function extractTextFromPdfUsingOcr(buffer, pageCountHint = 1) {
  const hintedPages = Math.max(1, Number(pageCountHint) || 1);
  const maxPagesToTry = Math.max(PDF_OCR_MAX_PAGES, hintedPages);
  const pagesToProcess = Array.from(
    { length: maxPagesToTry },
    (_, index) => index + 1,
  );
  const tryExtract = async (viewportScale) => {
    let renderedPages = [];
    try {
      renderedPages = await pdfToPng(buffer, {
        pagesToProcess,
        returnPageContent: true,
        viewportScale,
        disableFontFace: false,
        useSystemFonts: true,
        processPagesInParallel: true,
        concurrencyLimit: 2,
        verbosityLevel: VerbosityLevel.ERRORS,
      });
    } catch (err) {
      console.warn(`PDF page rasterization for OCR failed (scale=${viewportScale}):`, err.message);
      return '';
    }

    if (!Array.isArray(renderedPages) || !renderedPages.length) {
      console.warn(`OCR scan: no pages rendered from PDF for OCR (scale=${viewportScale}).`);
      return '';
    }

    const worker = await createWorker('eng');
    try {
      const chunks = [];

      for (const page of renderedPages) {
        if (!page?.content) {
          continue;
        }

        const result = await worker.recognize(page.content);
        const pageText = normalizeExtractedText(result?.data?.text || '');
        if (pageText) {
          chunks.push(pageText);
        }
      }

      return normalizeExtractedText(chunks.join('\n\n'));
    } finally {
      await worker.terminate();
    }
  };

  const firstPassText = await tryExtract(2);
  if (firstPassText) {
    console.info('OCR scan: extracted text from rasterized PDF pages (scale=2).');
    return firstPassText;
  }

  const secondPassText = await tryExtract(3);
  if (secondPassText) {
    console.info('OCR scan: extracted text from rasterized PDF pages (scale=3 retry).');
    return secondPassText;
  }

  console.warn('OCR scan: rasterized PDF pages produced no readable OCR text after retries.');
  return '';
}

async function extractTextFromImage(buffer) {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    return normalizeExtractedText(result?.data?.text || '');
  } finally {
    await worker.terminate();
  }
}

exports.scanDocument = async (file, measureType) => {
  if (!file || !file.buffer) {
    const err = new Error('No document uploaded for scanning.');
    err.status = 400;
    throw err;
  }

  let rawText = '';
  if (file.mimetype === 'application/pdf') {
    rawText = await extractTextFromPdf(file.buffer);
  } else {
    rawText = await extractTextFromImage(file.buffer);
  }

  if (!rawText) {
    const err = new Error('No readable text found in the uploaded document.');
    err.status = 422;
    throw err;
  }

  const suggestion = inferSuggestionFromText(rawText, measureType);
  return {
    raw_text: rawText,
    suggestion,
  };
};
