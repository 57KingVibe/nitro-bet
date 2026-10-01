import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 10, checkperiod: 120 });

export const cacheMiddleware = (ttlInSeconds = 10) => {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = req.originalUrl || req.url;
    const cachedBody = cache.get(key);

    if (cachedBody) {
      return res.json(cachedBody);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        cache.set(key, body, ttlInSeconds);
      }
      return originalJson(body);
    };

    next();
  };
};
