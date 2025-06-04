import express from 'express'
import Stripe from 'stripe'
import {
  STRIPE_SECRET_KEY,
  STRIPE_LOOKUP_KEYS,
} from './stripeConfig.js'

const router = express.Router()
const stripe = new Stripe(STRIPE_SECRET_KEY)

// ✅ Route: GET /api/stripe/get-prices
router.get('/get-prices', async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      lookup_keys: [STRIPE_LOOKUP_KEYS.MONTHLY, STRIPE_LOOKUP_KEYS.ANNUAL],
      expand: ['data.product'],
    })

    const result = prices.data.map((price) => ({
      id: price.id,
      nickname: price.nickname || price.product.name,
      amount: (price.unit_amount / 100).toFixed(2),
      currency: price.currency,
      interval: price.recurring.interval,
      lookup_key: price.lookup_key,
    }))

    res.json(result)
  } catch (error) {
    console.error('[getPrices.js] Stripe price fetch error:', error)
    res.status(500).json({ error: 'Unable to fetch Stripe prices' })
  }
})

export default router
