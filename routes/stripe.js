const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

router.post('/create-checkout-session', async (req, res) => {
  const { plan, email } = req.body;

  const priceId = plan === 'annual'
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 15,
        metadata: { plan }
      },
      success_url: `https://www.ptoconnect.com/signup/next-step?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://www.ptoconnect.com/signup/cancelled`,
    });

    res.json({ sessionUrl: session.url });
  } catch (error) {
    console.error('❌ Stripe Error:', error.message);
    res.status(500).json({ error: error.message });
  }

});

module.exports = router;
