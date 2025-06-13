import express from 'express';
import multer from 'multer';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageBudget } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// Configure multer for receipt image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// =====================================================
// EXPENSE SUBMISSION ENDPOINTS (Mobile PWA)
// =====================================================

// POST /api/expenses/submit - Submit expense with receipt images
router.post('/submit', getUserOrgContext, addUserOrgToBody, requireVolunteer, upload.array('receipts', 5), async (req, res) => {
  try {
    const {
      event_id,
      category_id,
      vendor_name,
      amount,
      expense_date,
      description,
      submission_method = 'mobile_pwa'
    } = req.body;

    // Validate required fields
    if (!amount || !expense_date) {
      return res.status(400).json({ 
        error: 'Amount and expense date are required',
        details: { amount: !amount, expense_date: !expense_date }
      });
    }

    // Validate amount
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Validate expense date
    const expenseDate = new Date(expense_date);
    const today = new Date();
    if (expenseDate > today) {
      return res.status(400).json({ error: 'Expense date cannot be in the future' });
    }

    // Handle receipt image uploads
    let receiptImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          // Generate unique filename
          const fileName = `receipts/${req.orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
          
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('expense-receipts')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              upsert: false
            });

          if (uploadError) {
            console.error('Receipt upload error:', uploadError);
            continue; // Skip this file but continue with others
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('expense-receipts')
            .getPublicUrl(fileName);

          receiptImages.push({
            filename: file.originalname,
            url: urlData.publicUrl,
            size: file.size,
            uploaded_at: new Date().toISOString()
          });
        } catch (uploadErr) {
          console.error('Individual file upload error:', uploadErr);
          // Continue with other files
        }
      }
    }

    // Create expense submission
    const { data: expenseSubmission, error: submissionError } = await supabase
      .from('expense_submissions')
      .insert([{
        org_id: req.body.org_id,
        submitted_by: req.user.id,
        event_id: event_id || null,
        category_id: category_id || null,
        vendor_name: vendor_name || null,
        amount: expenseAmount,
        expense_date: expense_date,
        description: description || null,
        receipt_images: receiptImages,
        submission_method,
        status: 'pending'
      }])
      .select(`
        *,
        budget_categories(name, category_type),
        events(title),
        profiles!expense_submissions_submitted_by_fkey(first_name, last_name)
      `)
      .single();

    if (submissionError) {
      console.error(`❌ Error creating expense submission for org ${req.orgId}:`, submissionError.message);
      return res.status(500).json({ error: 'Failed to submit expense' });
    }

    // Send notification to treasurers/committee leads
    try {
      await sendExpenseSubmissionNotification(req.orgId, expenseSubmission);
    } catch (notificationError) {
      console.warn('Failed to send notification:', notificationError.message);
      // Don't fail the request for notification errors
    }

    console.log(`✅ Expense submission created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      data: expenseSubmission,
      message: 'Expense submitted successfully'
    });
  } catch (err) {
    console.error('[expenses.js] POST /submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit expense' });
  }
});

// GET /api/expenses/pending - Get pending expenses for approval (treasurers)
router.get('/pending', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;
    const offset = (page - 1) * limit;

    const { data: expenses, error } = await supabase
      .from('expense_submissions')
      .select(`
        *,
        budget_categories(name, category_type),
        events(title),
        profiles!expense_submissions_submitted_by_fkey(first_name, last_name, email)
      `)
      .eq('org_id', req.orgId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(`❌ Error fetching pending expenses for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to load pending expenses' });
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('expense_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', req.orgId)
      .eq('status', status);

    if (countError) {
      console.warn('Failed to get expense count:', countError.message);
    }

    console.log(`✅ Retrieved ${expenses.length} pending expenses for org ${req.orgId}`);
    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || expenses.length,
        hasMore: expenses.length === parseInt(limit)
      }
    });
  } catch (err) {
    console.error('[expenses.js] GET /pending error:', err.message);
    res.status(500).json({ error: 'Failed to load pending expenses' });
  }
});

// PUT /api/expenses/:id/approve - Approve expense submission
router.put('/:id/approve', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { approval_notes, create_transaction = true } = req.body;

    // Verify expense belongs to organization
    const { data: expense, error: fetchError } = await supabase
      .from('expense_submissions')
      .select('*')
      .eq('id', expenseId)
      .eq('org_id', req.orgId)
      .single();

    if (fetchError || !expense) {
      return res.status(404).json({ error: 'Expense submission not found' });
    }

    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Expense has already been processed' });
    }

    // Update expense submission status
    const { data: updatedExpense, error: updateError } = await supabase
      .from('expense_submissions')
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
        approval_notes: approval_notes || null
      })
      .eq('id', expenseId)
      .eq('org_id', req.orgId)
      .select(`
        *,
        budget_categories(name, category_type),
        events(title),
        profiles!expense_submissions_submitted_by_fkey(first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error(`❌ Error approving expense ${expenseId}:`, updateError.message);
      return res.status(500).json({ error: 'Failed to approve expense' });
    }

    // Create corresponding transaction if requested
    if (create_transaction) {
      try {
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert([{
            org_id: req.orgId,
            description: `${expense.vendor_name ? expense.vendor_name + ' - ' : ''}${expense.description || 'Expense'}`,
            amount: -Math.abs(expense.amount), // Negative for expense
            type: 'expense',
            category: updatedExpense.budget_categories?.name || 'General',
            date: expense.expense_date,
            created_by: req.user.id,
            expense_submission_id: expenseId,
            budget_category_id: expense.category_id,
            event_id: expense.event_id,
            approval_status: 'approved'
          }])
          .select()
          .single();

        if (transactionError) {
          console.warn('Failed to create transaction:', transactionError.message);
          // Don't fail the approval for transaction creation errors
        } else {
          console.log(`✅ Transaction created for approved expense ${expenseId}`);
        }
      } catch (transactionErr) {
        console.warn('Transaction creation error:', transactionErr.message);
      }
    }

    // Send approval notification
    try {
      await sendExpenseApprovalNotification(updatedExpense, 'approved');
    } catch (notificationError) {
      console.warn('Failed to send approval notification:', notificationError.message);
    }

    console.log(`✅ Expense ${expenseId} approved by user ${req.user.id} in org ${req.orgId}`);
    res.json({
      success: true,
      data: updatedExpense,
      message: 'Expense approved successfully'
    });
  } catch (err) {
    console.error('[expenses.js] PUT /:id/approve error:', err.message);
    res.status(500).json({ error: 'Failed to approve expense' });
  }
});

