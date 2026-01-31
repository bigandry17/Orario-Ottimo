const express = require('express');
const router = express.Router();
const { ScheduleEntry, Preference, Notification, User } = require('../db/models');

/**
 * Rotta per permettere ai docenti di aggiornare lo stato di una lezione.
*/
router.put('/teacher/schedule/status/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validazione dello stato
    const validStatuses = ['Confermato', 'Conflitto', 'In Attesa'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Stato non valido. Usa: Confermato, Conflitto o In Attesa.' 
        });
    }

    try {
        const updatedEntry = await ScheduleEntry.findByIdAndUpdate(
            id,
            { status: status },
            { new: true, runValidators: true }
        );

        if (!updatedEntry) {
            return res.status(404).json({ success: false, message: 'Lezione non trovata.' });
        }

        // Create a notification for all admins when a teacher updates lesson status
        const admins = await User.find({ role: 'admin' });
        const notifications = admins.map(admin => ({
            target_user_id: admin._id,
            target_role: 'admin',
            title: 'Stato lezione aggiornato',
            message: `Lo stato di una lezione è stato aggiornato a "${status}" da un docente.`,
            type: status === 'Confermato' ? 'success' : (status === 'Conflitto' ? 'warning' : 'info'),
            ref_id: updatedEntry._id,
            ref_model: 'ScheduleEntry'
        }));
        await Notification.insertMany(notifications);

        res.json({ 
            success: true, 
            message: `Stato aggiornato a ${status} con successo.`, 
            data: updatedEntry 
        });
    } catch (error) {
        console.error("Errore aggiornamento stato docente:", error);
        res.status(500).json({ success: false, message: 'Errore interno del server.' });
    }
});

// Retrieve all preferences associated with the specified teacher
router.get('/teacher/preferences/:teacherId', async (req, res) => {
    try {
        const preferences = await Preference.find({ teacher_id: req.params.teacherId });
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle preferenze' });
    }
});

// Create a new teacher preference
router.post('/teacher/preferences', async (req, res) => {
    try {
        const newPreference = new Preference(req.body);
        await newPreference.save();
        res.status(201).json({ success: true, message: 'Preferenza creata con successo.', data: newPreference });
    } catch (error) {
        console.error("Errore nella creazione della preferenza:", error);
        res.status(500).json({ success: false, message: 'Errore nella creazione della preferenza.' });
    }
});

// Delete a teacher preference by its ID
router.delete('/teacher/preferences/:id', async (req, res) => {
    try {
        const result = await Preference.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Preferenza non trovata.' });
        res.json({ success: true, message: 'Preferenza eliminata con successo.' });
    } catch (error) {
        console.error("Errore nell\'eliminazione della preferenza:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione della preferenza.' });
    }
});

module.exports = router;