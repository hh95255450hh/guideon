const router = require('express').Router();
const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const packages = new SupabaseDB('tour_packages');

const APP_URL = process.env.APP_URL || 'https://guideon.om';

// Cache sitemap for 1 hour
let sitemapCache = null;
let sitemapCacheUntil = 0;

router.get('/sitemap.xml', async (req, res) => {
  try {
    if (sitemapCache && Date.now() < sitemapCacheUntil) {
      res.type('application/xml').send(sitemapCache);
      return;
    }

    const staticPages = [
      { loc: '/',                  changefreq: 'daily',  priority: 1.0 },
      { loc: '/search.html',       changefreq: 'daily',  priority: 0.9 },
      { loc: '/plan-trip.html',    changefreq: 'weekly', priority: 0.8 },
      { loc: '/login.html',        changefreq: 'monthly',priority: 0.5 },
      { loc: '/register.html',     changefreq: 'monthly',priority: 0.6 },
    ];

    const allGuides    = await users.findAllByField('userType', 'guide');
    const allCompanies = await users.findAllByField('userType', 'company');
    const verifiedGuides    = allGuides.filter(u => u.isVerified && !u.isSuspended);
    const verifiedCompanies = allCompanies.filter(u => u.isVerified && !u.isSuspended);

    let tourPackages = [];
    try {
      tourPackages = await packages.findAllByField('isPublished', true);
    } catch { /* table may not exist yet */ }

    const urls = [
      ...staticPages.map(p => ({ ...p, loc: APP_URL + p.loc })),
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().split('T')[0]}</lastmod>` : ''}
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
