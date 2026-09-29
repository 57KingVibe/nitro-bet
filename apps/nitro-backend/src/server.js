const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const cache = new NodeCache({ stdTTL: 5 }); 

app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(require('./geoBlock'));

app.use(cors({
  origin: ['https://nitro-bet-the-express-way.onrender.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, slow down!' }
});
app.use('/api/', limiter);

const cacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;
  const cachedData = cache.get(key);
  if (cachedData) return res.json(cachedData);
  res.sendResponse = res.json;
  res.json = (body) => {
    cache.set(key, body);
    res.sendResponse(body);
  };
  next();
};

const NASCAR_API_BASE = 'https://feed.nascar.com';

app.get('/api/stream/unified', cacheMiddleware, async (req, res) => {
  try {
    const config = { timeout: 3000 };
    try {
      const [feed, temp, stats] = await Promise.all([
        axios.get(`${NASCAR_API_BASE}/api/LiveFeed`, config),
        axios.get(`${NASCAR_API_BASE}/api/tracktemp`, config),
        axios.get(`${NASCAR_API_BASE}/api/stats/top`, config)
      ]);
      res.json({ trackConditions: { temp: temp.data.current }, leaderboard: stats.data.topThree });
    } catch (apiError) {
      console.log("⚠️ NASCAR API offline. Injecting fallback telemetry...");
      res.json({
        trackConditions: { temp: "115" },
        leaderboard: [{ name: "K. Larson" }, { name: "C. Elliott" }, { name: "R. Blaney" }]
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Pipeline bottleneck" });
  }
});

// The new Phase 2 Odds API Route
app.get('/api/odds', require('./odds'));
app.use('/api/tiers', require('./tierRouter'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Production server running on port ${PORT}`));

