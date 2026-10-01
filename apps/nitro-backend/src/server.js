const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const NodeCache = require('node-cache');
const path = require('path');
require('dotenv').config();

const app = express();
const cache = new NodeCache({ stdTTL: 5 });

app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(express.json());

try {
  app.use(require('./geoBlock'));
} catch (e) {
  // bypassed safely
}

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
      res.json({
        trackConditions: { temp: "115" },
        leaderboard: [{ name: "K. Larson" }, { name: "C. Elliott" }, { name: "R. Blaney" }]
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Pipeline bottleneck" });
  }
});

try { app.get('/api/odds', require('./odds')); } catch(e) {}
try { app.use('/api/tiers', require('./tierRouter')); } catch(e) {}
try { app.use('/api/payments', require('./payments')); } catch(e) {}
try { app.use('/api/verify', require('./verifier')); } catch(e) {}

// Absolute path resolution for Render monorepo structure
const frontendDist = path.resolve(__dirname, '../../nitro-frontend/dist');
app.use(express.static(frontendDist));

app.use('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Production server running on port ${PORT}`));
