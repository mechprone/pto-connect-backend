import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageBudget } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// =====================================================
// BUDGET CATEGORIES ENDPOINTS
// =====================================================

// GET /api/budget/categories - Get budget categories with spending analysis
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { 
      fiscal_year = new Date().getFullYear(), 
      category_type, 
      include_inactive = false,
      include_spending = true 
    } = req.query;

    let query = supabase
      .from('budget_categories')
      .select('*')
      .eq('org_id', req.orgId)
      .eq('fiscal_year', fiscal_year)
      .order('name');

    if (category_type) {
      query = query.eq('category_type', category_type);
    }

    if (!include_inactive) {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error(`❌ Error fetching budget categories for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to load budget categories' });
    }

    // Calculate spending analysis if requested
    if (include_spending && categories.length > 0) {
      const categoryIds = categories.map(cat => cat.id);
      
      // Get actual spending from transactions
      const { data: transactions, error: transactionError } = await supabase
        .from('transactions')
        .select('budget_category_id, amount, type')
        .eq('org_id', req.orgId)
        .in('budget_category_id', categoryIds)
        .gte('date', `${fiscal_year}-01-01`)
        .lte('date', `${fiscal_year}-12-31`);

      if (!transactionError && transactions) {
        // Calculate actual spending per category
        const spendingByCategory = transactions.reduce((acc, transaction) => {
          if (!acc[transaction.budget_category_id]) {
            acc[transaction.budget_category_id] = { spent: 0, revenue: 0 };
          }
          
          if (transaction.type === 'expense') {
            acc[transaction.budget_category_id].spent += Math.abs(transaction.amount);
          } else if (transaction.type === 'income') {
            acc[transaction.budget_category_id].revenue += Math.abs(transaction.amount);
          }
          
          return acc;
        }, {});

        // Update categories with actual spending
        categories.forEach(category => {
          const spending = spendingByCategory[category.id] || { spent: 0, revenue: 0 };
          category.actual_spent = spending.spent;
          category.actual_revenue = spending.revenue;
          category.remaining = category.budget_amount - spending.spent;
          category.percentage_used = category.budget_amount > 0 
            ? (spending.spent / category.budget_amount) * 100 
            : 0;
          category.is_over_budget = spending.spent > category.budget_amount;
        });
      }
    }

    // Calculate totals
    const totals = categories.reduce((acc, category) => {
      if (category.category_type === 'expense') {
        acc.total_expense_budget += category.budget_amount;
        acc.total_expense_spent += category.actual_spent || 0;
      } else if (category.category_type === 'revenue') {
        acc.total_revenue_budget += category.budget_amount;
        acc.total_revenue_actual += category.actual_revenue || 0;
      }
      return acc;
    }, {
      total_expense_budget: 0,
      total_expense_spent: 0,
      total_revenue_budget: 0,
      total_revenue_actual: 0
    });

    console.log(`✅ Retrieved ${categories.length} budget categories for org ${req.orgId}`);
    res.json({
      success: true,
      data: categories,
      totals,
      fiscal_year: parseInt(fiscal_year)
    });
  } catch (err) {
    console.error('[categories.js] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to load budget categories' });
  }
});

// POST /api/budget/categories - Create new budget category
router.post('/', getUserOrgContext, addUserOrgToBody, canManageBudget, async (req, res) => {
  try {
    const {
      name,
      description,
      budget_amount,
      category_type,
      parent_category_id,
      fiscal_year = new Date().getFullYear()
    } = req.body;

    // Validate required fields
    if (!name || !category_type || budget_amount === undefined) {
      return res.status(400).json({ 
        error: 'Name, category type, and budget amount are required',
        details: { 
          name: !name, 
          category_type: !category_type, 
          budget_amount: budget_amount === undefined 
        }
      });
    }

    // Validate category type
    if (!['expense', 'revenue'].includes(category_type)) {
      return res.status(400).json({ error: 'Category type must be either "expense" or "revenue"' });
    }

    // Validate budget amount
    const budgetAmount = parseFloat(budget_amount);
    if (isNaN(budgetAmount) || budgetAmount < 0) {
      return res.status(400).json({ error: 'Budget amount must be a non-negative number' });
    }

    // Check for duplicate category name in the same fiscal year
    const { data: existingCategory, error: duplicateError } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('org_id', req.body.org_id)
      .eq('name', name)
      .eq('fiscal_year', fiscal_year)
      .single();

    if (existingCategory) {
      return res.status(409).json({ error: 'A budget category with this name already exists for this fiscal year' });
    }

    // Validate parent category if provided
    if (parent_category_id) {
      const { data: parentCategory, error: parentError } = await supabase
        .from('budget_categories')
        .select('id, category_type')
        .eq('id', parent_category_id)
        .eq('org_id', req.body.org_id)
        .single();

      if (parentError || !parentCategory) {
        return res.status(400).json({ error: 'Invalid parent category' });
      }

      if (parentCategory.category_type !== category_type) {
        return res.status(400).json({ error: 'Parent category must be the same type (expense/revenue)' });
      }
    }

    // Create budget category
    const { data: category, error: createError } = await supabase
      .from('budget_categories')
      .insert([{
        org_id: req.body.org_id,
        name,
        description: description || null,
        budget_amount: budgetAmount,
        category_type,
        parent_category_id: parent_category_id || null,
        fiscal_year,
        created_by: req.user.id
      }])
      .select('*')
      .single();

    if (createError) {
      console.error(`❌ Error creating budget category for org ${req.orgId}:`, createError.message);
      return res.status(500).json({ error: 'Failed to create budget category' });
    }

    console.log(`✅ Budget category created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      data: category,
      message: 'Budget category created successfully'
    });
  } catch (err) {
    console.error('[categories.js] POST / error:', err.message);
    res.status(500).json({ error: 'Failed to create budget category' });
  }
});

