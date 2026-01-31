const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const verifyToken = require('./src/middleware/authMiddleware');

const { initializeDatabase } = require('./src/db/data.js');
const authRouter = require('./src/api/auth.js');
const config = require('./config');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const mongoUri = config.db_configuration;
mongoose.connect(mongoUri)
    .then(() => {
        console.log('MongoDB connesso con successo.');
        initializeDatabase();
    })
    .catch(err => {
        console.error('Errore di connessione a MongoDB:', err.message);
        console.error('ATTENZIONE: Assicurati che il servizio MongoDB sia avviato sulla porta 27017.');
    });

// --- Routing API ---
app.use('/api', authRouter);
app.use('/api', verifyToken, require('./src/api/admin.js'));
app.use('/api', verifyToken, require('./src/api/teacher.js'));


app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});


app.listen(PORT, () => {
    console.log(`Server Express in ascolto sulla porta: ${PORT}`);
    console.log(`Frontend disponibile su http://localhost:${PORT}/`);
});