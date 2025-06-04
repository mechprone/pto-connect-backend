import express from 'express'
import Stripe from 'stripe'
import { verifySupabaseToken } from '../util/verifySupabaseToken.js'
import {
  STRIPE_SECRET_KEY,
  STRIPE_PRICE_IDS,
} from './stripeConfig.js'

const router = express.Router()
const stripe = new Stripe(STRIPE_SECRET_KEY)

// ✅ Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Stripe route is working' })
})

// ✅ Create Checkout Session (supports monthly or annual)
router.post('/create-checkout-session', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const email = user.email
    const orgId = user.user_metadata?.org_id
    const plan = req.body.plan === 'annual' ? 'annual' : 'monthly'

    if (!email || !orgId) {
      return res.status(400).json({ error: 'Missing email or org ID' })
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
          user_id: user.id,
          plan
        },
        trial_period_days: 14
      },
      success_url: `${process.env.CLIENT_URL}/billing/success`,
      cancel_url: `${process.env.CLIENT_URL}/billing/cancel`
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[stripe.js] Stripe error:', err.message)
    res.status(500).json({ error: 'Failed to create Stripe session' })
  }
})

console.log('[stripe.js] Routes loaded successfully')
export default router
