const fs = require('fs');
const multer = require('multer');
const path = require('path');

const recordingsDirectory = path.join(__dirname, '../uploads/committee-recordings');

const storage = multer.diskStorage({
  destination: function meetingRecordingDestination(req, file, cb) {
    fs.mkdirSync(recordingsDirectory, { recursive: true });
    cb(null, recordingsDirectory);
  },
  filename: function meetingRecordingFilename(req, file, cb) {
    const extension = path.extname(file.originalname || '.webm') || '.webm';
    const safeBaseName = path.basename(file.originalname || 'committee-recording', extension)
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'committee-recording';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeBaseName}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  if (mimeType.startsWith('video/')) {
    cb(null, true);
    return;
  }

  cb(new Error('Only video uploads are allowed for meeting recordings.'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
});