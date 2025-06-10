-- =====================================================
-- PTO Connect Budget & Financial Management Module
-- Database Schema Implementation
-- Phase 3 Week 3-4: Budget Module Enhancement
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. BUDGET CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  budget_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  spent_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  category_type VARCHAR(50) NOT NULL CHECK (category_type IN ('expense', 'revenue')),
  parent_category_id UUID REFERENCES budget_categories(id),
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT budget_categories_org_name_year_unique UNIQUE (org_id, name, fiscal_year),
  CONSTRAINT budget_categories_positive_amounts CHECK (budget_amount >= 0 AND spent_amount >= 0)
);

-- =====================================================
-- 2. EXPENSE SUBMISSIONS TABLE (Mobile PWA)
-- =====================================================
CREATE TABLE IF NOT EXISTS expense_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  event_id UUID REFERENCES events(id),
  category_id UUID REFERENCES budget_categories(id),
  vendor_name VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  receipt_images JSONB DEFAULT '[]',
  submission_method VARCHAR(50) DEFAULT 'mobile_pwa' CHECK (submission_method IN ('mobile_pwa', 'web_form', 'email', 'manual')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
  approval_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  resubmission_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT expense_submissions_positive_amount CHECK (amount > 0),
  CONSTRAINT expense_submissions_valid_date CHECK (expense_date <= CURRENT_DATE),
  CONSTRAINT expense_submissions_approval_logic CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    (status != 'approved')
  )
);

-- =====================================================
-- 3. BUDGET PLANS & TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget DECIMAL(12,2) NOT NULL,
  total_allocated DECIMAL(12,2) DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT budget_plans_org_name_year_unique UNIQUE (org_id, name, fiscal_year),
  CONSTRAINT budget_plans_positive_amounts CHECK (total_budget >= 0 AND total_allocated >= 0 AND total_spent >= 0),
  CONSTRAINT budget_plans_valid_dates CHECK (end_date > start_date)
);

-- =====================================================
-- 4. FUNDRAISING CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS fundraising_campaigns (
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
-- 5. FINANCIAL REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type VARCHAR(100) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  report_data JSONB NOT NULL,
  report_summary JSONB DEFAULT '{}',
  generated_by UUID REFERENCES auth.users(id),
  submitted_to_officials BOOLEAN DEFAULT false,
  submission_date TIMESTAMP WITH TIME ZONE,
  file_url TEXT,
  file_format VARCHAR(20) DEFAULT 'pdf' CHECK (file_format IN ('pdf', 'excel', 'csv')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT financial_reports_valid_dates CHECK (report_period_end >= report_period_start)
);

-- =====================================================
-- 6. SCHOOL/DISTRICT OFFICIALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS school_officials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  official_type VARCHAR(50) NOT NULL CHECK (official_type IN (
    'school_treasurer', 'principal', 'assistant_principal', 'business_manager', 
    'district_financial', 'superintendent', 'board_member'
  )),
  permission_level VARCHAR(50) DEFAULT 'basic' CHECK (permission_level IN ('basic', 'detailed', 'full')),
  permissions_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_report_sent TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT school_officials_org_email_unique UNIQUE (org_id, email),
  CONSTRAINT school_officials_valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =====================================================
-- 7. APPROVAL WORKFLOWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_name VARCHAR(255) NOT NULL,
  workflow_type VARCHAR(50) NOT NULL CHECK (workflow_type IN ('expense_approval', 'budget_approval', 'report_approval')),
  rules JSONB NOT NULL DEFAULT '{}',
  approval_chain JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT approval_workflows_org_name_type_unique UNIQUE (org_id, workflow_name, workflow_type)
);

-- =====================================================
-- 8. ENHANCE EXISTING TRANSACTIONS TABLE
-- =====================================================
-- Add new columns to existing transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS expense_submission_id UUID REFERENCES expense_submissions(id),
ADD COLUMN IF NOT EXISTS budget_category_id UUID REFERENCES budget_categories(id),
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES fundraising_campaigns(id),
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approval_workflow JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);

