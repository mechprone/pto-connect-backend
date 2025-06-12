-- Migration for creating reconciliation tables

CREATE TABLE reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID REFERENCES reconciliations(id) ON DELETE CASCADE,
  transaction_date DATE,
  description TEXT,
  amount DECIMAL(10, 2),
  is_matched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE matched_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id UUID REFERENCES bank_transactions(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  reconciliation_id UUID REFERENCES reconciliations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matched_transactions ENABLE ROW LEVEL SECURITY;

-- Reconciliations RLS Policies
CREATE POLICY "Users can view reconciliations for their organization" ON reconciliations
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Treasurers and above can manage reconciliations" ON reconciliations
  FOR ALL USING (
    org_id IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'treasurer', 'committee_lead')
    )
  );

-- Bank Transactions RLS Policies
CREATE POLICY "Users can view bank transactions for their organization" ON bank_transactions
  FOR SELECT USING (
    (
      SELECT org_id FROM reconciliations WHERE id = reconciliation_id
    ) IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Treasurers and above can manage bank transactions" ON bank_transactions
  FOR ALL USING (
    (
      SELECT org_id FROM reconciliations WHERE id = reconciliation_id
    ) IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'treasurer', 'committee_lead')
    )
  );

-- Matched Transactions RLS Policies
CREATE POLICY "Users can view matched transactions for their organization" ON matched_transactions
  FOR SELECT USING (
    (
      SELECT org_id FROM reconciliations WHERE id = reconciliation_id
    ) IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Treasurers and above can manage matched transactions" ON matched_transactions
  FOR ALL USING (
    (
      SELECT org_id FROM reconciliations WHERE id = reconciliation_id
    ) IN (
      SELECT ur.organization_id FROM user_roles ur
      JOIN user_profiles up ON ur.user_id = up.user_id
      WHERE up.user_id = auth.uid()
      AND ur.role_type IN ('admin', 'board_member', 'treasurer', 'committee_lead')
    )
  );
