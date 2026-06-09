const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { requireLogin } = require('../middleware/auth');
const SupabaseDB = require('../models/SupabaseDB');
const { uploadBuffer, deleteByUrl } = require('../services/storageService');

const router = express.Router();
const users  = new SupabaseDB('users');

/**
 * Wrap any multer middleware so its errors become a clean 400 to the
 * client instead of bubbling up to the global error handler (and
 * Sentry). Multer throws *before* the route handler runs, so without
 * this every "file too large" / "unexpected field" pages an admin.
 */
function safeMulter(mw, label) {
  return (req, res, next) => mw(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      const max = err.field === 'video' ? 50 : 25;
      return res.status(400).json({ success:false, code:err.code, message:`File too large — maximum ${max} MB.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success:false, code:err.code, message:`Unexpected file field: ${err.field}` });
    }
    if (err.name === 'MulterError') {
      return res.status(400).json({ success:false, code:err.code, message: err.message });
    }
    // Non-multer error — let the global handler deal with it.
    next(err);
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(null, ok);
  },
  // Bumped from 10 MB → 25 MB. Modern phone cameras shoot 5–15 MB JPEGs.
  // The client-side compressor (gdCompressImage) usually shrinks these to
  // <1.5 MB before they even reach us, but we keep a generous server cap
  // for clients that don't run the compressor (older browsers, API users).
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /api/upload/photo — update profile photo
router.post('/photo', requireLogin, safeMulter(upload.single('photo')), async (req, res) => {
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
    const msg = String(e.message || '');
    if (/row-level security|RLS|policy/i.test(msg)) {
      return res.status(500).json({ success: false, message: 'Storage permissions error — admin must run migration 016. (Server: ' + msg + ')' });
    }
    if (/Bucket not found|does not exist/i.test(msg)) {
      return res.status(500).json({ success: false, message: 'Storage bucket missing — admin must run migration 016.' });
    }
    if (/exceeded|too large/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'File is too large. Maximum 10 MB.' });
    }
    res.status(500).json({ success: false, message: 'Upload failed: ' + msg });
  }
});

// POST /api/upload/gallery — add one gallery photo (max 8)
router.post('/gallery', requireLogin, safeMulter(upload.single('photo')), async (req, res) => {
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

// POST /api/upload/image — generic image upload (homepage slides, etc.)
// Returns { success, url } with NO side effects on the user's profile.
router.post('/image', requireLogin, safeMulter(upload.single('photo')), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  try {
    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `homepage/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    res.json({ success: true, url });
  } catch (e) {
    console.error('[upload:image]', e.message);
    const msg = String(e.message || '');
    if (/row-level security|RLS|policy/i.test(msg)) {
      return res.status(500).json({ success: false, message: 'Storage permissions error — admin must run migration 016.' });
    }
    res.status(500).json({ success: false, message: 'Upload failed: ' + msg });
  }
});

// Video uploader — larger limit, video mime types only.
const uploadVid = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(null, ok);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// POST /api/upload/video-file — generic video upload (homepage slides, etc.)
// Returns { success, url }. Use a short, muted, web-optimised clip.
router.post('/video-file', requireLogin, safeMulter(uploadVid.single('video')), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No video uploaded (use mp4/webm/mov, max 50 MB).' });
  try {
    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `homepage/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    res.json({ success: true, url });
  } catch (e) {
    console.error('[upload:video-file]', e.message);
    const msg = String(e.message || '');
    if (/row-level security|RLS|policy/i.test(msg)) {
      return res.status(500).json({ success: false, message: 'Storage permissions error — admin must run migration 016.' });
    }
    if (/exceeded|too large|maximum/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Video too large — maximum 50 MB.' });
    }
    res.status(500).json({ success: false, message: 'Upload failed: ' + msg });
  }
});

// POST /api/upload/message-attachment — upload an image to send in chat
router.post('/message-attachment', requireLogin, safeMulter(upload.single('file')), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  try {
    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `messages/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    res.json({ success: true, url, name: req.file.originalname, type: 'image' });
  } catch (e) {
    console.error('[upload:message-attachment]', e.message);
    const msg = String(e.message || '');
    if (/row-level security|RLS|policy/i.test(msg)) {
      return res.status(500).json({ success: false, message: 'Storage permissions error — admin must run migration 016.' });
    }
    if (/exceeded|too large/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'File is too large. Maximum 10 MB.' });
    }
    res.status(500).json({ success: false, message: 'Upload failed.' });
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
