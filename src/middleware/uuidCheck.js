const { body } = require('express-validator');

// More lenient UUID regex — accepts any 8-4-4-4-12 hex string
// express-validator's isUUID() rejects UUIDs with version digit '0',
// which appear in seed/test data.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUUIDField = (field, message) =>
  body(field)
    .matches(UUID_RE)
    .withMessage(message || `${field} must be a valid UUID`);

module.exports = { isUUIDField };
