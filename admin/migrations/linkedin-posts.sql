-- linkedin_posts table
-- Run in Supabase SQL Editor: https://app.supabase.com → Your Project → SQL Editor

CREATE TABLE IF NOT EXISTS linkedin_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id      TEXT NOT NULL UNIQUE,
  url          TEXT,
  content      TEXT,
  published_at TIMESTAMPTZ,
  reactions    INTEGER NOT NULL DEFAULT 0,
  comments     INTEGER NOT NULL DEFAULT 0,
  shares       INTEGER NOT NULL DEFAULT 0,
  post_type    TEXT NOT NULL DEFAULT 'Post',
  image_url    TEXT,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE linkedin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage linkedin posts"
  ON linkedin_posts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
