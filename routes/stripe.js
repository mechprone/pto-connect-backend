// routes/stripe.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { verifySupabaseToken } = require('../services/supabase');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Stripe route is working' });
});

// ✅ POST /api/stripe/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const email = user.email;
    const orgId = user.user_metadata?.org_id;

    if (!email || !orgId) {
      return res.status(400).json({ error: 'Missing email or org ID' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Set this in Render environment variables
          quantity: 1
        }
      ],
      subscription_data: {
        metadata: {
          org_id: orgId,
          user_id: user.id
        },
        trial_period_days: 14
      },
      success_url: `${process.env.CLIENT_URL}/billing/success`,
      cancel_url: `${process.env.CLIENT_URL}/billing/cancel`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

module.exports = router;
