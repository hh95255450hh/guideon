// Neutralise angle brackets in fields that are always plain text, at the point
// they are written.
//
// The pages render a great deal of user-written text through innerHTML — over
// seventy templates. Several interpolated it without escaping (review comments
// in the guide dashboard, company names in the admin panel, add-on names on the
// tour page), so a company registering with a name like
// <img src=x onerror=...> ran its script in the admin's browser. Escaping every
// template is the right end state, but one forgotten template reopens the hole.
// Cleaning these fields on the way in means a stored value can never carry
// markup, whichever page later renders it.
//
// The brackets become the look-alike guillemets ‹ › rather than being deleted,
// so "price < 20" still reads naturally while being inert as HTML.
//
// Only named plain-text fields are touched. Rich-text fields (the admin blog's
// body_ar/body_en, descriptions) are deliberately absent from this list.

const PLAIN_TEXT_FIELDS = new Set([
  // people and organisations
  'fullName', 'firstName', 'lastName', 'name', 'name_ar', 'name_en',
  'companyName', 'teamName', 'touristName', 'guideName', 'contactName',
  'companyRegNo', 'licenseNumber', 'phone', 'email', 'whatsapp',
  // places
  'destination', 'city', 'governorate', 'wilayat', 'meetingPoint',
  // short labels shown in cards and lists
  'title', 'title_ar', 'title_en', 'label', 'tagline', 'tagline_ar', 'tagline_en',
  'badge', 'badge_ar', 'badge_en', 'button_text', 'desc_ar', 'desc_en',
  // things tourists and providers write to each other
  'comment', 'reply', 'guideReply', 'message', 'question', 'answer', 'note', 'notes',
  'bio', 'bio_ar', 'bio_en', 'specialization', 'specializations', 'languages',
]);

function clean(value) {
  if (typeof value === 'string') return value.replace(/</g, '‹').replace(/>/g, '›');
  if (Array.isArray(value)) return value.map(clean);
  return value;
}

// Walk the body: clean listed keys at any depth (add-ons and variants arrive as
// arrays of objects), leave every other key exactly as sent.
function walk(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return node;
  if (Array.isArray(node)) { node.forEach(item => walk(item, depth + 1)); return node; }
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (PLAIN_TEXT_FIELDS.has(key)) node[key] = clean(v);
    else if (v && typeof v === 'object') walk(v, depth + 1);
  }
  return node;
}

function plainTextBody(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) walk(req.body);
  next();
}

module.exports = { plainTextBody, PLAIN_TEXT_FIELDS, _walk: walk };
