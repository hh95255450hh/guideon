/* Guideon — premium scroll-reveal (Stripe/Apple style).
   Safe: the hide rules only apply once this JS adds `reveal-on` to <body>,
   so if anything fails the content stays fully visible. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    body.classList.add('reveal-on');

    // Reveal each section (skip the first hero so it shows instantly)
    const sections = Array.from(document.querySelectorAll('main section, body > section, section'));
    const seen = new Set();
    sections.forEach((s, i) => {
      if (seen.has(s)) return; seen.add(s);
      if (i === 0) return;                 // hero stays visible
      if (s.closest('.navbar')) return;
      s.classList.add('reveal');
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll('.reveal').forEach(el => io.observe(el));

    // Failsafe: never leave anything hidden
    setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in')), 4000);

    // Stripe-style alternating aurora glow on content sections
    document.querySelectorAll('section.py-5').forEach((s, i) => {
      if (i % 2 === 0) s.classList.add('gd-aurora');
    });
  });
})();
