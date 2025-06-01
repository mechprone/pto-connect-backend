const express = require('express')
const router = express.Router()
const { verifySupabaseToken } = require('../services/supabase')
const Stripe = require('stripe')

// ✅ Safe Stripe initialization
const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' }) : null

router.post('/create-checkout-session', async (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed auth token' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const user = await verifySupabaseToken(token)

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe API key not configured' })
    }

    const { plan } = req.body

    const priceId =
      plan === 'annual'
        ? process.env.STRIPE_ANNUAL_PRICE_ID
        : process.env.STRIPE_MONTHLY_PRICE_ID

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid or missing Stripe price ID' })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 15,
        metadata: { plan }
      },
      success_url: `https://www.ptoconnect.com/signup/next-step?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://www.ptoconnect.com/signup/cancelled`
    })

    res.json({ sessionUrl: session.url })
  } catch (error) {
    console.error('❌ Stripe Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
