/**
 * sanitizeContact.js — strip direct-contact fields from public profile
 * responses so tourists can't bypass the platform.
 *
 * Tourists/anonymous visitors should NEVER see a guide's or company's
 * phone, email, WhatsApp, or social-media handles on a public profile
 * or a search result. Communication must flow through /api/messages so
 * the platform retains the relationship (and, in future, the commission).
 *
 * The owner of the profile and any admin/staff user CAN see their own
 * / all contact fields. Everyone else gets a stripped copy.
 */

const { SENSITIVE_USER_FIELDS } = require('./sanitizeUser');

const CONTACT_FIELDS = [
  // Direct comms
  'phone', 'mobile', 'whatsapp', 'whatsApp', 'whatsappNumber',
  'email',                  // already a login identifier — also strip from public
  'telegram', 'viber', 'skype', 'signal', 'wechat', 'line',
  // Social handles that lead to DMs
  'instagram', 'facebook', 'twitter', 'tiktok', 'youtube',
  'snapchat', 'linkedin', 'threads',
  // Personal website / booking link (allows off-platform booking)
  'website', 'personalWebsite', 'bookingUrl', 'externalUrl',
];

/**
 * @param {object} profile - the raw user record
 * @param {object|null} viewer - the requesting user (req.user or null)
 * @returns {object} a copy safe to send to this viewer
 */
function sanitizeContact(profile, viewer) {
  if (!profile) return profile;
  // Security tokens (password hash, 2FA secret/backup codes, email-verify and
  // password-reset tokens, FCM token) must NEVER appear in ANY response — not
  // even to the owner or an admin. Strip them before anything else.
  const base = { ...profile };
  for (const f of SENSITIVE_USER_FIELDS) delete base[f];
  // Owner sees their own profile; admins see everything (still minus the tokens)
  if (viewer && (viewer.id === profile.id ||
      viewer.userType === 'admin' || viewer.userType === 'staff')) {
    return base;
  }
  const copy = base;
  for (const f of CONTACT_FIELDS) {
    if (f in copy) delete copy[f];
  }
  // Also nuke any free-text bio leakage of phones/emails (best-effort)
  if (typeof copy.bio === 'string') copy.bio = maskContactStrings(copy.bio);
  if (typeof copy.description === 'string') copy.description = maskContactStrings(copy.description);
  return copy;
}

/**
 * Detect & mask phone numbers and emails inside free-text fields
 * (bios, messages). Replaces with a notice that pushes users back to
 * the platform messaging.
 */
const PHONE_RE = /(\+?\d[\d\s\-().]{6,}\d)/g;
const EMAIL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
// Social handles like @username with at-sign, and t.me/, wa.me/, instagram.com/
const HANDLE_RE = /(?:\b(?:wa\.me|t\.me|instagram\.com|facebook\.com|fb\.me|tiktok\.com|snapchat\.com)\/[^\s]+)/gi;
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s]+)/gi;

function maskContactStrings(text) {
  if (!text) return text;
  return text
    .replace(PHONE_RE, '[hidden — please contact via Guideon chat]')
    .replace(EMAIL_RE, '[hidden — please contact via Guideon chat]')
    .replace(HANDLE_RE, '[hidden — please contact via Guideon chat]');
}

/**
 * For chat / messages: detect attempts to share contact info and
 * either mask them or flag the message. Returns { clean, flagged }.
 */
function sanitizeMessageBody(text) {
  if (!text || typeof text !== 'string') return { clean: text, flagged: false };
  let flagged = false;
  let clean = text;
  if (PHONE_RE.test(text) || EMAIL_RE.test(text) || HANDLE_RE.test(text)) {
    flagged = true;
    // reset regex lastIndex
    PHONE_RE.lastIndex = 0; EMAIL_RE.lastIndex = 0; HANDLE_RE.lastIndex = 0;
    clean = text
      .replace(PHONE_RE, '••••••••••')
      .replace(EMAIL_RE, '••••@••••')
      .replace(HANDLE_RE, '••••••');
  }
  return { clean, flagged };
}

module.exports = { sanitizeContact, sanitizeMessageBody, maskContactStrings, CONTACT_FIELDS };
