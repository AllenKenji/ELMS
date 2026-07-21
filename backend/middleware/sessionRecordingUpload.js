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
  const rawMimeType = String(file.mimetype || '').toLowerCase();
  const mimeType = rawMimeType.split(';')[0].trim();
  const originalName = String(file.originalname || '').trim();
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension).toLowerCase();
  const allowedExtensions = new Set(['.webm', '.mp4', '.mov', '.mkv']);
  const acceptedExplicitMimeTypes = new Set(['application/webm', 'application/x-matroska', 'audio/webm']);
  const acceptedGenericMimeTypes = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-octet-stream']);
  const acceptedVideoMimeFragments = ['webm', 'mp4', 'quicktime', 'matroska', 'mpeg', 'ogg', 'm4v'];

  const hasAllowedExtension = allowedExtensions.has(extension);
  const looksLikeRecorderBlob = !baseName || baseName === 'blob' || baseName.includes('record') || baseName.includes('session') || baseName.includes('meeting') || baseName.includes('screen') || baseName.includes('video');
  const hasVideoLikeMime = acceptedVideoMimeFragments.some((fragment) => rawMimeType.includes(fragment));
  const hasOctetStreamLikeMime = rawMimeType.includes('octet-stream');

  if (mimeType.startsWith('video/') || acceptedExplicitMimeTypes.has(mimeType) || hasVideoLikeMime) {
    cb(null, true);
    return;
  }

  // Accept files with known video extensions even if browsers mislabel MIME type.
  if (hasAllowedExtension) {
    cb(null, true);
    return;
  }

  // Some browsers upload valid recordings as generic blobs (e.g. "blob" + octet-stream).
  if ((acceptedGenericMimeTypes.has(mimeType) || hasOctetStreamLikeMime) && (hasAllowedExtension || looksLikeRecorderBlob)) {
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