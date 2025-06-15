-- Migration for creating enhanced fundraiser analytics tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. FUNDRAISING CAMPAIGNS TABLE
-- =====================================================
DROP TABLE IF EXISTS fundraising_campaigns CASCADE;
CREATE TABLE fundraising_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(12,2) NOT NULL,
  raised_amount DECIMAL(12,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  campaign_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  associated_events JSONB DEFAULT '[]',
  donation_methods JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fundraising_campaigns_positive_amounts CHECK (goal_amount > 0 AND raised_amount >= 0),
  CONSTRAINT fundraising_campaigns_valid_dates CHECK (end_date > start_date),
  CONSTRAINT fundraising_campaigns_org_name_unique UNIQUE (org_id, name)
);

-- =====================================================
-- 2. DONATIONS TABLE
-- =====================================================
DROP TABLE IF EXISTS donations CASCADE;
CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fundraiser_id UUID REFERENCES fundraising_campaigns(id) ON DELETE SET NULL,
  donor_name VARCHAR(255) NOT NULL,
  donor_email VARCHAR(255),
  donor_phone VARCHAR(50),
  donation_type VARCHAR(50) NOT NULL CHECK (donation_type IN ('monetary', 'time', 'supplies')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  donation_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  frequency VARCHAR(50) CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
  category VARCHAR(100),
  payment_method VARCHAR(50) CHECK (payment_method IN ('credit_card', 'bank_transfer', 'check', 'cash')),
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT donations_positive_amount CHECK (amount >= 0)
);

-- =====================================================
-- 3. DONOR PROFILES TABLE
-- =====================================================
DROP TABLE IF EXISTS donor_profiles CASCADE;
CREATE TABLE donor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  donor_name VARCHAR(255) NOT NULL,
  donor_email VARCHAR(255),
  donor_phone VARCHAR(50),
  total_donations DECIMAL(12,2) DEFAULT 0,
  first_donation_date DATE,
  last_donation_date DATE,
  donation_count INTEGER DEFAULT 0,
  preferred_donation_type VARCHAR(50),
  preferred_payment_method VARCHAR(50),
  is_recurring BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT donor_profiles_org_email_unique UNIQUE (org_id, donor_email)
);

-- =====================================================
-- 4. VOLUNTEER HOURS TABLE
-- =====================================================
DROP TABLE IF EXISTS volunteer_hours CASCADE;
CREATE TABLE volunteer_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fundraiser_id UUID REFERENCES fundraising_campaigns(id) ON DELETE SET NULL,
  volunteer_id UUID REFERENCES donor_profiles(id) ON DELETE SET NULL,
  hours DECIMAL(5,2) NOT NULL,
  activity_description TEXT,
  date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT volunteer_hours_positive CHECK (hours > 0)
);

-- =====================================================
-- 5. SUPPLY DONATIONS TABLE
-- =====================================================
DROP TABLE IF EXISTS supply_donations CASCADE;
CREATE TABLE supply_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fundraiser_id UUID REFERENCES fundraising_campaigns(id) ON DELETE SET NULL,
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  estimated_value DECIMAL(12,2) NOT NULL,
  category VARCHAR(100),
  condition VARCHAR(50) CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  notes TEXT,
  donation_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'received' CHECK (status IN ('pending', 'received', 'declined')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT supply_donations_positive_quantity CHECK (quantity > 0),
  CONSTRAINT supply_donations_positive_value CHECK (estimated_value >= 0)
);

-- =====================================================
-- 6. ANALYTICS VIEWS
-- =====================================================

-- Monthly Donation Trends View
DROP VIEW IF EXISTS monthly_donation_trends;
CREATE VIEW monthly_donation_trends AS
SELECT 
  org_id,
  DATE_TRUNC('month', donation_date) as month,
  donation_type,
  SUM(amount) as total_amount,
  COUNT(*) as donation_count
FROM donations
GROUP BY org_id, DATE_TRUNC('month', donation_date), donation_type;

-- Donor Retention View
DROP VIEW IF EXISTS donor_retention;
CREATE VIEW donor_retention AS
SELECT 
  org_id,
  donor_email,
  COUNT(DISTINCT DATE_TRUNC('month', donation_date)) as months_active,
  MIN(donation_date) as first_donation,
  MAX(donation_date) as last_donation,
  SUM(amount) as total_donated
FROM donations
WHERE donation_type = 'monetary'
GROUP BY org_id, donor_email;

-- Campaign Performance View
DROP VIEW IF EXISTS campaign_performance;
CREATE VIEW campaign_performance AS
SELECT 
  f.org_id,
  f.id as campaign_id,
  f.name as campaign_name,
  f.goal_amount,
  f.raised_amount,
  COUNT(DISTINCT d.id) as donation_count,
  COUNT(DISTINCT d.donor_email) as unique_donors,
  AVG(d.amount) as average_donation
FROM fundraising_campaigns f
LEFT JOIN donations d ON f.id = d.fundraiser_id
GROUP BY f.org_id, f.id, f.name, f.goal_amount, f.raised_amount;

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================

-- Fundraising Campaigns Indexes
CREATE INDEX IF NOT EXISTS idx_fundraising_campaigns_org_id ON fundraising_campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_campaigns_status ON fundraising_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_fundraising_campaigns_dates ON fundraising_campaigns(start_date, end_date);

-- Donations Indexes
CREATE INDEX IF NOT EXISTS idx_donations_org_id ON donations(org_id);
CREATE INDEX IF NOT EXISTS idx_donations_fundraiser_id ON donations(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_donations_donation_date ON donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_donation_type ON donations(donation_type);
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email);