-- =====================================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Budget Categories Indexes
CREATE INDEX IF NOT EXISTS idx_budget_categories_org_id ON budget_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_fiscal_year ON budget_categories(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_categories_type ON budget_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_budget_categories_active ON budget_categories(is_active) WHERE is_active = true;

-- Expense Submissions Indexes
CREATE INDEX IF NOT EXISTS idx_expense_submissions_org_id ON expense_submissions(org_id);
CREATE INDEX IF NOT EXISTS idx_expense_submissions_submitted_by ON expense_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_expense_submissions_status ON expense_submissions(status);
CREATE INDEX IF NOT EXISTS idx_expense_submissions_date ON expense_submissions(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_submissions_event_id ON expense_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_expense_submissions_category_id ON expense_submissions(category_id);

-- Budget Plans Indexes
CREATE INDEX IF NOT EXISTS idx_budget_plans_org_id ON budget_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_fiscal_year ON budget_plans(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_plans_status ON budget_plans(status);

-- Fundraising Campaigns Indexes
CREATE INDEX IF NOT EXISTS idx_fundraising_campaigns_org_id ON fundraising_campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_campaigns_status ON fundraising_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_fundraising_campaigns_dates ON fundraising_campaigns(start_date, end_date);

-- Financial Reports Indexes
CREATE INDEX IF NOT EXISTS idx_financial_reports_org_id ON financial_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_financial_reports_type ON financial_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_financial_reports_period ON financial_reports(report_period_start, report_period_end);

-- School Officials Indexes
CREATE INDEX IF NOT EXISTS idx_school_officials_org_id ON school_officials(org_id);
CREATE INDEX IF NOT EXISTS idx_school_officials_type ON school_officials(official_type);
CREATE INDEX IF NOT EXISTS idx_school_officials_active ON school_officials(is_active) WHERE is_active = true;

-- Enhanced Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_expense_submission_id ON transactions(expense_submission_id);
CREATE INDEX IF NOT EXISTS idx_transactions_budget_category_id ON transactions(budget_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_approval_status ON transactions(approval_status);

-- =====================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

-- Budget Categories RLS Policies
CREATE POLICY "Users can view budget categories for their organization" ON budget_categories
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Committee leads and above can manage budget categories" ON budget_categories
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Expense Submissions RLS Policies
CREATE POLICY "Users can view expense submissions for their organization" ON expense_submissions
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create expense submissions for their organization" ON expense_submissions
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Users can update their own expense submissions" ON expense_submissions
  FOR UPDATE USING (submitted_by = auth.uid());

CREATE POLICY "Committee leads and above can manage all expense submissions" ON expense_submissions
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Budget Plans RLS Policies
CREATE POLICY "Users can view budget plans for their organization" ON budget_plans
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Committee leads and above can manage budget plans" ON budget_plans
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Fundraising Campaigns RLS Policies
CREATE POLICY "Users can view fundraising campaigns for their organization" ON fundraising_campaigns
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Committee leads and above can manage fundraising campaigns" ON fundraising_campaigns
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- Financial Reports RLS Policies
CREATE POLICY "Users can view financial reports for their organization" ON financial_reports
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Committee leads and above can manage financial reports" ON financial_reports
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'committee_lead')
    )
  );

-- School Officials RLS Policies
CREATE POLICY "Users can view school officials for their organization" ON school_officials
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and board members can manage school officials" ON school_officials
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member')
    )
  );

-- Approval Workflows RLS Policies
CREATE POLICY "Users can view approval workflows for their organization" ON approval_workflows
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and board members can manage approval workflows" ON approval_workflows
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member')
    )
  );

-- =====================================================
-- 11. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_budget_categories_updated_at BEFORE UPDATE ON budget_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_submissions_updated_at BEFORE UPDATE ON expense_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_plans_updated_at BEFORE UPDATE ON budget_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fundraising_campaigns_updated_at BEFORE UPDATE ON fundraising_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_school_officials_updated_at BEFORE UPDATE ON school_officials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 12. SAMPLE DATA FOR DEVELOPMENT (Optional)
-- =====================================================

-- Insert sample budget categories for development
-- (This would be organization-specific in production)
/*
INSERT INTO budget_categories (org_id, name, description, budget_amount, category_type, fiscal_year) VALUES
  -- Sample expense categories
  ('your-org-id-here', 'Events & Programs', 'Funding for school events and educational programs', 15000.00, 'expense', 2024),
  ('your-org-id-here', 'Educational Support', 'Classroom supplies and educational materials', 12000.00, 'expense', 2024),
  ('your-org-id-here', 'Communications', 'Website, printing, and communication costs', 3000.00, 'expense', 2024),
  ('your-org-id-here', 'Administrative', 'Insurance, banking fees, and office supplies', 5000.00, 'expense', 2024),
  
  -- Sample revenue categories
  ('your-org-id-here', 'Fundraising Events', 'Revenue from fundraising activities', 25000.00, 'revenue', 2024),
  ('your-org-id-here', 'Donations', 'Direct donations from families and community', 10000.00, 'revenue', 2024),
  ('your-org-id-here', 'Grants', 'Educational grants and awards', 5000.00, 'revenue', 2024);
*/

-- =====================================================
-- SCHEMA IMPLEMENTATION COMPLETE
-- =====================================================

-- Log successful schema creation
DO $$
BEGIN
    RAISE NOTICE 'PTO Connect Budget & Financial Management Module schema created successfully!';
    RAISE NOTICE 'Tables created: budget_categories, expense_submissions, budget_plans, fundraising_campaigns, financial_reports, school_officials, approval_workflows';
    RAISE NOTICE 'Enhanced transactions table with new budget-related columns';
    RAISE NOTICE 'RLS policies applied for multi-tenant security';
    RAISE NOTICE 'Performance indexes created for optimal query performance';
    RAISE NOTICE 'Ready for Phase 2: Backend API Development';
END $$;
