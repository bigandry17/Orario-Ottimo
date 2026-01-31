const { User, Course, Subject, Classroom, Constraint, Teacher, ScheduleEntry, Notification, Preference } = require('./models');
const bcrypt = require('bcrypt');


const INITIAL_USERS = [
    { username: 'admin', password: 'admin', role: 'admin', name: 'Amministratore' },
    { username: 'rossi', password: 'docente', role: 'docente', name: 'Mario Rossi' },
    { username: 'bianchi', password: 'docente', role: 'docente', name: 'Laura Bianchi' },
    { username: 'verdi', password: 'docente', role: 'docente', name: 'Giuseppe Verdi' },
    { username: 'neri', password: 'docente', role: 'docente', name: 'Anna Neri' },
    { username: 'gialli', password: 'docente', role: 'docente', name: 'Francesco Gialli' },
    { username: 'marroni', password: 'docente', role: 'docente', name: 'Elisa Marroni' }
];

const INITIAL_TEACHERS = [
    {
        name: 'Mario Rossi', email: 'rossi@uniparthenope.it',
        subjects: [
            'Analisi Matematica I',
            'Algebra Lineare',
            'Fisica',
            'Matematica Generale',
            'Analisi Matematica Gestionale'
        ],
        max_weekly_hours: 18
    },
    {
        name: 'Laura Bianchi', email: 'bianchi@uniparthenope.it',
        subjects: [
            'Programmazione I',
            'Algoritmi E Strutture Dati',
            'Sistemi Informativi Aziendali',
            'Basi Di Dati'
        ],
        max_weekly_hours: 18
    },
    {
        name: 'Giuseppe Verdi', email: 'verdi@uniparthenope.it',
        subjects: [
            'Basi Di Dati',
            'Lingua Inglese',
            'Economia Aziendale',
            'Gestione Aziendale',
            'Matematica Generale'
        ],
        max_weekly_hours: 16
    },
    {
        name: 'Anna Neri', email: 'neri@uniparthenope.it',
        subjects: [
            'Economia Aziendale',
            'Matematica Generale',
            'Statistica'
        ],
        max_weekly_hours: 16
    },
    {
        name: 'Francesco Gialli', email: 'gialli@uniparthenope.it',
        subjects: [
            'Diritto Pubblico',
            'Diritto Privato'
        ],
        max_weekly_hours: 14
    },
    {
        name: 'Elisa Marroni', email: 'marroni@uniparthenope.it',
        subjects: [
            'Gestione Aziendale',
            'Sistemi Informativi Aziendali',
            'Organizzazione Aziendale'
        ],
        max_weekly_hours: 15
    },
];

const INITIAL_COURSES = [
    { name: 'Informatica', year: 1, students_count: 85 },
    { name: 'Informatica', year: 2, students_count: 72 },
    { name: 'Ingegneria Informatica', year: 1, students_count: 95 },
    { name: 'Economia Aziendale', year: 1, students_count: 120 },
    { name: 'Ingegneria Gestionale', year: 1, students_count: 110 },
];

const INITIAL_SUBJECTS = [
    { name: 'Analisi Matematica I', code: 'MAT01', is_lab: false, weekly_hours: 4, course_ref: 'Informatica - 1' },
    { name: 'Programmazione I', code: 'INF01', is_lab: true, weekly_hours: 4, course_ref: 'Informatica - 1' },
    { name: 'Algoritmi E Strutture Dati', code: 'INF02', is_lab: true, weekly_hours: 4, course_ref: 'Informatica - 2' },
    { name: 'Basi Di Dati', code: 'INF03', is_lab: true, weekly_hours: 2, course_ref: 'Informatica - 2' },
    { name: 'Lingua Inglese', code: 'ENG', is_lab: false, weekly_hours: 2, course_ref: 'Informatica - 1' },
    { name: 'Algebra Lineare', code: 'MAT02', is_lab: false, weekly_hours: 2, course_ref: 'Informatica - 1' },
    { name: 'Fisica', code: 'PHY', is_lab: true, weekly_hours: 4, course_ref: 'Ingegneria Informatica - 1' },

    { name: 'Matematica Generale', code: 'ECO01', is_lab: false, weekly_hours: 4, course_ref: 'Economia Aziendale - 1' },
    { name: 'Economia Aziendale', code: 'ECO02', is_lab: false, weekly_hours: 6, course_ref: 'Economia Aziendale - 1' },
    { name: 'Sistemi Informativi Aziendali', code: 'ECO03', is_lab: true, weekly_hours: 4, course_ref: 'Economia Aziendale - 1' },
    { name: 'Diritto Pubblico', code: 'ECO04', is_lab: false, weekly_hours: 4, course_ref: 'Economia Aziendale - 1' },
    { name: 'Statistica', code: 'ECO05', is_lab: false, weekly_hours: 6, course_ref: 'Economia Aziendale - 1' },

    { name: 'Gestione Aziendale', code: 'ING01', is_lab: false, weekly_hours: 4, course_ref: 'Ingegneria Gestionale - 1' },
    { name: 'Analisi Matematica Gestionale', code: 'ING02', is_lab: false, weekly_hours: 6, course_ref: 'Ingegneria Gestionale - 1' },
    { name: 'Organizzazione Aziendale', code: 'ING03', is_lab: false, weekly_hours: 2, course_ref: 'Ingegneria Gestionale - 1' },
];

