// Allow-list HTML cleaner for rich text written in the admin panel (blog post
// bodies) and rendered on public pages with innerHTML. Keeps simple formatting
// and links/images; drops every other tag, every event handler and style, and
// any URL that is not http(s), mailto or site-relative.

const TAGS = new Set(['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
  'blockquote', 'a', 'img', 'figure', 'figcaption', 'hr', 'span']);
const ATTRS = { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height', 'loading'] };
// Content of these is dropped entirely, not just the tags.
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

const safeUrl = (u) => {
  const v = String(u || '').trim();
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(v) && !/[\s"'<>`]/.test(v) ? v : '';
};
const escAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  let s = html.replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  return s.replace(/<\/?([a-zA-Z][\w-]*)\b([^>]*)>/g, (m, tag, rest) => {
    const t = tag.toLowerCase();
    if (!TAGS.has(t)) return '';
    if (m.startsWith('</')) return `</${t}>`;
    const keep = [];
    for (const name of ATTRS[t] || []) {
      const am = rest.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
      if (!am) continue;
      let val = am[2] ?? am[3] ?? am[4] ?? '';
      if (name === 'href' || name === 'src') { val = safeUrl(val); if (!val) continue; }
      keep.push(`${name}="${escAttr(val)}"`);
    }
    if (t === 'a' && keep.some(k => k.startsWith('href="http'))) keep.push('rel="noopener nofollow"', 'target="_blank"');
    return `<${t}${keep.length ? ' ' + keep.join(' ') : ''}>`;
  }).replace(/<(?![a-zA-Z/!])/g, '&lt;');
}

module.exports = { sanitizeHtml };