// PUT /api/budget/categories/:id - Update budget category
router.put('/:id', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const categoryId = req.params.id;
    const {
      name,
      description,
      budget_amount,
      category_type,
      parent_category_id,
      is_active
    } = req.body;

    // Verify category belongs to organization
    const { data: existingCategory, error: fetchError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('org_id', req.orgId)
      .single();

    if (fetchError || !existingCategory) {
      return res.status(404).json({ error: 'Budget category not found' });
    }

    // Prepare update data
    const updateData = {};
    
    if (name !== undefined) {
      // Check for duplicate name if changing
      if (name !== existingCategory.name) {
        const { data: duplicateCategory } = await supabase
          .from('budget_categories')
          .select('id')
          .eq('org_id', req.orgId)
          .eq('name', name)
          .eq('fiscal_year', existingCategory.fiscal_year)
          .neq('id', categoryId)
          .single();

        if (duplicateCategory) {
          return res.status(409).json({ error: 'A budget category with this name already exists for this fiscal year' });
        }
      }
      updateData.name = name;
    }

    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (budget_amount !== undefined) {
      const budgetAmount = parseFloat(budget_amount);
      if (isNaN(budgetAmount) || budgetAmount < 0) {
        return res.status(400).json({ error: 'Budget amount must be a non-negative number' });
      }
      updateData.budget_amount = budgetAmount;
    }

    if (category_type !== undefined) {
      if (!['expense', 'revenue'].includes(category_type)) {
        return res.status(400).json({ error: 'Category type must be either "expense" or "revenue"' });
      }
      updateData.category_type = category_type;
    }

    if (parent_category_id !== undefined) {
      if (parent_category_id) {
        // Validate parent category
        const { data: parentCategory, error: parentError } = await supabase
          .from('budget_categories')
          .select('id, category_type')
          .eq('id', parent_category_id)
          .eq('org_id', req.orgId)
          .single();

        if (parentError || !parentCategory) {
          return res.status(400).json({ error: 'Invalid parent category' });
        }

        const finalCategoryType = category_type || existingCategory.category_type;
        if (parentCategory.category_type !== finalCategoryType) {
          return res.status(400).json({ error: 'Parent category must be the same type (expense/revenue)' });
        }

        // Prevent circular references
        if (parent_category_id === categoryId) {
          return res.status(400).json({ error: 'Category cannot be its own parent' });
        }
      }
      updateData.parent_category_id = parent_category_id;
    }

    // Update category
    const { data: updatedCategory, error: updateError } = await supabase
      .from('budget_categories')
      .update(updateData)
      .eq('id', categoryId)
      .eq('org_id', req.orgId)
      .select('*')
      .single();

    if (updateError) {
      console.error(`❌ Error updating budget category ${categoryId}:`, updateError.message);
      return res.status(500).json({ error: 'Failed to update budget category' });
    }

    console.log(`✅ Budget category ${categoryId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      data: updatedCategory,
      message: 'Budget category updated successfully'
    });
  } catch (err) {
    console.error('[categories.js] PUT /:id error:', err.message);
    res.status(500).json({ error: 'Failed to update budget category' });
  }
});

// DELETE /api/budget/categories/:id - Delete budget category
router.delete('/:id', getUserOrgContext, canManageBudget, async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Verify category belongs to organization
    const { data: category, error: fetchError } = await supabase
      .from('budget_categories')
      .select('id, name')
      .eq('id', categoryId)
      .eq('org_id', req.orgId)
      .single();

    if (fetchError || !category) {
      return res.status(404).json({ error: 'Budget category not found' });
    }

    // Check if category has child categories
    const { data: childCategories, error: childError } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('parent_category_id', categoryId)
      .eq('org_id', req.orgId);

    if (childError) {
      console.error('Error checking child categories:', childError.message);
      return res.status(500).json({ error: 'Failed to verify category dependencies' });
    }

    if (childCategories && childCategories.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with subcategories',
        details: `This category has ${childCategories.length} subcategories. Please delete or reassign them first.`
      });
    }

    // Check if category has associated transactions
    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .select('id')
      .eq('budget_category_id', categoryId)
      .eq('org_id', req.orgId)
      .limit(1);

    if (transactionError) {
      console.error('Error checking transactions:', transactionError.message);
      return res.status(500).json({ error: 'Failed to verify category usage' });
    }

    if (transactions && transactions.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with associated transactions',
        details: 'This category has transactions associated with it. Consider deactivating instead of deleting.'
      });
    }

    // Check if category has associated expense submissions
    const { data: expenseSubmissions, error: expenseError } = await supabase
      .from('expense_submissions')
      .select('id')
      .eq('category_id', categoryId)
      .eq('org_id', req.orgId)
      .limit(1);

    if (expenseError) {
      console.error('Error checking expense submissions:', expenseError.message);
      return res.status(500).json({ error: 'Failed to verify category usage' });
    }

    if (expenseSubmissions && expenseSubmissions.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with associated expense submissions',
        details: 'This category has expense submissions associated with it. Consider deactivating instead of deleting.'
      });
    }

    // Delete category
    const { error: deleteError } = await supabase
      .from('budget_categories')
      .delete()
      .eq('id', categoryId)
      .eq('org_id', req.orgId);

    if (deleteError) {
      console.error(`❌ Error deleting budget category ${categoryId}:`, deleteError.message);
      return res.status(500).json({ error: 'Failed to delete budget category' });
    }

    console.log(`✅ Budget category ${categoryId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      message: 'Budget category deleted successfully'
    });
  } catch (err) {
    console.error('[categories.js] DELETE /:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete budget category' });
  }
});

