-- Migration: add FCM device token to users table
-- Run: psql -U postgres -d oman_explorer -f database/migrations/001_add_fcm_token.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
