-- 022_review_columns.sql
-- Adds the review columns the app writes but were missing from the reviews
-- table. Without these, tourists could not submit ANY review (insert failed
-- with "column reviews.packageId does not exist").
--
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "packageId"    text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "touristPhoto" text;