// GET /api/budget/categories/templates - Get predefined category templates
router.get('/templates', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { category_type } = req.query;

    const templates = {
      expense: [
        {
          name: 'Events & Programs',
          description: 'Funding for school events and educational programs',
          typical_amount: 15000,
          subcategories: [
            { name: 'Fall Festival', typical_amount: 5000 },
            { name: 'Science Night', typical_amount: 3000 },
            { name: 'Book Fair', typical_amount: 4000 },
            { name: 'Art Show', typical_amount: 3000 }
          ]
        },
        {
          name: 'Educational Support',
          description: 'Classroom supplies and educational materials',
          typical_amount: 12000,
          subcategories: [
            { name: 'Classroom Supplies', typical_amount: 6000 },
            { name: 'Technology', typical_amount: 4000 },
            { name: 'Library Books', typical_amount: 2000 }
          ]
        },
        {
          name: 'Communications',
          description: 'Website, printing, and communication costs',
          typical_amount: 3000,
          subcategories: [
            { name: 'Website & Digital', typical_amount: 1500 },
            { name: 'Print Materials', typical_amount: 1000 },
            { name: 'Social Media', typical_amount: 500 }
          ]
        },
        {
          name: 'Administrative',
          description: 'Insurance, banking fees, and office supplies',
          typical_amount: 5000,
          subcategories: [
            { name: 'Insurance', typical_amount: 2000 },
            { name: 'Banking & Fees', typical_amount: 1000 },
            { name: 'Office Supplies', typical_amount: 2000 }
          ]
        },
        {
          name: 'Teacher Appreciation',
          description: 'Staff recognition and appreciation events',
          typical_amount: 4000,
          subcategories: [
            { name: 'Teacher Appreciation Week', typical_amount: 2000 },
            { name: 'Holiday Gifts', typical_amount: 1000 },
            { name: 'End of Year Celebration', typical_amount: 1000 }
          ]
        }
      ],
      revenue: [
        {
          name: 'Fundraising Events',
          description: 'Revenue from fundraising activities',
          typical_amount: 25000,
          subcategories: [
            { name: 'Fall Festival Revenue', typical_amount: 8000 },
            { name: 'Spring Carnival', typical_amount: 7000 },
            { name: 'Silent Auction', typical_amount: 10000 }
          ]
        },
        {
          name: 'Direct Donations',
          description: 'Direct donations from families and community',
          typical_amount: 10000,
          subcategories: [
            { name: 'Annual Giving Campaign', typical_amount: 6000 },
            { name: 'Corporate Sponsorships', typical_amount: 4000 }
          ]
        },
        {
          name: 'Product Sales',
          description: 'Revenue from product sales',
          typical_amount: 8000,
          subcategories: [
            { name: 'Book Fair Commission', typical_amount: 3000 },
            { name: 'Spirit Wear Sales', typical_amount: 2500 },
            { name: 'Concession Sales', typical_amount: 2500 }
          ]
        },
        {
          name: 'Grants & Awards',
          description: 'Educational grants and awards',
          typical_amount: 5000,
          subcategories: [
            { name: 'Educational Foundation Grants', typical_amount: 3000 },
            { name: 'Community Foundation Grants', typical_amount: 2000 }
          ]
        }
      ]
    };

    let responseData = templates;
    if (category_type && templates[category_type]) {
      responseData = { [category_type]: templates[category_type] };
    }

    console.log(`✅ Retrieved budget category templates for org ${req.orgId}`);
    res.json({
      success: true,
      data: responseData,
      message: 'Budget category templates retrieved successfully'
    });
  } catch (err) {
    console.error('[categories.js] GET /templates error:', err.message);
    res.status(500).json({ error: 'Failed to load budget category templates' });
  }
});

