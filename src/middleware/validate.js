const { validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(400).json({
    success: false,
    message: errors.array()[0].msg,
    errors: errors.array(),
  });
}

module.exports = { handleValidation };
