/* eslint-disable no-console */
import { supabase } from './util/verifySupabaseToken.js';

/**
 * Middleware to enforce active or trialing subscription status
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.user?.user_metadata?.org_id;

    if (!orgId) {
      console.warn('[Subscription Check] Missing org_id in request');
      return res.status(403).json({ error: 'Missing organization ID' });
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('subscription_status')
      .eq('id', orgId)
      .single();

    if (error) {
      console.error('[Subscription Check] Supabase error:', error.message);
    }

    const status = (data?.subscription_status || '').toLowerCase();
    console.log(`[Subscription Check] Org ${orgId} subscription_status: ${status}`);

    if (!data || !['active', 'trialing'].includes(status)) {
      console.warn(`[Subscription Check] Org ${orgId} blocked due to status: ${status || 'N/A'}`);
      return res.status(403).json({ error: 'Subscription required or past due.' });
    }

    next();
  } catch (err) {
    console.error('[Subscription Check] Unexpected error:', err.message);
    res.status(500).json({ error: 'Internal server error during subscription check' });
  }
};
