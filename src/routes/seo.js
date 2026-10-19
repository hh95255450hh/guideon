const router = require('express').Router();
const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const packages = new SupabaseDB('tour_packages');

const APP_URL = (process.env.APP_URL || 'https://guideon.om').replace(/\/$/, '');

// Cache sitemap for 1 hour
let sitemapCache = null;
let sitemapCacheUntil = 0;

const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

router.get('/sitemap.xml', async (req, res) => {
  try {
    if (sitemapCache && Date.now() < sitemapCacheUntil) {
      res.type('application/xml').send(sitemapCache);
      return;
    }

    const staticPages = [
      { loc: '/',                  changefreq: 'daily',  priority: 1.0 },
      { loc: '/search.html',       changefreq: 'daily',  priority: 0.9 },
      { loc: '/plan-trip.html',    changefreq: 'weekly', priority: 0.85 },
      { loc: '/trails.html',       changefreq: 'monthly',priority: 0.75 },
      { loc: '/how-it-works.html', changefreq: 'monthly',priority: 0.7 },
      { loc: '/faq.html',          changefreq: 'monthly',priority: 0.7 },
      { loc: '/contact.html',      changefreq: 'monthly',priority: 0.8 },
      { loc: '/terms.html',        changefreq: 'yearly', priority: 0.3 },
      { loc: '/privacy.html',      changefreq: 'yearly', priority: 0.3 },
      { loc: '/login.html',        changefreq: 'monthly',priority: 0.5 },
      { loc: '/register.html',     changefreq: 'monthly',priority: 0.6 },
      { loc: '/qr.html',           changefreq: 'monthly',priority: 0.4 },
      { loc: '/regions.html',      changefreq: 'monthly',priority: 0.9 },
      { loc: '/teams.html',        changefreq: 'daily',  priority: 0.85 },
      { loc: '/blog.html',         changefreq: 'weekly', priority: 0.8 },
      { loc: '/cancellation.html', changefreq: 'yearly', priority: 0.4 },
      { loc: '/instant.html',      changefreq: 'weekly', priority: 0.8 },
      { loc: '/about.html',        changefreq: 'monthly',priority: 0.7 },
      { loc: '/explore.html',      changefreq: 'weekly', priority: 0.8 },
    ];

    // Region & blog detail pages from static JSON
    try {
      const fs = require('fs'); const path = require('path');
      const regions = JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','public','data','regions.json'),'utf8')).regions;
      regions.forEach(r => staticPages.push({ loc:`/region.html?id=${r.id}`, changefreq:'monthly', priority:0.75 }));
      const posts = JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','public','data','blog.json'),'utf8')).posts;
      posts.forEach(p => staticPages.push({ loc:`/blog-post.html?id=${p.slug}`, changefreq:'monthly', priority:0.7 }));
    } catch (e) { /* JSON optional */ }

    const allGuides    = await users.findAllByField('userType', 'guide');
    const allCompanies = await users.findAllByField('userType', 'company');
    const verifiedGuides    = allGuides.filter(u => u.isVerified && !u.isSuspended);
    const verifiedCompanies = allCompanies.filter(u => u.isVerified && !u.isSuspended);

    let tourPackages = [];
    try {
      tourPackages = await packages.findAllByField('isPublished', true);
    } catch { /* table may not exist yet */ }

    // Programmatic SEO landing pages — one EN + one AR URL per place/category,
    // declared as hreflang alternates of each other. A page with no guides is
    // served noindex (thin content), so it is left OUT of the sitemap entirely
    // rather than sending Google a "index this / don't index this" conflict.
    // A landing page's content IS its provider list, so its real last-modified
    // date is the newest provider on it. Without lastmod Google treats these as
    // static and deprioritises re-crawling them.
    const newest = rows => rows.reduce((max, r) => {
      const d = r.updatedAt || r.createdAt;
      return d && (!max || new Date(d) > new Date(max)) ? d : max;
    }, null);

    const langPairs = [];
    try {
      const { PLACES, CATEGORIES, guideServesPlace, guideMatchesCategory, companyServesPlace } = require('../services/seoLanding');
      PLACES.forEach(p => {
        const inPlace = verifiedGuides.filter(g => guideServesPlace(g, p));
        if (!inPlace.length) return;
        langPairs.push({ path: `/tour-guides/${p.slug}`, changefreq: 'weekly', priority: 0.85, lastmod: newest(inPlace) });
      });
      CATEGORIES.forEach(c => {
        const inCat = verifiedGuides.filter(g => guideMatchesCategory(g, c));
        if (!inCat.length) return;
        langPairs.push({ path: `/tours/${c.slug}`, changefreq: 'weekly', priority: 0.8, lastmod: newest(inCat) });
      });
      // Place × category long-tail pages. Must mirror MIN_COMBO in
      // routes/seoLanding.js: a combo below the threshold is served noindex, and
      // listing a noindex URL would send Google a contradictory signal.
      const MIN_COMBO = 3;
      PLACES.forEach(p => {
        const inPlace = verifiedGuides.filter(g => guideServesPlace(g, p));
        if (!inPlace.length) return;
        CATEGORIES.forEach(c => {
          const both = inPlace.filter(g => guideMatchesCategory(g, c));
          if (both.length < MIN_COMBO) return;
          langPairs.push({ path: `/tour-guides/${p.slug}/${c.slug}`, changefreq: 'weekly', priority: 0.7, lastmod: newest(both) });
        });
      });
      if (verifiedCompanies.length) {
        langPairs.push({ path: '/tour-companies', changefreq: 'weekly', priority: 0.85, lastmod: newest(verifiedCompanies) });
        PLACES.forEach(p => {
          const inPlace = verifiedCompanies.filter(c => companyServesPlace(c, p));
          if (!inPlace.length) return;
          langPairs.push({ path: `/tour-companies/${p.slug}`, changefreq: 'weekly', priority: 0.75, lastmod: newest(inPlace) });
        });
      }
    } catch (e) { /* optional */ }

    // Each pair expands to two <url> entries that both carry the same
    // xhtml:link alternates (Google requires the links on BOTH versions).
    const pairUrls = langPairs.flatMap(({ path, changefreq, priority, lastmod }) => {
      const en = `${APP_URL}${path}`, ar = `${APP_URL}/ar${path}`;
      const alts = [
        `    <xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(en)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="ar" href="${xmlEsc(ar)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(en)}"/>`,
      ].join('\n');
      return [
        { loc: en, changefreq, priority, alts, lastmod },
        { loc: ar, changefreq, priority, alts, lastmod },
      ];
    });

    const urls = [
      ...staticPages.map(p => ({ ...p, loc: APP_URL + p.loc })),
      ...pairUrls,
      ...verifiedGuides.map(g => ({
        loc: `${APP_URL}/guide-profile.html?id=${g.id}`,
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: g.updatedAt || g.createdAt,
      })),
      ...verifiedCompanies.map(c => ({
        loc: `${APP_URL}/company-profile.html?id=${c.id}`,
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: c.updatedAt || c.createdAt,
      })),
      ...tourPackages.map(p => ({
        loc: `${APP_URL}/tour-package.html?id=${p.id}`,
        changefreq: 'weekly',
        priority: 0.8,
        lastmod: p.updatedAt || p.createdAt,
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(u => `  <url>
    <loc>${xmlEsc(u.loc)}</loc>
${u.alts ? u.alts + '\n' : ''}    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().split('T')[0]}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    sitemapCache = xml;
    sitemapCacheUntil = Date.now() + 60 * 60 * 1000;

    res.type('application/xml').send(xml);
  } catch (err) {
    console.error('[sitemap]', err.message);
    res.status(500).send('Sitemap generation failed');
  }
});

module.exports = router;
