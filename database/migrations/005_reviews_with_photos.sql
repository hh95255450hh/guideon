-- Reviews with photos (up to 3 per review)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER DEFAULT 0;

-- Q&A on guide profiles
CREATE TABLE IF NOT EXISTS guide_questions (
  id          TEXT PRIMARY KEY,
  "guideId"   TEXT NOT NULL,
  "askerId"   TEXT NOT NULL,
  "askerName" TEXT,
  question    TEXT NOT NULL,
  answer      TEXT,
  "answeredAt" TIMESTAMPTZ,
  "isPublic"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_questions_guide ON guide_questions ("guideId");
CREATE INDEX IF NOT EXISTS idx_guide_questions_public ON guide_questions ("isPublic", "guideId") WHERE "isPublic" = true;

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  language    TEXT DEFAULT 'en',
  source      TEXT,
  "isActive"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers (email);

-- Shared wishlists
CREATE TABLE IF NOT EXISTS shared_wishlists (
  id          TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  "ownerName" TEXT,
  "guideIds"  JSONB DEFAULT '[]'::jsonb,
  title       TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
