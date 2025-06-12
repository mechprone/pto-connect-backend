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

CREATE POLICY "Enable all for users based on organization"
ON reconciliations
FOR ALL
USING (
  org_id = (
    SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable all for users based on organization"
ON bank_transactions
FOR ALL
USING (
  (
    SELECT org_id FROM reconciliations WHERE id = reconciliation_id
  ) = (
    SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable all for users based on organization"
ON matched_transactions
FOR ALL
USING (
  (
    SELECT org_id FROM reconciliations WHERE id = reconciliation_id
  ) = (
    SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
  )
);