// POST /api/budget/categories/bulk-create - Create multiple categories from templates
router.post('/bulk-create', getUserOrgContext, addUserOrgToBody, canManageBudget, async (req, res) => {
  try {
    const { categories, fiscal_year = new Date().getFullYear() } = req.body;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Categories array is required' });
    }

    const createdCategories = [];
    const errors = [];

    for (const categoryData of categories) {
      try {
        const {
          name,
          description,
          budget_amount,
          category_type,
          subcategories = []
        } = categoryData;

        // Validate required fields
        if (!name || !category_type || budget_amount === undefined) {
          errors.push({ name, error: 'Name, category type, and budget amount are required' });
          continue;
        }

        // Check for duplicate
        const { data: existingCategory } = await supabase
          .from('budget_categories')
          .select('id')
          .eq('org_id', req.body.org_id)
          .eq('name', name)
          .eq('fiscal_year', fiscal_year)
          .single();

        if (existingCategory) {
          errors.push({ name, error: 'Category already exists' });
          continue;
        }

        // Create main category
        const { data: mainCategory, error: createError } = await supabase
          .from('budget_categories')
          .insert([{
            org_id: req.body.org_id,
            name,
            description: description || null,
            budget_amount: parseFloat(budget_amount),
            category_type,
            fiscal_year,
            created_by: req.user.id
          }])
          .select('*')
          .single();

        if (createError) {
          errors.push({ name, error: createError.message });
          continue;
        }

        createdCategories.push(mainCategory);

        // Create subcategories if provided
        for (const subcat of subcategories) {
          try {
            const { data: subCategory, error: subError } = await supabase
              .from('budget_categories')
              .insert([{
                org_id: req.body.org_id,
                name: subcat.name,
                description: subcat.description || null,
                budget_amount: parseFloat(subcat.budget_amount || subcat.typical_amount || 0),
                category_type,
                parent_category_id: mainCategory.id,
                fiscal_year,
                created_by: req.user.id
              }])
              .select('*')
              .single();

            if (!subError) {
              createdCategories.push(subCategory);
            }
          } catch (subErr) {
            console.warn(`Failed to create subcategory ${subcat.name}:`, subErr.message);
          }
        }
      } catch (categoryErr) {
        errors.push({ name: categoryData.name, error: categoryErr.message });
      }
    }

    console.log(`✅ Bulk created ${createdCategories.length} budget categories for org ${req.orgId}`);
    res.status(201).json({
      success: true,
      data: createdCategories,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully created ${createdCategories.length} budget categories${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    });
  } catch (err) {
    console.error('[categories.js] POST /bulk-create error:', err.message);
    res.status(500).json({ error: 'Failed to create budget categories' });
  }
});

console.log('[categories.js] Budget categories routes loaded successfully');
export default router;
