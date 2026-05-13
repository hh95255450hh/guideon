const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', req.uploadFolder || 'general');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

// Middleware factories
const uploadTourImage   = (req, res, next) => { req.uploadFolder = 'tours';   upload.single('image')(req, res, next); };
const uploadAvatar      = (req, res, next) => { req.uploadFolder = 'avatars'; upload.single('avatar')(req, res, next); };
const uploadCompanyLogo = (req, res, next) => { req.uploadFolder = 'logos';   upload.single('logo')(req, res, next); };

// Return the public URL path from the saved file
const getFileUrl = (req, file) => {
  if (!file) return null;
  const folder = req.uploadFolder || 'general';
  return `${process.env.APP_URL || 'http://localhost:3000'}/uploads/${folder}/${file.filename}`;
};

module.exports = { uploadTourImage, uploadAvatar, uploadCompanyLogo, getFileUrl };
