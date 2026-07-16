const fs = require('fs');
const multer = require('multer');
const path = require('path');

const photosDirectory = path.join(__dirname, '..', 'uploads', 'profile-photos');

const storage = multer.diskStorage({
  destination: function profilePhotoDestination(_req, _file, cb) {
    fs.mkdirSync(photosDirectory, { recursive: true });
    cb(null, photosDirectory);
  },
  filename: function profilePhotoFilename(_req, file, cb) {
    const extension = path.extname(file.originalname || '.png').toLowerCase() || '.png';
    const safeBaseName = path.basename(file.originalname || 'profile-photo', extension)
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile-photo';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeBaseName}${extension}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  if (['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mimeType)) {
    cb(null, true);
    return;
  }

  cb(new Error('Only PNG, JPG, JPEG, and WEBP images are allowed for profile photos.'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
