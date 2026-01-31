// Middleware to verify JWT tokens for protected routes
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../../config.js');

// Verify the JWT token from the Authorization header
const verifyToken = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Token mancante" });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
};

module.exports = verifyToken;