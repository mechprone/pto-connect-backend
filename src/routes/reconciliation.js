const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabaseClient');
const { authenticate } = require('../middleware/auth');

// Get all reconciliations for the organization
router.get('/', authenticate, async (req, res) => {
  const { org_id } = req.user;

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
  const { month, year } = req.body;
  const { org_id } = req.user;

  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required.' });
  }

  try {
    const { data, error } = await supabase
      .from('reconciliations')
      .insert([{ org_id, month, year, status: 'in_progress' }])
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start reconciliation.', details: error.message });
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

    // This would also fetch the relevant system expenses
    // For now, we'll just return the bank transactions

    res.status(200).json({
      success: true,
      data: {
        reconciliation,
        bankTransactions
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions.', details: error.message });
  }
});

module.exports = router;
