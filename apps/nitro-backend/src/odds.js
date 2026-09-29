const axios = require('axios');
const NodeCache = require('node-cache');

// 60-second TTL means TheOddsAPI is called a maximum of 1 time per minute, 
// even if 10,000 users load the app simultaneously.
const oddsCache = new NodeCache({ stdTTL: 60 }); 

module.exports = async (req, res) => {
  const cacheKey = 'live_odds';
  const cachedOdds = oddsCache.get(cacheKey);

  if (cachedOdds) {
    return res.json({ success: true, cached: true, data: cachedOdds });
  }

  try {
    const response = await axios.get('https://api.the-odds-api.com/v4/sports/upcoming/odds/', {
      params: {
        apiKey: process.env.ODDS_API_KEY || 'DEMO_KEY',
        regions: 'us,uk,eu',
        markets: 'h2h',
        bookmakers: 'draftkings'
      }
    });

    oddsCache.set(cacheKey, response.data);
    res.json({ success: true, cached: false, data: response.data });
  } catch (error) {
    console.error("Odds API Error:", error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch odds pipeline' });
  }
};
