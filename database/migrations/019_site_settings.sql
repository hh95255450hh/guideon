-- ════════════════════════════════════════════════════════════════════
--  Migration 019 — Site Settings (admin-controllable homepage CMS)
-- ════════════════════════════════════════════════════════════════════
-- Single key/value store the admin uses to override homepage content
-- without touching code:
--   • hero text  (title + highlight + subtitle in EN and AR)
--   • carousel slides (image URL, badge, headline, description, CTA)
--   • activity cards (icon, title, description, link)
--   • theme colours (primary, gold, etc.) — optional
--
-- Reads are public (anyone visiting the homepage). Writes require admin.

CREATE TABLE IF NOT EXISTS site_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by  text,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Default hero text (loaded only if admin hasn't customised yet)
INSERT INTO site_settings (key, value) VALUES
  ('hero', '{
    "badge_en": "Certified Ministry-Licensed Guides",
    "badge_ar": "مرشدون معتمدون من وزارة التراث والسياحة",
    "title_en": "Discover Oman With a",
    "title_ar": "اكتشف عُمان مع",
    "highlight_en": "Verified Local Expert",
    "highlight_ar": "خبير محلي موثّق",
    "subtitle_en": "Connect with certified tourist guides across the Sultanate of Oman.",
    "subtitle_ar": "تواصل مع مرشدين سياحيين معتمدين في جميع أنحاء سلطنة عُمان."
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Carousel slides default (start empty — admin uploads photos)
INSERT INTO site_settings (key, value) VALUES
  ('carousel', '{"slides": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Activity grid default (start empty — admin curates)
INSERT INTO site_settings (key, value) VALUES
  ('activities', '{"items": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;
