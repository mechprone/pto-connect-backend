// middleware/requireActiveSubscription.js
import { supabase } from '../utils/supabaseClient.js'

export const requireActiveSubscription = async (req, res, next) => {
  const orgId = req.user.org_id

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('org_id', orgId)
    .single()

  if (error || !data || !['active', 'trialing'].includes(data.status)) {
    return res.status(403).json({ error: 'Subscription required or past due.' })
  }

  next()
}
