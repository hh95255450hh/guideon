const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { requireLogin } = require('../middleware/auth');
const SupabaseDB = require('../models/SupabaseDB');
const { uploadBuffer, deleteByUrl } = require('../services/storageService');

const router = express.Router();
const users  = new SupabaseDB('users');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(null, ok);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/upload/photo — update profile photo
router.post('/photo', requireLogin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  try {
    const user = await users.findById(req.session.userId);
    if (user?.photo) deleteByUrl(user.photo).catch(() => {});

    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `avatars/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    await users.update(req.session.userId, { photo: url });
    res.json({ success: true, photo: url });
  } catch (e) {
    console.error('[upload:photo]', e.message);
    res.status(500).json({ success: false, message: 'Upload failed.' });
  }
});

// POST /api/upload/gallery — add one gallery photo (max 8)
router.post('/gallery', requireLogin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  try {
    const user    = await users.findById(req.session.userId);
    const gallery = user.galleryPhotos || [];
    if (gallery.length >= 8) {
      return res.status(400).json({ success: false, message: 'Maximum 8 gallery photos.' });
    }
    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `gallery/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    gallery.push(url);
    await users.update(req.session.userId, { galleryPhotos: gallery });
    res.json({ success: true, url, gallery });
  } catch (e) {
    console.error('[upload:gallery]', e.message);
    res.status(500).json({ success: false, message: 'Upload failed.' });
  }
});

// DELETE /api/upload/gallery — remove a gallery photo by URL
router.delete('/gallery', requireLogin, async (req, res) => {
  try {
    const { url } = req.body;
    const user    = await users.findById(req.session.userId);
    const gallery = (user.galleryPhotos || []).filter(u => u !== url);
    deleteByUrl(url).catch(() => {});
    await users.update(req.session.userId, { galleryPhotos: gallery });
    res.json({ success: true, gallery });
  } catch (e) {
    console.error('[upload:gallery-delete]', e.message);
    res.status(500).json({ success: false, message: 'Remove failed.' });
  }
});

// POST /api/upload/video — save YouTube video URL
router.post('/video', requireLogin, async (req, res) => {
  const { videoUrl } = req.body;
  if (videoUrl && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(videoUrl)) {
    return res.status(400).json({ success: false, message: 'Only YouTube URLs are supported.' });
  }
  try {
    await users.update(req.session.userId, { videoUrl: videoUrl || '' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Save failed.' });
  }
});

module.exports = router;
