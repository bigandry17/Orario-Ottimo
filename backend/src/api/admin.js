const express = require('express');
const { Subject, Course, Classroom, Teacher, Constraint, ScheduleEntry, Notification, User, Preference, ReportHistory } = require('../db/models');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const router = express.Router();

function isAdmin(req, res, next) {
    next();
}

/**
 * Schedule Generation Algorithm with Hard Constraints and Preference Optimization.
 */
async function generateScheduleAlgorithm(courseName, courseYear, options) {
    console.log(`[SCHEDULER] Avvio generazione per ${courseName} - ${courseYear} (Ottimizzazione: ${options.optimizationType})`);

    const HOURS_PER_SLOT = 2;
    const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
    const TIME_SLOTS = ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00'];

    // 1. Retrieve active constraints from the database for dynamic logic activation
    const activeConstraints = await Constraint.find({});
    const hasConstraint = (tag) => activeConstraints.some(c => c.tag === tag);

    // Fetch base data
    const courseRef = `${courseName} - ${courseYear}`;
    const subjects = await Subject.find({ course_ref: courseRef });
    const allClassrooms = await Classroom.find({});
    const allTeachers = await Teacher.find({});
    const allPreferences = await Preference.find({});
    const allExistingSchedules = await ScheduleEntry.find({});

    // Occupancy and state maps
    const occupiedSlots = new Map();        // Globally occupied classroom slots
    const teacherOccupiedSlots = new Map(); // Globally occupied teacher slots
    const courseOccupiedSlots = new Set();  // Slots occupied for this specific course
    const courseDailyLoad = new Map(DAYS.map(day => [day, 0])); // Daily workload per class
    const teacherDaysWork = new Map();      // Days on which each teacher has lessons


    // Teacher preferences map
    const preferenceMap = new Map();
    allPreferences.forEach(p => {
        const tId = p.teacher_id.toString();
        const key = `${p.day}_${p.time_slot}`;
        if (!preferenceMap.has(tId)) preferenceMap.set(tId, new Map());
        preferenceMap.get(tId).set(key, p.type);
    });

    // Pre-population of existing commitments (other courses) to handle global conflicts
    allExistingSchedules.forEach(entry => {
        if (entry.course_name !== courseName || entry.course_year !== courseYear) {
            occupiedSlots.set(`${entry.day}_${entry.time_slot}_${entry.classroom_name}`, true);
            teacherOccupiedSlots.set(`${entry.day}_${entry.time_slot}_${entry.teacher_name}`, true);

            // Track teachers' working days based on the existing schedule
            if (!teacherDaysWork.has(entry.teacher_name)) teacherDaysWork.set(entry.teacher_name, new Set());
            teacherDaysWork.get(entry.teacher_name).add(entry.day);
        }
    });

    const newScheduleEntries = [];
    const lessonsToSchedule = [];

    // Prepare lesson list based on weekly hours
    subjects.forEach(subject => {
        const slotsNeeded = subject.weekly_hours / HOURS_PER_SLOT;
        for (let i = 0; i < slotsNeeded; i++) {
            lessonsToSchedule.push({ subject_name: subject.name, is_lab: subject.is_lab });
        }
    });

    // Initial randomization to vary the generated output
    lessonsToSchedule.sort(() => Math.random() - 0.5);

    // 2. Assignment loop for each lesson
    for (const lesson of lessonsToSchedule) {
        let assigned = false;
        let possibleAssignments = [];

        const teachers = allTeachers.filter(t => t.subjects.includes(lesson.subject_name));
        const classrooms = allClassrooms.filter(c => !lesson.is_lab || c.has_pc);

        for (const teacher of teachers) {
            const teacherId = teacher._id.toString();

            for (const day of DAYS) {
                // HARD CONSTRAINT: Teacher Day Off (teacher_day_off)
                if (hasConstraint('teacher_day_off')) {
                    const workedDays = teacherDaysWork.get(teacher.name) || new Set();
                    // If already working 4 days, the teacher cannot be assigned to a 5th day
                    if (!workedDays.has(day) && workedDays.size >= 4) continue;
                }

                for (const time_slot of TIME_SLOTS) {
                    const courseSlotKey = `${day}_${time_slot}`;

                    // --- HARD FILTERS (IMMEDIATELY DISCARD THE SLOT) ---

                    // System: No overlap within the same course
                    if (courseOccupiedSlots.has(courseSlotKey)) continue;

                    // Admin: Maximum of 4 consecutive hours of the same subject in the same day (max_consecutive_subject_hours)
                    if (hasConstraint('max_consecutive_subject_hours')) {
                        const sameSubjectInDay = newScheduleEntries.filter(e =>
                            e.day === day && e.subject_name === lesson.subject_name
                        ).length;
                        if (sameSubjectInDay >= 2) continue;
                    }

                    // Admin: Daily class hour limit (max_daily_hours)
                    if (hasConstraint('max_daily_hours') && (courseDailyLoad.get(day) || 0) >= 3) continue;

                    // Admin: Morning only (preferred_mornings)
                    if (hasConstraint('preferred_mornings') && (time_slot.startsWith('14:00') || time_slot.startsWith('16:00'))) continue;

                    // Admin: Compactness / No gaps between lessons (consecutive_slots)
                    if (hasConstraint('consecutive_slots') && (courseDailyLoad.get(day) || 0) > 0) {
                        const idx = TIME_SLOTS.indexOf(time_slot);
                        const prev = idx > 0 ? TIME_SLOTS[idx - 1] : null;
                        const next = idx < TIME_SLOTS.length - 1 ? TIME_SLOTS[idx + 1] : null;
                        if (!courseOccupiedSlots.has(`${day}_${prev}`) && !courseOccupiedSlots.has(`${day}_${next}`)) continue;
                    }

                    // Teacher "Not Available" preference (always treated as a hard constraint)
                    const teacherPref = preferenceMap.get(teacherId)?.get(courseSlotKey);
                    if (teacherPref === 'Non Disponibile') continue;


                    for (const classroom of classrooms) {
                        const slotKey = `${day}_${time_slot}_${classroom.name}`;
                        const teacherKey = `${day}_${time_slot}_${teacher.name}`;
                    
                        // Basic hard constraints: global classroom and teacher overlap
                        if (hasConstraint('no_overlap_classroom') && occupiedSlots.has(slotKey)) continue;
                        if (hasConstraint('no_overlap_teacher') && teacherOccupiedSlots.has(teacherKey)) continue;
                    
                        // --- SCORE CALCULATION (to choose among remaining valid slots) ---
                        let score = 0;
                    
                        if (options.respectPreferences) {
                    
                            if (teacherPref === 'Preferito') score += 30;
                            if (teacherPref === 'Evitare') score -= 20;
                        }
                    
                        // Load balancing (avoid overloading a day when not necessary)
                        score -= (courseDailyLoad.get(day) || 0) * 5;
                    
                        possibleAssignments.push({
                            day, time_slot, teacher: teacher.name, classroom: classroom.name,
                            score: score + (Math.random() * 5)
                        });
                    }                    
                }
            }
        }

        // 3. Selection of the best assignment
        if (possibleAssignments.length > 0) {
            possibleAssignments.sort((a, b) => b.score - a.score);

            // Randomization among top-scoring options to vary distribution
            const maxScore = possibleAssignments[0].score;
            const bestOptions = possibleAssignments.filter(a => a.score >= maxScore - 2);
            const choice = bestOptions[Math.floor(Math.random() * bestOptions.length)];

            newScheduleEntries.push({
                course_name: courseName,
                course_year: courseYear,
                day: choice.day,
                time_slot: choice.time_slot,
                subject_name: lesson.subject_name,
                teacher_name: choice.teacher,
                classroom_name: choice.classroom,
                status: 'In Attesa'
            });

            // Update state maps for the next lesson
            occupiedSlots.set(`${choice.day}_${choice.time_slot}_${choice.classroom}`, true);
            teacherOccupiedSlots.set(`${choice.day}_${choice.time_slot}_${choice.teacher}`, true);
            courseOccupiedSlots.add(`${choice.day}_${choice.time_slot}`);
            courseDailyLoad.set(choice.day, (courseDailyLoad.get(choice.day) || 0) + 1);

            if (!teacherDaysWork.has(choice.teacher)) teacherDaysWork.set(choice.teacher, new Set());
            teacherDaysWork.get(choice.teacher).add(choice.day);

            assigned = true;
        }


        if (!assigned) {
            throw new Error(`Impossibile generare l'orario: i vincoli rigidi impediscono l'assegnazione di "${lesson.subject_name}".`);
        }
    }

    // 4. Save to database and send notifications
    await ScheduleEntry.deleteMany({ course_name: courseName, course_year: courseYear });
    const saved = await ScheduleEntry.insertMany(newScheduleEntries);

    for (const entry of saved) {
        await notifyScheduleChange({ ...entry._doc, _id: entry._id }, 'POST');
    }

    return { success: true, message: `Orario generato con successo (${saved.length} lezioni).` };
}

