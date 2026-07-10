const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');

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
  const parsed = await pdfParse(buffer);
  return normalizeExtractedText(parsed.text || '');
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
