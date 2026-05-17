const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth    = require('../controllers/authController');
const { requireLogin } = require('../middleware/auth');

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  },
});
const upload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/me', requireLogin, auth.me);
router.put('/profile', requireLogin, auth.updateProfile);
router.put('/change-password', requireLogin, auth.changePassword);
router.post('/upload-photo', requireLogin, upload.single('photo'), auth.uploadPhoto);

module.exports = router;
