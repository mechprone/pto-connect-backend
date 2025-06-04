// routes/stripe/stripeConfig.js
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

export const STRIPE_LOOKUP_KEYS = {
  MONTHLY: process.env.STRIPE_LOOKUP_KEY_MONTHLY || 'monthly_plan',
  ANNUAL: process.env.STRIPE_LOOKUP_KEY_ANNUAL || 'annual_plan',
}

export const STRIPE_PRICE_IDS = {
  MONTHLY: process.env.STRIPE_PRICE_ID_MONTHLY,
  ANNUAL: process.env.STRIPE_PRICE_ID_ANNUAL,
}

export const STRIPE_WEBHOOK_EVENTS = process.env.STRIPE_WEBHOOK_EVENTS?.split(',') || [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
]
