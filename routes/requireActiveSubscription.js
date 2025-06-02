// middleware/requireActiveSubscription.js
const { supabase } = require('../services/supabase');

const requireActiveSubscription = async (req, res, next) => {
  const orgId = req.user.org_id;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('org_id', orgId)
    .single();

  if (error || !data || !['active', 'trialing'].includes(data.status)) {
    return res.status(403).json({ error: 'Subscription required or past due.' });
  }

  next();
};

module.exports = requireActiveSubscription;
