const fs = require('fs');
const path = require('path');
const multer = require('multer');

const signaturesDir = path.join(__dirname, '..', 'uploads', 'signatures');
fs.mkdirSync(signaturesDir, { recursive: true });

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, signaturesDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `signature-${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      cb(new Error('Only PNG, JPG, JPEG, and WEBP signature images are allowed.'));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
