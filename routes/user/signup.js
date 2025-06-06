import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ POST /api/signup/complete – Onboarding first admin + Organization
router.post('/complete', async (req, res) => {
  const {
    ptoName,
    schoolName,
    adminName,
    adminEmail,
    adminPassword,
    stripeCustomerId,
    stripeSubscriptionId
  } = req.body;

  if (!ptoName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Generate unique signup code and slug
    const signupCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const slug = ptoName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: ptoName,
        slug: slug,
        signup_code: signupCode,
        subscription_status: stripeSubscriptionId ? 'active' : 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        settings: {
          school_name: schoolName
        }
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Create admin user
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });

    if (userError) throw userError;

    // Create admin profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.user.id,
        org_id: organization.id,
        email: adminEmail,
        full_name: adminName,
        role: 'admin',
        is_active: true
      });

    if (profileError) throw profileError;

    return res.json({ 
      success: true, 
      organization: {
        id: organization.id,
        name: organization.name,
        signup_code: organization.signup_code,
        slug: organization.slug
      }
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ✅ POST /api/signup/join – Join existing organization with signup code
router.post('/join', async (req, res) => {
  const {
    signupCode,
    userEmail,
    userPassword,
    fullName,
    role = 'parent_member'
  } = req.body;

  if (!signupCode || !userEmail || !userPassword || !fullName) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Find organization by signup code
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, subscription_status')
      .eq('signup_code', signupCode.toUpperCase())
      .single();

    if (orgError || !organization) {
      return res.status(404).json({ error: 'Invalid signup code.' });
    }

    // Check if organization has active subscription
    if (organization.subscription_status === 'canceled' || organization.subscription_status === 'unpaid') {
      return res.status(403).json({ error: 'Organization subscription is not active.' });
    }

    // Create user
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true
    });

    if (userError) throw userError;

    // Create user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.user.id,
        org_id: organization.id,
        email: userEmail,
        full_name: fullName,
        role: role,
        is_active: true
      });

    if (profileError) throw profileError;

    return res.json({ 
      success: true,
      organization: {
        id: organization.id,
        name: organization.name
      }
    });
  } catch (err) {
    console.error('Join organization error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

console.log('[signup.js] Routes loaded successfully');
export default router;
