import express from 'express';
import smsRouter from './sms.js';

const router = express.Router();

// Mount sub-routers
router.use('/sms', smsRouter);

// GET /api/communications - Communication dashboard overview
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'PTO Connect Communication API v1.0',
      endpoints: {
        sms: '/api/communications/sms',
        push: '/api/communications/push (coming soon)',
        social: '/api/communications/social (coming soon)',
        analytics: '/api/communications/analytics (coming soon)'
      },
      features: [
        'Unified Communication Composer',
        'AI-Powered Content Generation',
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
