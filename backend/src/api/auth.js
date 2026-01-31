const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../db/models');
const router = express.Router();
const bcrypt = require('bcrypt');

// Secret key for JWT signing
const { SECRET_KEY } = require('../../config.js');

// Login endpoint: authenticates user and returns JWT token
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nome utente e password sono richiesti.' });
    }

    try {
        const user = await User.findOne({ username }); 

        if (!user) {
            return res.status(401).json({ success: false, message: 'Nome utente o password non validi.' });
        }

        const isMatch = await bcrypt.compare(password, user.password); 

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Nome utente o password non validi.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, role: user.role, name: user.name }
        });

    } catch (error) {
        console.error('Errore durante il login:', error);
        res.status(500).json({ success: false, message: 'Errore interno del server.' });
    }
});

module.exports = router;