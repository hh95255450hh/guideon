const router = require('express').Router();
const { body } = require('express-validator');
const {
  listCompanies, getCompany, upsertProfile, uploadLogo, verifyCompany, getMyCompany,
} = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { validate } = require('../middleware/errorHandler');
const { uploadCompanyLogo } = require('../services/uploadService');

// Public
router.get('/',    listCompanies);
router.get('/:id', getCompany);

// Company-only
router.get('/me/profile',
  authenticate, authorize('company'),
  getMyCompany
);

router.post('/profile',
  authenticate, authorize('company'),
  body('company_name').optional().trim().notEmpty(),
  body('website').optional().isURL(),
  validate,
  upsertProfile
);

router.post('/logo',
  authenticate, authorize('company'),
  uploadCompanyLogo,
  uploadLogo
);

// Admin-only
router.patch('/:id/verify',
  authenticate, authorize('admin'),
  body('verified').isBoolean(),
  validate,
  verifyCompany
);

module.exports = router;