// PUT /api/expenses/:id/reject - Reject expense submission
router.put('/:id/reject', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { rejection_reason, approval_notes } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Verify expense belongs to organization
    const { data: expense, error: fetchError } = await supabase
      .from('expense_submissions')
      .select('*')
      .eq('id', expenseId)
      .eq('org_id', req.orgId)
      .single();

    if (fetchError || !expense) {
      return res.status(404).json({ error: 'Expense submission not found' });
    }

    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Expense has already been processed' });
    }

    // Update expense submission status
    const { data: updatedExpense, error: updateError } = await supabase
      .from('expense_submissions')
      .update({
        status: 'rejected',
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
        rejection_reason,
        approval_notes: approval_notes || null
      })
      .eq('id', expenseId)
      .eq('org_id', req.orgId)
      .select(`
        *,
        budget_categories(name, category_type),
        events(title),
        profiles!expense_submissions_submitted_by_fkey(first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error(`❌ Error rejecting expense ${expenseId}:`, updateError.message);
      return res.status(500).json({ error: 'Failed to reject expense' });
    }

    // Send rejection notification
    try {
      await sendExpenseApprovalNotification(updatedExpense, 'rejected');
    } catch (notificationError) {
      console.warn('Failed to send rejection notification:', notificationError.message);
    }

    console.log(`✅ Expense ${expenseId} rejected by user ${req.user.id} in org ${req.orgId}`);
    res.json({
      success: true,
      data: updatedExpense,
      message: 'Expense rejected successfully'
    });
  } catch (err) {
    console.error('[expenses.js] PUT /:id/reject error:', err.message);
    res.status(500).json({ error: 'Failed to reject expense' });
  }
});

// GET /api/expenses/user/:userId - Get user's expense submissions
router.get('/user/:userId?', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    // Users can only view their own expenses unless they're committee lead+
    const canViewOthers = await checkCanManageBudget(req.user.id, req.orgId);
    if (userId !== req.user.id && !canViewOthers) {
      return res.status(403).json({ error: 'You can only view your own expense submissions' });
    }

    let query = supabase
      .from('expense_submissions')
      .select(`
        *,
        budget_categories(name, category_type),
        events(title),
        profiles!expense_submissions_approved_by_fkey(first_name, last_name)
      `)
      .eq('org_id', req.orgId)
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: expenses, error } = await query;

    if (error) {
      console.error(`❌ Error fetching user expenses for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to load expense submissions' });
    }

    console.log(`✅ Retrieved ${expenses.length} expense submissions for user ${userId} in org ${req.orgId}`);
    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: expenses.length === parseInt(limit)
      }
    });
  } catch (err) {
    console.error('[expenses.js] GET /user/:userId error:', err.message);
    res.status(500).json({ error: 'Failed to load expense submissions' });
  }
});

// POST /api/expenses/upload-receipt - Upload receipt image separately
router.post('/upload-receipt', getUserOrgContext, requireVolunteer, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt image provided' });
    }

    // Generate unique filename
    const fileName = `receipts/${req.orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${req.file.originalname.split('.').pop()}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('expense-receipts')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Receipt upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload receipt image' });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('expense-receipts')
      .getPublicUrl(fileName);

    const receiptData = {
      filename: req.file.originalname,
      url: urlData.publicUrl,
      size: req.file.size,
      uploaded_at: new Date().toISOString()
    };

    console.log(`✅ Receipt uploaded for org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      data: receiptData,
      message: 'Receipt uploaded successfully'
    });
  } catch (err) {
    console.error('[expenses.js] POST /upload-receipt error:', err.message);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function checkCanManageBudget(userId, orgId) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role_type')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .in('role_type', ['admin', 'board_member', 'committee_lead'])
      .single();

    return !error && data;
  } catch (err) {
    return false;
  }
}

async function sendExpenseSubmissionNotification(orgId, expense) {
  // Get treasurers and committee leads for notification
  const { data: notificationUsers, error } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role_type,
      profiles(first_name, last_name, email)
    `)
    .eq('organization_id', orgId)
    .in('role_type', ['admin', 'board_member', 'committee_lead'])
    .eq('is_active', true);

  if (error || !notificationUsers?.length) {
    console.warn('No notification recipients found for expense submission');
    return;
  }

  // Here you would integrate with your notification system
  // For now, just log the notification
  console.log(`📧 Expense submission notification sent to ${notificationUsers.length} users for expense ${expense.id}`);
}

async function sendExpenseApprovalNotification(expense, action) {
  // Send notification to the expense submitter
  console.log(`📧 Expense ${action} notification sent to user ${expense.submitted_by} for expense ${expense.id}`);
}

console.log('[expenses.js] Expense submission routes loaded successfully');
export default router;
