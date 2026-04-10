-- ============================================================
-- MyPrivateClinic Admin — Supabase Database Setup
-- Run this entire script in the Supabase SQL Editor:
-- https://app.supabase.com → Your Project → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT NOT NULL DEFAULT 'Phone',
  service_interest TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage leads"
  ON leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- CORPORATE PIPELINE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS corporate_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  role TEXT,
  stage TEXT NOT NULL DEFAULT 'Aware',
  next_action TEXT,
  next_action_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE corporate_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage corporate pipeline"
  ON corporate_pipeline FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed corporate pipeline
INSERT INTO corporate_pipeline (company, contact_name, role, stage, notes) VALUES
  ('Crowberry Energy', 'Becky Toal', 'CEO', 'Aware', 'Initial research stage'),
  ('Fuuse', 'Michael Gibson', 'CEO', 'Aware', 'Initial research stage'),
  ('Standing Ovation Project', 'Anthony Daulphin', 'CEO', 'Aware', 'Initial research stage'),
  ('Forepoint', 'Steve Gill', 'Managing Partner', 'Aware', 'Initial research stage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- REFERRERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS referrers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'GP',
  organisation TEXT,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  last_referral DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE referrers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage referrers"
  ON referrers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  service TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Card',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- COMPLIANCE ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL DEFAULT 'CQC',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  expiry_date DATE,
  review_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage compliance items"
  ON compliance_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed compliance items
INSERT INTO compliance_items (category, title, status, notes) VALUES
  ('CQC', 'CQC Registration', 'Active', 'Review annually'),
  ('GMC', 'GMC Registration', 'Active', 'Renew annually with GMC'),
  ('Insurance', 'Indemnity Insurance', 'Active', 'Check expiry date with provider'),
  ('DBS', 'DBS Check - Dr Faizal Secretary', 'Active', 'Renew every 3 years')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTENT CALENDAR TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL DEFAULT 'LinkedIn',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idea',
  scheduled_date DATE,
  published_date DATE,
  reactions INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage content calendar"
  ON content_calendar FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- REFERRAL NETWORK (specialists Dr Faizal refers TO)
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_network (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  hospital TEXT,
  referrals_sent INTEGER NOT NULL DEFAULT 0,
  avg_wait_days INTEGER,
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE referral_network ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage referral network"
  ON referral_network FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- INVENTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL DEFAULT 'Clinical Supplies',
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,
  last_ordered DATE,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- TEAM MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date DATE,
  contract_type TEXT NOT NULL DEFAULT 'Director',
  dbs_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage team members"
  ON team_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed team members
INSERT INTO team_members (name, role, start_date, contract_type, notes) VALUES
  ('Dr Faizal Secretary', 'Founder & Lead GP', '2026-04-01', 'Director', 'Founder of MyPrivateClinic')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PATIENT FEEDBACK TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL DEFAULT 'Google',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  responded BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patient_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage patient feedback"
  ON patient_feedback FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- GOALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'Monthly',
  category TEXT NOT NULL DEFAULT 'Revenue',
  target_value NUMERIC(10,2) NOT NULL,
  current_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '£',
  status TEXT NOT NULL DEFAULT 'On Track',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage goals"
  ON goals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed goals
INSERT INTO goals (title, period, category, target_value, current_value, unit, status) VALUES
  ('Patients Seen — April 2026', 'Monthly', 'Patients', 20, 0, 'patients', 'On Track'),
  ('Revenue — April 2026', 'Monthly', 'Revenue', 2400, 0, '£', 'On Track'),
  ('Google Reviews', 'Quarterly', 'Marketing', 10, 0, 'reviews', 'On Track')
ON CONFLICT DO NOTHING;

-- ============================================================
-- QR CODES TABLE
-- Each row is a named campaign with a destination URL.
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage qr_codes"
  ON qr_codes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed with the leaflet campaign
INSERT INTO qr_codes (name, slug, destination_url, notes) VALUES
  ('A5 Leaflet — April 2026', 'leaflet-apr-2026', 'https://myprivateclinic.vercel.app', 'Printed A5 leaflet distributed in Fulwood April 2026')
ON CONFLICT DO NOTHING;

-- ============================================================
-- QR SCANS TABLE
-- One row per scan. Logged by /api/scan.js on every redirect.
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_slug TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public insert allowed (no auth on scan endpoint — it's a redirect)
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert qr_scans"
  ON qr_scans FOR INSERT
  TO anon
  WITH CHECK (true);
CREATE POLICY "Authenticated users can read qr_scans"
  ON qr_scans FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_qr_scans_campaign ON qr_scans (campaign_slug);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans (scanned_at DESC);

-- ============================================================
-- UPDATED_AT trigger function (auto-update timestamps)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads','corporate_pipeline','referrers','transactions',
    'compliance_items','content_calendar','referral_network',
    'inventory','team_members','patient_feedback','goals','qr_codes'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END;
$$;

-- ============================================================
-- Done! All tables created with RLS enabled.
-- Next: go to Authentication → Users in Supabase and create
-- your admin user account (email + password).
-- ============================================================
