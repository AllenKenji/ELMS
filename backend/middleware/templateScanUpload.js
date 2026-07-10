const multer = require('multer');

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      cb(new Error('Only PDF, PNG, JPG, and WEBP files are supported for scanning.'));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
