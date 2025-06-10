import express from 'express';
import templatesRouter from './templates.js';
import smsRouter from './sms.js';

const router = express.Router();

// Mount sub-routers
router.use('/templates', templatesRouter);
router.use('/sms', smsRouter);

// GET /api/communications - Communication dashboard overview
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'PTO Connect Communication API v1.0',
      endpoints: {
        templates: '/api/communications/templates',
        sms: '/api/communications/sms',
        push: '/api/communications/push (coming soon)',
        social: '/api/communications/social (coming soon)',
        analytics: '/api/communications/analytics (coming soon)'
      },
      features: [
        'Email Template Management',
        'SMS Campaign Management',
        'Multi-Channel Communication',
        'Real-time Analytics',
        'User Preference Management'
      ]
    });
  } catch (err) {
    console.error('[communication/index.js] GET error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Communication API error' 
    });
  }
});

console.log('[communication/index.js] Communication routes loaded successfully');
export default router;