// --- Helper function to create customized notifications ---
async function createNotification(targetUserId, role, title, message, type, refId, refModel) {
    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        console.error("Attempt to create a notification with an invalid user ID:", targetUserId);
        return;
    }

    const newNotification = new Notification({
        target_user_id: targetUserId,
        target_role: role,
        title,
        message,
        type,
        ref_id: refId,
        ref_model: refModel
    });
    try {
        await newNotification.save();
    } catch (e) {
        console.error("Notification save error:", e);
    }
}

// --- Function that generates notifications when a lesson is saved ---
async function notifyScheduleChange(entry, action) {
    
    const teacherUser = await User.findOne({ name: entry.teacher_name });
    const adminUser = await User.findOne({ role: 'admin' });

    const subjectName = entry.subject_name;
    const courseYear = `${entry.course_name} - ${entry.course_year}`;

    let adminTitle, adminMessage, teacherTitle, teacherMessage, type;

    switch (action) {
        case 'POST':
            type = 'success';
            adminTitle = 'Nuova Lezione Creata';
            adminMessage = `La lezione di ${subjectName} per ${courseYear} è stata aggiunta.`;
            teacherTitle = 'Nuovo Incarico di Lezione';
            teacherMessage = `Ti è stata assegnata una lezione di ${subjectName} il ${entry.day} ${entry.time_slot}.`;
            break;
        case 'PUT':
            type = 'info';
            adminTitle = 'Lezione Aggiornata';
            adminMessage = `La lezione di ${subjectName} per ${courseYear} è stata modificata.`;
            teacherTitle = 'Modifica Orario Lezione';
            teacherMessage = `La tua lezione di ${subjectName} è stata modificata. Controlla i dettagli.`;
            break;
        case 'DELETE':
            type = 'error';
            adminTitle = 'Lezione Eliminata';
            adminMessage = `La lezione di ${subjectName} per ${courseYear} è stata rimossa.`;
            teacherTitle = 'Lezione Cancellata';
            teacherMessage = `La tua lezione di ${subjectName} del ${entry.day} è stata cancellata.`;
            break;
        default:
            return;
    }

    // 1. Notify the admin
    if (adminUser) {
        await createNotification(adminUser._id, 'admin', adminTitle, adminMessage, type, entry._id, 'ScheduleEntry');
    }

    // 2. Notify the teacher
    if (teacherUser) {
        await createNotification(teacherUser._id, 'docente', teacherTitle, teacherMessage, type, entry._id, 'ScheduleEntry');
    }

}