-- Donor Profiles Indexes
CREATE INDEX IF NOT EXISTS idx_donor_profiles_org_id ON donor_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_email ON donor_profiles(donor_email);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_last_donation ON donor_profiles(last_donation_date);

-- Volunteer Hours Indexes
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_org_id ON volunteer_hours(org_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_fundraiser_id ON volunteer_hours(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_date ON volunteer_hours(date);

-- Supply Donations Indexes
CREATE INDEX IF NOT EXISTS idx_supply_donations_org_id ON supply_donations(org_id);
CREATE INDEX IF NOT EXISTS idx_supply_donations_fundraiser_id ON supply_donations(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_supply_donations_category ON supply_donations(category);

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE fundraising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_donations ENABLE ROW LEVEL SECURITY;

-- Fundraising Campaigns RLS Policies
DROP POLICY IF EXISTS "Users can view fundraising campaigns for their organization" ON fundraising_campaigns;
CREATE POLICY "Users can view fundraising campaigns for their organization" ON fundraising_campaigns
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Committee leads and above can manage fundraising campaigns" ON fundraising_campaigns;
CREATE POLICY "Committee leads and above can manage fundraising campaigns" ON fundraising_campaigns
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
      AND role IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Donations RLS Policies
DROP POLICY IF EXISTS "Users can view donations for their organization" ON donations;
CREATE POLICY "Users can view donations for their organization" ON donations
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Committee leads and above can manage donations" ON donations;
CREATE POLICY "Committee leads and above can manage donations" ON donations
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
      AND role IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Donor Profiles RLS Policies
DROP POLICY IF EXISTS "Users can view donor profiles for their organization" ON donor_profiles;
CREATE POLICY "Users can view donor profiles for their organization" ON donor_profiles
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Committee leads and above can manage donor profiles" ON donor_profiles;
CREATE POLICY "Committee leads and above can manage donor profiles" ON donor_profiles
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
      AND role IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Volunteer Hours RLS Policies
DROP POLICY IF EXISTS "Users can view volunteer hours for their organization" ON volunteer_hours;
CREATE POLICY "Users can view volunteer hours for their organization" ON volunteer_hours
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Committee leads and above can manage volunteer hours" ON volunteer_hours;
CREATE POLICY "Committee leads and above can manage volunteer hours" ON volunteer_hours
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
      AND role IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Supply Donations RLS Policies
DROP POLICY IF EXISTS "Users can view supply donations for their organization" ON supply_donations;
CREATE POLICY "Users can view supply donations for their organization" ON supply_donations
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Committee leads and above can manage supply donations" ON supply_donations;
CREATE POLICY "Committee leads and above can manage supply donations" ON supply_donations
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid()
      AND role IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- =====================================================
-- 9. TRIGGERS
-- =====================================================

-- Update donor profile on new donation
DROP FUNCTION IF EXISTS update_donor_profile() CASCADE;
CREATE OR REPLACE FUNCTION update_donor_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert donor profile
  INSERT INTO donor_profiles (
    org_id,
    donor_name,
    donor_email,
    donor_phone,
    total_donations,
    first_donation_date,
    last_donation_date,
    donation_count,
    preferred_donation_type,
    preferred_payment_method,
    is_recurring
  )
  VALUES (
    NEW.org_id,
    NEW.donor_name,
    NEW.donor_email,
    NEW.donor_phone,
    NEW.amount,
    NEW.donation_date,
    NEW.donation_date,
    1,
    NEW.donation_type,
    NEW.payment_method,
    NEW.is_recurring
  )
  ON CONFLICT (org_id, donor_email) DO UPDATE
  SET
    total_donations = donor_profiles.total_donations + NEW.amount,
    last_donation_date = NEW.donation_date,
    donation_count = donor_profiles.donation_count + 1,
    preferred_donation_type = CASE 
      WHEN donor_profiles.preferred_donation_type IS NULL THEN NEW.donation_type
      ELSE donor_profiles.preferred_donation_type
    END,
    preferred_payment_method = CASE 
      WHEN donor_profiles.preferred_payment_method IS NULL THEN NEW.payment_method
      ELSE donor_profiles.preferred_payment_method
    END,
    is_recurring = NEW.is_recurring OR donor_profiles.is_recurring,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_donation_created ON donations;
CREATE TRIGGER on_donation_created
  AFTER INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_donor_profile();

-- Update fundraiser raised amount on new donation
DROP FUNCTION IF EXISTS update_fundraiser_amount() CASCADE;
CREATE OR REPLACE FUNCTION update_fundraiser_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fundraiser_id IS NOT NULL THEN
    UPDATE fundraising_campaigns
    SET raised_amount = raised_amount + NEW.amount
    WHERE id = NEW.fundraiser_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_donation_amount_changed ON donations;
CREATE TRIGGER on_donation_amount_changed
  AFTER INSERT OR UPDATE OF amount ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_fundraiser_amount();

-- =====================================================
-- SCHEMA IMPLEMENTATION COMPLETE
-- =====================================================

-- Log successful schema creation
DO $$
BEGIN
    RAISE NOTICE 'PTO Connect Enhanced Fundraiser Analytics schema created successfully!';
    RAISE NOTICE 'Tables created: fundraising_campaigns, donations, donor_profiles, volunteer_hours, supply_donations';
    RAISE NOTICE 'Views created: monthly_donation_trends, donor_retention, campaign_performance';
    RAISE NOTICE 'RLS policies applied for multi-tenant security';
    RAISE NOTICE 'Performance indexes created for optimal query performance';
    RAISE NOTICE 'Triggers created for automatic updates';
END $$; 