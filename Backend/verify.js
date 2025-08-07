// backend/verify.js - Enhanced version with better error handling
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    if(req.method === 'OPTIONS') {
      return next(); 
    }
  
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log('No authorization header');
      return res.status(403).json({ 
        message: 'No token provided',
        code: 'NO_TOKEN'
      });
    }
  
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('Token is missing after "Bearer"');
      return res.status(403).json({ 
        message: 'No token provided',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
  
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log('JWT verification failed:', err.message);
        
        // Handle specific JWT errors
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            message: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        } else if (err.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            message: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        } else if (err.name === 'NotBeforeError') {
          return res.status(401).json({ 
            message: 'Token not active',
            code: 'TOKEN_NOT_ACTIVE'
          });
        }
        
        return res.status(401).json({ 
          message: 'Unauthorized',
          code: 'TOKEN_VERIFICATION_FAILED'
        });
      }
    
      console.log('Token verified, user id is:', decoded.id, decoded.username);
      req.userId = decoded.id;
      req.username = decoded.username;
      next();  
    }); 
};

module.exports = verifyToken;