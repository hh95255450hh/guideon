/**
 * SEO helper — injects OG/Twitter meta tags and JSON-LD structured data.
 * Call seoSet({ title, description, image, type, url }) on each page.
 */
(function (global) {
  const DEFAULTS = {
    siteName: 'Guideon',
    title: 'Guideon — Certified Local Guides in Oman',
    description: 'Find and book Ministry-licensed local guides across Oman. Muscat, Salalah, Nizwa, Musandam, Wahiba Sands and more.',
    image: 'https://guideon.om/logo.png',
    url: location.href,
    type: 'website',
    locale: 'en_US',
  };

  function upsertMeta(name, value, useProperty) {
    const attr = useProperty ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function seoSet(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    document.title = o.title;

    upsertMeta('description', o.description);
    upsertMeta('og:site_name', o.siteName, true);
    upsertMeta('og:title',     o.title, true);
    upsertMeta('og:description', o.description, true);
    upsertMeta('og:image',     o.image, true);
    upsertMeta('og:url',       o.url, true);
    upsertMeta('og:type',      o.type, true);
    upsertMeta('og:locale',    o.locale, true);

    upsertMeta('twitter:card',        'summary_large_image');
    upsertMeta('twitter:title',       o.title);
    upsertMeta('twitter:description', o.description);
    upsertMeta('twitter:image',       o.image);

    // canonical URL
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.setAttribute('rel', 'canonical');
      document.head.appendChild(canon);
    }
    canon.setAttribute('href', o.url);
  }

  function seoStructuredData(data) {
    const existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) existing.remove();
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  // Default site-wide structured data
  function seoOrganization() {
    seoStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Guideon',
      legalName: 'Vision for Digital Thought',
      url: 'https://guideon.om',
      logo: 'https://guideon.om/logo.png',
      description: 'Tourism marketplace connecting tourists with certified local guides in Oman.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Seeb',
        addressRegion: 'Muscat',
        addressCountry: 'OM',
      },
      areaServed: { '@type': 'Country', name: 'Oman' },
    });
  }

  // NOTE: guide-profile / tour-package / company-profile JSON-LD is injected
  // server-side by src/middleware/seoMeta.js (crawler-visible, correct rating
  // suppression). The old client-side seoGuide()/seoTour() helpers here were
  // never called AND fabricated an aggregateRating (reviewCount || 1) on zero
  // reviews → invalid rich results. Removed to avoid duplicate/invalid schema.

  // BreadcrumbList helper
  function seoBreadcrumb(items) {
    seoStructuredData({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  // Website with SearchAction (sitelinks search box in Google)
  function seoWebsite() {
    seoStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Guideon',
      url: 'https://guideon.om',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://guideon.om/search.html?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    });
  }

  global.seoSet            = seoSet;
  global.seoStructuredData = seoStructuredData;
  global.seoOrganization   = seoOrganization;
  global.seoBreadcrumb     = seoBreadcrumb;
  global.seoWebsite        = seoWebsite;
})(window);
