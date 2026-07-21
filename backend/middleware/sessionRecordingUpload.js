const fs = require('fs');
const multer = require('multer');
const path = require('path');

const recordingsDirectory = path.join(__dirname, '../uploads/session-recordings');

const storage = multer.diskStorage({
  destination: function sessionRecordingDestination(req, file, cb) {
    fs.mkdirSync(recordingsDirectory, { recursive: true });
    cb(null, recordingsDirectory);
  },
  filename: function sessionRecordingFilename(req, file, cb) {
    const extension = path.extname(file.originalname || '.webm') || '.webm';
    const safeBaseName = path.basename(file.originalname || 'session-recording', extension)
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'session-recording';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeBaseName}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const originalName = String(file.originalname || '').trim();
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension).toLowerCase();
  const allowedExtensions = new Set(['.webm', '.mp4', '.mov', '.mkv']);
  const acceptedExplicitMimeTypes = new Set(['application/webm', 'application/x-matroska', 'audio/webm']);
  const acceptedGenericMimeTypes = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

  const hasAllowedExtension = allowedExtensions.has(extension);
  const looksLikeRecorderBlob = baseName === 'blob' || baseName.includes('record') || baseName.includes('session') || baseName.includes('meeting') || baseName.includes('screen') || baseName.includes('video');

  if (mimeType.startsWith('video/') || acceptedExplicitMimeTypes.has(mimeType)) {
    cb(null, true);
    return;
  }

  // Some browsers upload valid recordings as generic blobs (e.g. "blob" + octet-stream).
  if (acceptedGenericMimeTypes.has(mimeType) && (hasAllowedExtension || looksLikeRecorderBlob)) {
    cb(null, true);
    return;
  }

  cb(new Error('Only video uploads are allowed for session recordings.'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
});