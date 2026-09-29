const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ success: false, error: 'No token provided' });
  
  jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'nitro_secret_key', (err, decoded) => {
    if (err) return res.status(401).json({ success: false, error: 'Unauthorized' });
    req.userId = decoded.id;
    next();
  });
};
