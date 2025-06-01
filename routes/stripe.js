// routes/stripe.js
const express = require('express')
const router = express.Router()
const Stripe = require('stripe')
const { supabase, verifySupabaseToken } = require('../services/supabase')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

// 🔐 POST /api/stripe/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const orgId = user.user_metadata?.org_id
    const userId = user.id

    if (!orgId) return res.status(400).json({ error: 'Missing org ID' })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Replace with your price ID from Stripe
          quantity: 1
        }
      ],
      metadata: {
        org_id: orgId,
        user_id: userId,
        trial_start: new Date().toISOString()
      },
      success_url: `${process.env.CLIENT_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?checkout=cancelled`
    })

    // Optional: store the session ID or metadata for tracking
    await supabase
      .from('organizations')
      .update({ stripe_session_id: session.id })
      .eq('id', orgId)

    res.json({ sessionUrl: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err.message)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

module.exports = router