// Admin endpoint to trigger schedule generation and compute reporting metrics
router.post('/admin/generate-schedule', isAdmin, async (req, res) => {
    const { course, year, optimizationType, respectPreferences } = req.body;

    try {
        const result = await generateScheduleAlgorithm(course, year, { optimizationType, respectPreferences });

        const schedule = await ScheduleEntry.find({});
        const subjects = await Subject.find({});
        const preferences = await Preference.find({});
        const teachers = await Teacher.find({});
        
        // Compute efficiency metrics (scheduled hours vs required hours)
        const totalHoursRequired = subjects.reduce((acc, s) => acc + (s.weekly_hours || 0), 0);
        const totalHoursScheduled = schedule.length * 2;
        const efficiency = totalHoursRequired > 0
            ? Math.min(100, Math.round((totalHoursScheduled / totalHoursRequired) * 100))
            : 0;
        
        // Evaluate teacher preference satisfaction
        const teacherIdMap = new Map(teachers.map(t => [t._id.toString(), t.name]));
        const prefSlots = preferences.filter(p => p.type === 'Preferito');
        let satCount = 0;
        prefSlots.forEach(p => {
            if (schedule.some(e =>
                e.teacher_name === teacherIdMap.get(p.teacher_id.toString()) &&
                e.day === p.day &&
                e.time_slot === p.time_slot
            )) satCount++;
        });

        // Persist report snapshot for historical comparison
        await ReportHistory.create({
            metrics: {
                efficiency,
                satisfaction: prefSlots.length > 0
                    ? Math.round((satCount / prefSlots.length) * 100)
                    : 100,
                totalHours: totalHoursScheduled,
                totalRequired: totalHoursRequired,
                coveragePercent: totalHoursRequired > 0
                    ? parseFloat(((totalHoursScheduled / totalHoursRequired) * 100).toFixed(1))
                    : 0,
                conflicts: schedule.filter(e => e.status === 'Conflitto').length
            }
        });

        res.json({ success: true, message: result.message, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin endpoint to retrieve report metrics and trend analysis data
router.get('/admin/report-data', isAdmin, async (req, res) => {
    try {
        const schedule = await ScheduleEntry.find({});
        const subjects = await Subject.find({});
        const teachers = await Teacher.find({});
        const preferences = await Preference.find({});
        const classrooms = await Classroom.find({});

        // --- 1. CURRENT METRICS CALCULATION ---
        const totalHoursRequired = subjects.reduce((acc, s) => acc + (s.weekly_hours || 0), 0);
        const totalHoursScheduled = schedule.length * 2;
        const efficiency = totalHoursRequired > 0
            ? Math.min(100, Math.round((totalHoursScheduled / totalHoursRequired) * 100))
            : 0;
        
        // Compute teacher preference satisfaction
        const teacherMap = new Map(teachers.map(t => [t._id.toString(), t.name]));
        const preferredSlots = preferences.filter(p => p.type === 'Preferito');
        let satisfiedCount = 0;
        preferredSlots.forEach(p => {
            if (schedule.some(e =>
                e.teacher_name === teacherMap.get(p.teacher_id.toString()) &&
                e.day === p.day &&
                e.time_slot === p.time_slot
            )) satisfiedCount++;
        });
        const satisfaction = preferredSlots.length > 0
            ? Math.round((satisfiedCount / preferredSlots.length) * 100)
            : 100;

        // Aggregate current report metrics
        const currentMetrics = {
            efficiency,
            satisfaction,
            totalHours: totalHoursScheduled,
            totalRequired: totalHoursRequired,
            coveragePercent: totalHoursRequired > 0
                ? parseFloat(((totalHoursScheduled / totalHoursRequired) * 100).toFixed(1))
                : 0,
            conflicts: schedule.filter(e => e.status === 'Conflitto').length
        };

        // --- 2. REAL TREND ANALYSIS ---
        // Retrieve the previous stored snapshot for comparison
        const lastSnapshot = await ReportHistory.findOne()
            .sort({ timestamp: -1 })
            .skip(1); 

        const calculateDiff = (current, previous) => {
            if (previous === undefined || previous === null) return 0;
            return current - previous;
        };

        // Compute metric deltas compared to the previous snapshot
        const trends = {
            efficiency: calculateDiff(currentMetrics.efficiency, lastSnapshot?.metrics.efficiency),
            satisfaction: calculateDiff(currentMetrics.satisfaction, lastSnapshot?.metrics.satisfaction),
            hoursDiff: calculateDiff(currentMetrics.totalHours, lastSnapshot?.metrics.totalHours),
            conflictsDiff: calculateDiff(currentMetrics.conflicts, lastSnapshot?.metrics.conflicts)
        };

        // Return aggregated report data for dashboard visualization
        res.json({
            success: true,
            metrics: currentMetrics,
            trends: trends,
            classroomUsage: classrooms.map(room => ({
                name: room.name,
                percent: Math.round(
                    (schedule.filter(e => e.classroom_name === room.name).length / 20) * 100
                )
            })),
            teacherWorkload: teachers.map(t => {
                const hours = schedule.filter(e => e.teacher_name === t.name).length * 2;
                let status = 'Ottimale';
                if (hours > t.max_weekly_hours) status = 'Sovraccarico';
                else if (hours < t.max_weekly_hours - 2) status = 'Sotto carico';
                return { name: t.name, hours, maxHours: t.max_weekly_hours, status };
            })
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Retrieve the list of all available courses
router.get('/admin/courses', isAdmin, async (req, res) => {
    try {
        const courses = await Course.find({});
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero dei corsi' });
    }
});

// Create a new course, ensuring uniqueness by name and academic year
router.post('/admin/courses', isAdmin, async (req, res) => {
    try {
        const { name, year } = req.body;

        const existingCourse = await Course.findOne({ name, year });
        if (existingCourse) {
            return res.status(400).json({
                success: false,
                message: `Errore: Il corso "${name} - ${year}" esiste già.`,
            });
        }
        const newCourse = new Course(req.body);
        await newCourse.save();
        res.status(201).json({
            success: true,
            message: 'Corso creato con successo.',
            data: newCourse
        });
    } catch (error) {
        console.error("Errore nella creazione del corso:", error);
        res.status(500).json({ success: false, message: 'Errore nella creazione del corso.' });
    }
});

// Update an existing course, enforcing uniqueness on name and academic year
router.put('/admin/courses/:id', isAdmin, async (req, res) => {
    const courseId = req.params.id;
    const { name, year } = req.body;

    try {
        if (name && year) {
            const existingCourse = await Course.findOne({
                name,
                year,
                _id: { $ne: courseId }
            });
            if (existingCourse) {
                return res.status(400).json({
                    success: false,
                    message: `Errore: Il corso "${name} - ${year}" esiste già per un altro ID.`,
                });
            }
        }

        const updatedCourse = await Course.findByIdAndUpdate(
            courseId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedCourse) {
            return res.status(404).json({ success: false, message: 'Corso non trovato per l\'aggiornamento.' });
        }
        res.json({ success: true, message: 'Corso aggiornato con successo.', data: updatedCourse });
    } catch (error) {
        console.error("Errore nell'aggiornamento del corso:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento del corso.' });
    }
});

// Delete a course by ID (associated subjects and schedule entries should be handled separately)
router.delete('/admin/courses/:id', isAdmin, async (req, res) => {
    const courseId = req.params.id;
    try {
        const result = await Course.findByIdAndDelete(courseId);

        if (!result) {
            return res.status(404).json({ success: false, message: 'Corso non trovato per l\'eliminazione.' });
        }

        // Delete associated subjects and schedule entries
        const courseName = result.name;
        const courseYear = result.year;
        const courseRef = `${courseName} - ${courseYear}`;

        // Delete all subjects linked to this course
        await Subject.deleteMany({ course_ref: courseRef });
        // Delete all schedule entries linked to this course
        await ScheduleEntry.deleteMany({ course_name: courseName, course_year: courseYear });

        res.json({ success: true, message: 'Corso e dati associati eliminati con successo.' });
    } catch (error) {
        console.error("Errore nell'eliminazione del corso:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione del corso.' });
    }
});

// Retrieve the list of all available classrooms
router.get('/admin/classrooms', isAdmin, async (req, res) => {
    try {
        const classrooms = await Classroom.find({});
        res.json(classrooms);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle aule' });
    }
});

// Create a new classroom, ensuring uniqueness of the classroom name
router.post('/admin/classrooms', isAdmin, async (req, res) => {
    try {
        const newClassroom = new Classroom(req.body);
        await newClassroom.save();
        res.status(201).json({
            success: true,
            message: 'Aula creata con successo.',
            data: newClassroom
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Errore: Il nome dell\'aula è già in uso.',
            });
        }
        console.error("Errore nella creazione dell'aula:", error);
        res.status(500).json({ success: false, message: 'Errore nella creazione dell\'aula.' });
    }
});

// Update an existing classroom, enforcing uniqueness of the classroom name
router.put('/admin/classrooms/:id', isAdmin, async (req, res) => {
    const classroomId = req.params.id;
    try {
        const updatedClassroom = await Classroom.findByIdAndUpdate(
            classroomId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedClassroom) {
            return res.status(404).json({ success: false, message: 'Aula non trovata per l\'aggiornamento.' });
        }
        res.json({ success: true, message: 'Aula aggiornata con successo.', data: updatedClassroom });
    } catch (error) {
        // Handle error for duplicate classroom name
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Errore: Il nome dell\'aula è già in uso.',
            });
        }
        console.error("Errore nell'aggiornamento dell'aula:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento dell\'aula.' });
    }
});

// Delete a classroom by ID (associated schedule entries should be handled separately)
router.delete('/admin/classrooms/:id', isAdmin, async (req, res) => {
    const classroomId = req.params.id;
    try {
        const result = await Classroom.findByIdAndDelete(classroomId);

        if (!result) {
            return res.status(404).json({ success: false, message: 'Aula non trovata per l\'eliminazione.' });
        }

        // Delete all schedule entries linked to this classroom
        await ScheduleEntry.deleteMany({ classroom_name: result.name });

        res.json({ success: true, message: 'Aula e lezioni associate eliminate con successo.' });
    } catch (error) {
        console.error("Errore nell'eliminazione dell'aula:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione dell\'aula.' });
    }
});

// Retrieve the list of all subjects
router.get('/admin/subjects', isAdmin, async (req, res) => {
    try {
        const subjects = await Subject.find({});
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle materie' });
    }
});

// Create a new subject, enforcing uniqueness on subject name and code
router.post('/admin/subjects', isAdmin, async (req, res) => {
    try {
        const newSubject = new Subject(req.body);
        await newSubject.save();
        res.status(201).json({
            success: true,
            message: 'Materia creata con successo.',
            data: newSubject
        });
    } catch (error) {
        if (error.code === 11000) {
            let message = 'Errore: I dati inseriti sono già in uso.';
            if (error.keyPattern && error.keyPattern.name) {
                message = 'Errore: Il nome della materia è già in uso.';
            } else if (error.keyPattern && error.keyPattern.code) {
                message = 'Errore: Il codice materia è già in uso.';
            }
            return res.status(400).json({
                success: false,
                message: message,
            });
        }
        console.error("Errore nella creazione della materia:", error);
        res.status(500).json({ success: false, message: 'Errore nella creazione della materia.' });
    }
});

// Update an existing subject and enforce uniqueness constraints
router.put('/admin/subjects/:id', isAdmin, async (req, res) => {
    const subjectId = req.params.id;
    try {
        const updatedSubject = await Subject.findByIdAndUpdate(
            subjectId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedSubject) {
            return res.status(404).json({ success: false, message: 'Materia non trovata per l\'aggiornamento.' });
        }

        res.json({ success: true, message: 'Materia aggiornata con successo.', data: updatedSubject });
    } catch (error) {
        // Handle duplicate subject code or name error
        if (error.code === 11000) {
            let message = 'Errore: I dati inseriti sono già in uso.';

            // Identify which unique field caused the duplication error
            if (error.keyPattern && error.keyPattern.name) {
                message = 'Errore: Il nome della materia è già in uso.';
            } else if (error.keyPattern && error.keyPattern.code) {
                message = 'Errore: Il codice materia è già in uso.';
            }

            return res.status(400).json({
                success: false,
                message: message,
            });
        }

        console.error("Errore nell'aggiornamento della materia:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento della materia.' });
    }
});

// Delete a subject by ID
router.delete('/admin/subjects/:id', isAdmin, async (req, res) => {
    const subjectId = req.params.id;
    try {
        const result = await Subject.findByIdAndDelete(subjectId);

        // Handle subject not found
        if (!result) {
            return res.status(404).json({ success: false, message: 'Materia non trovata per l\'eliminazione.' });
        }

        // Remove subject from all teachers' subject lists
        await Teacher.updateMany(
            { subjects: result.name },
            { $pull: { subjects: result.name } }
        );

        // Delete all schedule entries linked to this subject
        await ScheduleEntry.deleteMany({ subject_name: result.name });

        res.json({ success: true, message: 'Materia e dati associati eliminati con successo.' });
    } catch (error) {
        console.error("Errore nell'eliminazione della materia:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione della materia.' });
    }
});

// Retrieve the list of teachers
router.get('/admin/teachers', isAdmin, async (req, res) => {
    const { search } = req.query;
    let query = {};

    // Build a case-insensitive search query across multiple fields
    if (search) {
        const searchRegex = new RegExp(search, 'i');

        query = {
            $or: [
                { name: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
                { subjects: { $regex: searchRegex } }
            ]
        };
    }

    try {
        const teachers = await Teacher.find(query);
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero dei docenti' });
    }
});

// Update an existing teacher profile and workload information
router.put('/admin/teachers/:id', isAdmin, async (req, res) => {
    const teacherId = req.params.id;
    const updates = req.body;

    // Ensure subjects is an array if provided as a string
    if (updates.subjects && typeof updates.subjects === 'string') {
        updates.subjects = updates.subjects
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    try {
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            teacherId,
            updates,
            { new: true, runValidators: true } // Return the updated document
        );

        // Handle teacher not found
        if (!updatedTeacher) {
            return res.status(404).json({ success: false, message: 'Docente non trovato per l\'aggiornamento.' });
        }

        res.json({ success: true, message: 'Docente aggiornato con successo.', data: updatedTeacher });

    } catch (error) {
        // Handle duplicate email constraint violation
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Errore: L\'email inserita è già in uso da un altro docente.',
            });
        }
        console.error("Errore nell'aggiornamento del docente:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento del docente.' });
    }
});

// Delete a teacher by ID
router.delete('/admin/teachers/:id', isAdmin, async (req, res) => {
    const teacherId = req.params.id;

    try {
        const result = await Teacher.findByIdAndDelete(teacherId);

        // Handle teacher not found
        if (!result) {
            return res.status(404).json({ success: false, message: 'Docente non trovato per l\'eliminazione.' });
        }

        // Delete all schedule entries linked to this teacher
        await ScheduleEntry.deleteMany({ teacher_name: result.name });

        res.json({ success: true, message: 'Docente e lezioni associate eliminati con successo.' });

    } catch (error) {
        console.error("Errore nell'eliminazione del docente:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione del docente.' });
    }
});

// Create a new teacher and the associated user account
router.post('/admin/teachers', isAdmin, async (req, res) => {
    try {
        const { name, email, subjects, max_weekly_hours } = req.body;

        // Create the teacher domain entity
        const newTeacher = new Teacher({
            name,
            email,
            subjects: subjects || [],
            max_weekly_hours: max_weekly_hours || 18
        });

        await newTeacher.save();

        // Generate credentials for the teacher user account
        const generatedUsername = email.split('@')[0];
        const defaultPassword = 'docente';

        // Encrypt the password for the new teacher user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        // Create the linked user account with teacher role
        const newUser = new User({
            username: generatedUsername,
            password: hashedPassword,
            role: 'docente',
            name: name
        });
        await newUser.save();

        res.status(201).json({
            success: true,
            message: 'Docente creato con successo.',
            data: newTeacher
        });
    } catch (error) {
        // Handle duplicate email constraint violation
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Errore: L\'email inserita è già in uso.',
                details: error
            });
        }
        console.error("Errore nella creazione del docente:", error);
        res.status(500).json({
            success: false,
            message: 'Errore interno del server durante la creazione del docente.'
        });
    }
});

// Create a new scheduling constraint
router.post('/admin/constraints', isAdmin, async (req, res) => {
    try {
        const newConstraint = new Constraint(req.body);
        await newConstraint.save();
        res.status(201).json({
            success: true,
            message: 'Vincolo creato con successo.',
            data: newConstraint
        });
    } catch (error) {
        console.error("Errore nella creazione del vincolo:", error);
        res.status(500).json({ success: false, message: 'Errore nella creazione del vincolo.' });
    }
});

// Update an existing scheduling constraint
router.put('/admin/constraints/:id', isAdmin, async (req, res) => {
    const constraintId = req.params.id;
    try {
        const updatedConstraint = await Constraint.findByIdAndUpdate(
            constraintId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedConstraint) {
            return res.status(404).json({ success: false, message: 'Vincolo non trovato per l\'aggiornamento.' });
        }
        res.json({ success: true, message: 'Vincolo aggiornato con successo.', data: updatedConstraint });
    } catch (error) {
        console.error("Errore nell'aggiornamento del vincolo:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento del vincolo.' });
    }
});

// Delete a scheduling constraint by ID
router.delete('/admin/constraints/:id', isAdmin, async (req, res) => {
    const constraintId = req.params.id;
    try {
        const result = await Constraint.findByIdAndDelete(constraintId);

        if (!result) {
            return res.status(404).json({ success: false, message: 'Vincolo non trovato per l\'eliminazione.' });
        }
        res.json({ success: true, message: 'Vincolo eliminato con successo.' });
    } catch (error) {
        console.error("Errore nell'eliminazione del vincolo:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione del vincolo.' });
    }
});

// Retrieve the list of all scheduling constraints
router.get('/admin/constraints', isAdmin, async (req, res) => {
    try {
        const constraints = await Constraint.find({});
        res.json(constraints);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero dei vincoli' });
    }
});

// Retrieve the schedule, optionally filtered by course and academic year
router.get('/schedule', async (req, res) => {
    const { course, year } = req.query;

    let query = {};
    if (course) {
        query.course_name = course;
    }
    if (year) {
        query.course_year = year;
    }

    try {
        const schedule = await ScheduleEntry.find(query).sort({ day: 1, time_slot: 1 });
        res.json(schedule);
    } catch (error) {
        console.error("Errore nel recupero dell'orario:", error);
        res.status(500).json({ message: 'Errore nel recupero dell\'orario' });
    }
});

// Retrieve a single schedule entry by its ID
router.get('/schedule/:id', async (req, res) => {
    const lessonId = req.params.id;

    // Validate the lesson ID format
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ message: 'ID lezione non valido.' });
    }

    try {
        const entry = await ScheduleEntry.findById(lessonId);

        // Handle schedule entry not found
        if (!entry) {
            return res.status(404).json({ message: 'Lezione non trovata.' });
        }

        res.json(entry);
    } catch (error) {
        console.error(`Errore nel recupero della lezione ${lessonId}:`, error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// Update an existing schedule entry and notify affected users
router.put('/schedule/:id', isAdmin, async (req, res) => {
    const lessonId = req.params.id;
    const updates = req.body;

    try {
        const updatedEntry = await ScheduleEntry.findByIdAndUpdate(
            lessonId,
            updates,
            { new: true, runValidators: true }
        );

        // Handle schedule entry not found
        if (!updatedEntry) {
            return res.status(404).json({ message: 'Lezione non trovata per l\'aggiornamento.' });
        }

        // Trigger notifications for schedule modification
        await notifyScheduleChange(updatedEntry, 'PUT');

        res.json({ success: true, message: 'Lezione aggiornata con successo.', data: updatedEntry });
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'aggiornamento della lezione.' });
    }
});

// Delete a schedule entry and notify affected users
router.delete('/schedule/:id', isAdmin, async (req, res) => {
    const lessonId = req.params.id;
    try {
        // Retrieve the entry before deletion to use it for notifications
        const entryToDelete = await ScheduleEntry.findById(lessonId);
        const result = await ScheduleEntry.findByIdAndDelete(lessonId);

        // Handle schedule entry not found
        if (!result) {
            return res.status(404).json({ message: 'Lezione non trovata per l\'eliminazione.' });
        }

        // Trigger notifications for schedule deletion
        if (entryToDelete) {
            await notifyScheduleChange(entryToDelete, 'DELETE');
        }

        res.json({ success: true, message: 'Lezione eliminata con successo.' });
    } catch (error) {
        res.status(500).json({ message: 'Errore nell\'eliminazione della lezione.' });
    }
});

// Create a new schedule entry and notify affected users
router.post('/schedule', isAdmin, async (req, res) => {
    const newEntryData = req.body;
    try {
        const newEntry = new ScheduleEntry(newEntryData);
        await newEntry.save();

        // Trigger notifications for schedule creation
        await notifyScheduleChange(newEntry, 'POST');

        res.status(201).json({ success: true, message: 'Lezione creata con successo.', data: newEntry });
    } catch (error) {
        res.status(500).json({ message: 'Errore nella creazione della lezione.' });
    }
});


// Retrieve all notifications for a specific user
router.get('/notifications', async (req, res) => {
    const { userId } = req.query;

    // Validate user ID before querying notifications
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'ID utente necessario per filtrare le notifiche.' });
    }

    try {
        const notifications = await Notification.find({ target_user_id: userId })
            .sort({ is_read: 1, created_at: -1 });

        res.json(notifications);
    } catch (error) {
        console.error("Errore nel recupero delle notifiche:", error);
        res.status(500).json({ message: 'Errore nel recupero delle notifiche' });
    }
});

// Mark all unread notifications for a user as read
router.put('/notifications/mark-all-read', async (req, res) => {
    const { userId } = req.body;

    // Validate user ID before updating notifications
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'ID utente valido necessario.' });
    }

    try {
        await Notification.updateMany(
            { target_user_id: userId, is_read: false },
            { $set: { is_read: true } }
        );
        res.json({ success: true, message: 'Tutte le notifiche sono state segnate come lette.' });
    } catch (error) {
        console.error("Errore nel marcare tutto come letto:", error);
        res.status(500).json({ success: false, message: 'Errore nel marcare tutto come letto.' });
    }
});

// Delete all notifications associated with a specific user
router.delete('/notifications/all', async (req, res) => {
    const { userId } = req.query;

    // Validate user ID before deleting notifications
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'ID utente valido necessario.' });
    }

    try {
        const result = await Notification.deleteMany({ target_user_id: userId });

        res.json({ success: true, message: `Eliminate ${result.deletedCount} notifiche.`, data: result });
    } catch (error) {
        console.error("Errore nell'eliminazione di tutte le notifiche:", error);
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione di tutte le notifiche.' });
    }
});

// Mark a single notification as read
router.put('/notifications/:id', async (req, res) => {
    const notificationId = req.params.id;
    try {
        const updatedNotification = await Notification.findByIdAndUpdate(
            notificationId,
            { is_read: true },
            { new: true, runValidators: true }
        );

        // Handle notification not found
        if (!updatedNotification) {
            return res.status(404).json({ success: false, message: 'Notifica non trovata.' });
        }

        res.json({ success: true, message: 'Notifica aggiornata con successo.', data: updatedNotification });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento della notifica.' });
    }
});

// Delete a single notification by ID
router.delete('/notifications/:id', async (req, res) => {
    const notificationId = req.params.id;
    try {
        const result = await Notification.findByIdAndDelete(notificationId);

        // Handle notification not found
        if (!result) {
            return res.status(404).json({ success: false, message: 'Notifica non trovata per l\'eliminazione.' });
        }
        res.json({ success: true, message: 'Notifica eliminata con successo.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Errore nell\'eliminazione della notifica.' });
    }
});


module.exports = router;