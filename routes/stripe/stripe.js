import express from 'express'
import Stripe from 'stripe'
import { getUserOrgContext } from '../middleware/organizationalContext.js'
import { requireAdmin } from '../middleware/roleBasedAccess.js'
import {
  STRIPE_SECRET_KEY,
  STRIPE_PRICE_IDS,
} from './stripeConfig.js'

const router = express.Router()
const stripe = new Stripe(STRIPE_SECRET_KEY)

// ✅ Test route (admin only)
router.get('/test', getUserOrgContext, requireAdmin, (req, res) => {
  res.json({ 
    message: 'Stripe route is working',
    organization: req.orgId,
    user: req.user.id
  })
})

// ✅ Create Checkout Session (admin only - supports monthly or annual)
router.post('/create-checkout-session', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const email = req.user.email
    const orgId = req.orgId
    const plan = req.body.plan === 'annual' ? 'annual' : 'monthly'

    if (!email || !orgId) {
      return res.status(400).json({ error: 'Missing email or organization ID' })
    }

    const priceId = plan === 'annual'
      ? STRIPE_PRICE_IDS.ANNUAL
      : STRIPE_PRICE_IDS.MONTHLY

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      subscription_data: {
        metadata: {
          org_id: orgId,
          user_id: req.user.id,
          plan
        },
        trial_period_days: 14
      },
      success_url: `${process.env.CLIENT_URL}/billing/success`,
      cancel_url: `${process.env.CLIENT_URL}/billing/cancel`
    })

    console.log(`✅ Stripe checkout session created for org ${orgId} by admin ${req.user.id}`);
    res.json({ url: session.url })
  } catch (err) {
    console.error('[stripe.js] Stripe error:', err.message)
    res.status(500).json({ error: 'Failed to create Stripe session' })
  }
})

console.log('[stripe.js] Routes loaded successfully')
export default router
