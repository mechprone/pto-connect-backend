import express from 'express';
const router = express.Router();
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext as authenticate } from '../middleware/organizationalContext.js';

// Get all reconciliations for the organization
router.get('/', authenticate, async (req, res) => {
  const { org_id } = req.profile;

  try {
    const { data, error } = await supabase
      .from('reconciliations')
      .select('*')
      .eq('org_id', org_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reconciliations.', details: error.message });
  }
});

// Start a new reconciliation
router.post('/start', authenticate, async (req, res) => {
  console.log('🔍 [DEBUG] Reconciliation /start endpoint hit');
  console.log('🔍 [DEBUG] Request body:', req.body);
  console.log('🔍 [DEBUG] User profile:', req.profile);
  console.log('🔍 [DEBUG] Org ID:', req.orgId);
  
  const { month, year } = req.body;
  const { org_id } = req.profile;

  console.log('🔍 [DEBUG] Extracted values:', { month, year, org_id });

  if (!month || !year) {
    console.log('❌ [DEBUG] Missing month or year');
    return res.status(400).json({ 
      success: false,
      errors: [{ message: 'Month and year are required.' }]
    });
  }

  try {
    console.log('🔍 [DEBUG] Checking if reconciliation tables exist...');
    // Check if reconciliation tables exist
    const { data: tableCheck, error: checkError } = await supabase
      .from('reconciliations')
      .select('id')
      .limit(1);

    console.log('🔍 [DEBUG] Table check result:', { tableCheck, checkError });

    if (checkError && checkError.code === 'PGRST116') {
      // Table doesn't exist, return mock data for development
      console.log('⚠️ [DEBUG] Reconciliation tables not found, returning mock data');
      const mockReconciliation = {
        id: `mock-${Date.now()}`,
        org_id,
        month,
        year,
        status: 'in_progress',
        created_at: new Date().toISOString()
      };
      console.log('🔍 [DEBUG] Mock reconciliation:', mockReconciliation);
      return res.status(201).json({ success: true, data: mockReconciliation });
    }

    console.log('🔍 [DEBUG] Tables exist, creating reconciliation record...');
    const { data, error } = await supabase
      .from('reconciliations')
      .insert([{ org_id, month, year, status: 'in_progress' }])
      .select();

    console.log('🔍 [DEBUG] Insert result:', { data, error });

    if (error) {
      console.error('❌ [DEBUG] Insert error:', error);
      throw error;
    }
    
    console.log('✅ [DEBUG] Reconciliation created successfully:', data[0]);
    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    console.error('❌ [DEBUG] Failed to start reconciliation:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      errors: [{ message: 'Failed to start reconciliation' }],
      debug: {
        errorMessage: error.message,
        errorCode: error.code,
        orgId: org_id,
        month,
        year
      }
    });
  }
});

// Upload bank statement (placeholder for OCR integration)
router.post('/:id/upload', authenticate, async (req, res) => {
  const { id } = req.params;
  // In a real implementation, this would handle file uploads and OCR processing.
  // For now, we'll simulate the creation of bank transactions.
  const { transactions } = req.body; // Expecting an array of transactions

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Transactions array is required.' });
  }

  try {
    const transactionsToInsert = transactions.map(t => ({
      reconciliation_id: id,
      transaction_date: t.date,
      description: t.description,
      amount: t.amount
    }));

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert(transactionsToInsert)
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload bank statement.', details: error.message });
  }
});

// Get transactions for a reconciliation
router.get('/:id/transactions', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: reconciliation, error: recError } = await supabase
      .from('reconciliations')
      .select('*')
      .eq('id', id)
      .single();

    if (recError) throw recError;

    const { data: bankTransactions, error: bankError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('reconciliation_id', id);

    if (bankError) throw bankError;

    // Get actual expenses for the reconciliation period
    const { data: systemExpenses, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('org_id', reconciliation.org_id)
      .gte('expense_date', `${reconciliation.year}-${String(reconciliation.month).padStart(2, '0')}-01`)
      .lte('expense_date', `${reconciliation.year}-${String(reconciliation.month).padStart(2, '0')}-31`)
      .eq('status', 'approved')
      .order('expense_date', { ascending: true });

    if (expenseError) {
      console.error('Error fetching expenses:', expenseError);
      // If expenses table doesn't exist yet, return empty array
      const systemExpenses = [];
    }

    res.status(200).json({
      success: true,
      data: {
        reconciliation,
        bankTransactions,
        systemExpenses
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions.', details: error.message });
  }
});

// Match a transaction
router.post('/:id/match', authenticate, async (req, res) => {
  const { id: reconciliation_id } = req.params;
  const { bank_transaction_id, expense_id } = req.body;

  if (!bank_transaction_id || !expense_id) {
    return res.status(400).json({ error: 'Bank transaction ID and expense ID are required.' });
  }

  try {
    // Create the match
    const { data: match, error: matchError } = await supabase
      .from('matched_transactions')
      .insert([{ reconciliation_id, bank_transaction_id, expense_id }])
      .select()
      .single();

    if (matchError) throw matchError;

    // Mark the bank transaction as matched
    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({ is_matched: true })
      .eq('id', bank_transaction_id);

    if (updateError) throw updateError;

    res.status(201).json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ error: 'Failed to match transaction.', details: error.message });
  }
});

export default router;