const INITIAL_CLASSROOMS = [
    { name: 'A1', floor: 1, capacity: 30, has_projector: true, has_pc: false },
    { name: 'A2', floor: 2, capacity: 30, has_projector: true, has_pc: false },
    { name: 'Lab Informatica 1', floor: 2, capacity: 90, has_projector: true, has_pc: true },
    { name: 'Lab Informatica 2', floor: 3, capacity: 90, has_projector: true, has_pc: true },
    { name: 'Aula Magna', floor: 3, capacity: 150, has_projector: true, has_pc: false },
    { name: 'B4', floor: 3, capacity: 100, has_projector: true, has_pc: false },
];

const INITIAL_CONSTRAINTS = [
    {
        name: 'Nessuna sovrapposizione Docente',
        description: 'Impedisce a un docente di avere due lezioni contemporanee.',
        type: 'Rigido',
        tag: 'no_overlap_teacher'
    },
    {
        name: 'Nessuna sovrapposizione Aula',
        description: 'Impedisce a un aula di ospitare due lezioni contemporanee.',
        type: 'Rigido',
        tag: 'no_overlap_classroom'
    }
];

const INITIAL_NOTIFICATIONS_SEED = [
    { target_role: 'admin', title: 'Benvenuto nel Sistema', message: 'Il sistema di notifica personale è attivo e funzionante. Le modifiche all\'orario verranno notificate qui.', type: 'info', is_read: false },
    { target_role: 'admin', title: 'Configurazione Iniziale', message: 'I vincoli Rigidi e Flessibili e i dati di Docenti/Corsi sono stati caricati.', type: 'warning', is_read: false },
    { target_role: 'admin', title: 'Test Creazione Orario', message: 'Crea la tua prima lezione per innescare le notifiche per Docenti e Studenti.', type: 'success', is_read: true },
];

const INITIAL_PREFERENCES_SEED = [
    { teacher_name: 'Mario Rossi', day: 'Martedì', time_slot: '14:00 - 16:00', type: 'Non Disponibile' },
    { teacher_name: 'Mario Rossi', day: 'Mercoledì', time_slot: '09:00 - 11:00', type: 'Preferito' },

    { teacher_name: 'Laura Bianchi', day: 'Venerdì', time_slot: '14:00 - 16:00', type: 'Non Disponibile' },
    { teacher_name: 'Laura Bianchi', day: 'Lunedì', time_slot: '16:00 - 18:00', type: 'Evitare' },

    { teacher_name: 'Giuseppe Verdi', day: 'Martedì', time_slot: '11:00 - 13:00', type: 'Preferito' },
    { teacher_name: 'Anna Neri', day: 'Giovedì', time_slot: '16:00 - 18:00', type: 'Preferito' },
    { teacher_name: 'Francesco Gialli', day: 'Lunedì', time_slot: '09:00 - 11:00', type: 'Non Disponibile' },
    { teacher_name: 'Elisa Marroni', day: 'Mercoledì', time_slot: '14:00 - 16:00', type: 'Evitare' },
];

// Initialize and seed the database with initial data if collections are empty
async function initializeDatabase() {
    try {
        const populateCollection = async (Model, initialData, name) => {
            const count = await Model.countDocuments();
            if (count === 0) {
                await Model.insertMany(initialData);
                console.log(`DB Popolato: ${name} (${initialData.length} entries)`);
            } else {
                console.log(`DB Seeding: ${name} esistono già (${count} entries).`);
            }
        };

        const countUsers = await User.countDocuments();
        if (countUsers === 0) {
            const saltedUsers = await Promise.all(INITIAL_USERS.map(async (user) => {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(user.password, salt);
                return { ...user, password: hashedPassword };
            }));
            await User.insertMany(saltedUsers);
            console.log(`DB Popolato: Utenti crittografati (${saltedUsers.length} entries)`);
        }

        const adminUser = await User.findOne({ username: 'admin' });

        const countNotif = await Notification.countDocuments();
        if (countNotif === 0 && adminUser) {
            const notificationsWithId = INITIAL_NOTIFICATIONS_SEED.map(n => ({
                ...n,
                target_user_id: adminUser._id
            }));
            await Notification.insertMany(notificationsWithId);
            console.log(`DB Popolato: Notifiche Admin Iniziali (${notificationsWithId.length} entries)`);
        } else {
            console.log(`DB Seeding: Notifiche esistono già (${countNotif} entries) o Admin non trovato.`);
        }

        await populateCollection(Teacher, INITIAL_TEACHERS, 'Teachers');
        await populateCollection(Course, INITIAL_COURSES, 'Courses');
        await populateCollection(Subject, INITIAL_SUBJECTS, 'Subjects');
        await populateCollection(Classroom, INITIAL_CLASSROOMS, 'Classrooms');
        await populateCollection(Constraint, INITIAL_CONSTRAINTS, 'Constraints');

        const preferencesCount = await Preference.countDocuments();
        if (preferencesCount === 0) {
            const allTeachers = await Teacher.find({});
            const teacherIdMap = new Map(allTeachers.map(t => [t.name, t._id]));

            const initialPreferences = INITIAL_PREFERENCES_SEED.map(pref => {
                const teacherId = teacherIdMap.get(pref.teacher_name);
                if (!teacherId) {
                    console.error(`Docente ${pref.teacher_name} non trovato per le preferenze. Ignorando questa preferenza.`);
                    return null;
                }
                return {
                    teacher_id: teacherId,
                    day: pref.day,
                    time_slot: pref.time_slot,
                    type: pref.type
                };
            }).filter(p => p !== null);

            await Preference.insertMany(initialPreferences);
            console.log(`DB Popolato: Preferenze (${initialPreferences.length} entries)`);
        } else {
            console.log(`DB Seeding: Preferenze esistono già (${preferencesCount} entries).`);
        }
    } catch (error) {
        console.error('ERRORE CRITICO DURANTE L\'INIZIALIZZAZIONE DEL DATABASE:', error);
    }
}

module.exports = { initializeDatabase };