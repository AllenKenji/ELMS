const jwt = require('jsonwebtoken');

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ error: 'Invalid token' });
      }

      console.error('JWT verification failed:', err.message);
      return res.status(403).json({ error: 'Token verification failed' });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
