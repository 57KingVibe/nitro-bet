const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json());

// 1. Stubbing the missing middleware so the server doesn't crash on boot
const cacheMiddleware = (req, res, next) => {
    next();
};

const NASCAR_API_BASE = process.env.NASCAR_API_BASE || 'https://cf.nascar.com';

// 2. NASCAR Stream API
app.get('/api/stream/unified', cacheMiddleware, async (req, res) => {
    try {
        const config = { timeout: 3000 };
        try {
            const [feed, temp, stats] = await Promise.all([
                axios.get(`${NASCAR_API_BASE}/api/LiveFeed`, config),
                axios.get(`${NASCAR_API_BASE}/api/tracktemp`, config),
                axios.get(`${NASCAR_API_BASE}/api/stats/t`, config)
            ]);
            res.json({ trackConditions: { temp: temp.data }, feed: feed.data, stats: stats.data });
        } catch (apiError) {
            console.log("⚠️ NASCAR API offline. Injecting fallback...");
            res.json({
                trackConditions: { temp: "115" },
                leaderboard: [{ name: "K. Larson" }, { name: "C. Elliott" }]
            });
        }
    } catch (err) {
        res.status(500).json({ error: "Pipeline bottleneck" });
    }
});

// 3. Phase 6 Routes (Safely bypassed until we build them)
// app.get('/api/odds', require('./odds'));
// app.get('/api/tiers', require('./tierRouter'));
// app.post('/api/payments', require('./payments'));
// app.post('/api/verify', require('./verifier'));

// 4. Serve React Frontend
const frontendDist = path.join(__dirname, '../../nitro-frontend/dist');
app.use(express.static(frontendDist));

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
});

// 5. Boot Sequence
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Production server running on port ${PORT}`));
