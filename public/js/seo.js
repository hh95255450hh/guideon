/**
 * SEO helper — injects OG/Twitter meta tags and JSON-LD structured data.
 * Call seoSet({ title, description, image, type, url }) on each page.
 */
(function (global) {
  const DEFAULTS = {
    siteName: 'Guideon',
    title: 'Guideon — Certified Local Guides in Oman',
    description: 'Find and book Ministry-licensed local guides across Oman. Muscat, Salalah, Nizwa, Musandam, Wahiba Sands and more.',
    image: 'https://guideon.guide/logo.png',
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
      url: 'https://guideon.guide',
      logo: 'https://guideon.guide/logo.png',
      description: 'Tourism marketplace connecting tourists with certified local guides in Oman.',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'OM',
        addressRegion: 'Muscat',
      },
      sameAs: [],
    });
  }

  function seoGuide(guide) {
    seoStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: guide.fullName,
      jobTitle: 'Tourist Guide',
      image: guide.photo || 'https://guideon.guide/logo.png',
      description: guide.bio || `Certified local guide in Oman specializing in ${(guide.destinations || []).join(', ')}.`,
      knowsLanguage: guide.languages || [],
      areaServed: guide.destinations || [],
      aggregateRating: guide.rating > 0 ? {
        '@type': 'AggregateRating',
        ratingValue: guide.rating,
        reviewCount: guide.totalReviews,
        bestRating: 5,
        worstRating: 1,
      } : undefined,
      worksFor: {
        '@type': 'Organization',
        name: 'Guideon',
        url: 'https://guideon.guide',
      },
    });
  }

  // Product schema for a tour package — boosts rich snippets in Google
  function seoTour(tour) {
    const provider = tour.provider || {};
    seoStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: tour.title,
      description: tour.description || '',
      image: tour.cover_image || tour.coverImage || tour.image || (tour.images && tour.images[0]) || 'https://guideon.guide/logo.png',
      brand: { '@type': 'Brand', name: 'Guideon' },
      offers: {
        '@type': 'Offer',
        url: location.href,
        priceCurrency: tour.currency || 'OMR',
        price: tour.price_adult || tour.priceAdult || 0,
        availability: 'https://schema.org/InStock',
        validFrom: tour.createdAt,
        seller: provider.fullName ? {
          '@type': 'Person',
          name: provider.fullName,
        } : undefined,
      },
      aggregateRating: tour.rating > 0 ? {
        '@type': 'AggregateRating',
        ratingValue: tour.rating,
        reviewCount: tour.totalReviews || 1,
        bestRating: 5,
      } : undefined,
    });
  }

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
      url: 'https://guideon.guide',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://guideon.guide/search.html?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    });
  }

  global.seoSet            = seoSet;
  global.seoStructuredData = seoStructuredData;
  global.seoOrganization   = seoOrganization;
  global.seoGuide          = seoGuide;
  global.seoTour           = seoTour;
  global.seoBreadcrumb     = seoBreadcrumb;
  global.seoWebsite        = seoWebsite;
})(window);
