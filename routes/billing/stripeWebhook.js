const express = require('express')
const Stripe = require('stripe')
const dotenv = require('dotenv')
const { supabase } = require('../utils/supabaseClient')

dotenv.config()

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

module.exports = async function (req, res) {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const data = event.data.object

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const orgId = data.metadata.org_id
        const customerId = data.customer
        const subscriptionId = data.subscription
        const plan = data.metadata.plan

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        await supabase.from('subscriptions').upsert({
          org_id: orgId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: subscription.status,
          start_date: new Date(subscription.start_date * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          plan
        })

        break
      }

      case 'invoice.paid':
      case 'customer.subscription.updated': {
        const subscription = data

        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000)
          })
          .eq('stripe_subscription_id', subscription.id)

        break
      }

      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', data.id)

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('⚠️ Webhook processing error:', error)
    res.status(500).send('Internal Server Error')
  }
}
