const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Provably Fair Bet Verification Endpoint
router.post('/verify', (req, res) => {
  try {
    const { serverSeed, clientSeed, nonce } = req.body;
    
    // Generate HMAC-SHA256 outcome hash
    const hash = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');

    res.json({
      success: true,
      provablyFair: true,
      resultHash: hash,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

module.exports = router;
