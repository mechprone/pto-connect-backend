import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageBudget } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/budget – Get all transactions for user's organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching transactions for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to load transactions' });
    }

    console.log(`✅ Retrieved ${data.length} transactions for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[budget.js] GET /budget error:', err.message);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// POST /api/budget – Create a new transaction (committee lead+ required)
router.post('/', getUserOrgContext, addUserOrgToBody, canManageBudget, async (req, res) => {
  try {
    const {
      description,
      amount,
      type,
      category,
      date,
      receipt_url,
      approved_by
    } = req.body;

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        description,
        amount,
        type,
        category,
        date,
        receipt_url,
        approved_by,
        org_id: req.body.org_id, // Added by addUserOrgToBody middleware
        created_by: req.user.id
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating transaction for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }

    console.log(`✅ Transaction created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('[budget.js] POST /budget error:', err.message);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/budget/:id – Update a transaction (committee lead+ required)
router.put('/:id', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const {
      description,
      amount,
      type,
      category,
      date,
      receipt_url,
      approved_by
    } = req.body;

    // Verify transaction belongs to user's organization
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('org_id')
      .eq('id', transactionId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching transaction ${transactionId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching transaction' });
    }

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Transaction ${transactionId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Transaction not found in your organization' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({
        description,
        amount,
        type,
        category,
        date,
        receipt_url,
        approved_by,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating transaction ${transactionId}:`, error.message);
      return res.status(500).json({ error: 'Failed to update transaction' });
    }

    console.log(`✅ Transaction ${transactionId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json(data);
  } catch (err) {
    console.error('[budget.js] PUT /budget/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/budget/:id – Delete a transaction (committee lead+ required)
router.delete('/:id', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const transactionId = req.params.id;

    // Verify transaction belongs to user's organization
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('org_id')
      .eq('id', transactionId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching transaction ${transactionId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching transaction' });
    }

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Transaction ${transactionId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Transaction not found in your organization' });
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting transaction ${transactionId}:`, error.message);
      return res.status(500).json({ error: 'Failed to delete transaction' });
    }

    console.log(`✅ Transaction ${transactionId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.status(204).send();
  } catch (err) {
    console.error('[budget.js] DELETE /budget/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

console.log('[budget.js] Routes loaded successfully');
export default router;
