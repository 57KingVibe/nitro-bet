const express = require('express');
const router = express.Router();

// Shared referral structure across both tiers
const REFERRAL_BONUS_USD = 5;

// LITE TIER: Free predictions with active $5 referral rewards
router.get('/lite/config', (req, res) => {
  res.json({ 
    tier: 'lite', 
    mode: 'free-to-play', 
    referralBonusAmount: REFERRAL_BONUS_USD,
    status: 'active'
  });
});

// NORMAL TIER: Real EVM staking with active $5 referral rewards
router.get('/normal/config', (req, res) => {
  res.json({ 
    tier: 'normal', 
    mode: 'real-stakes', 
    referralBonusAmount: REFERRAL_BONUS_USD,
    requireLicense: true,
    status: 'restricted'
  });
});

module.exports = router;
